import { prisma } from "../db.js";
import { parseCSV } from "../utils/csv.js";
import { parseSafeDate } from "../utils/date.js";
import { normalizeStatus, normalizePriority } from "../utils/status.js";
import { randomUUID } from "crypto";

// Mutex lock to prevent concurrent full sheet syncs
let isSyncing = false;

/**
 * Fetch spreadsheet CSV with retry and exponential backoff
 */
async function fetchWithRetry(url: string, retries = 3, delay = 1000): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return res;
      console.warn(`Spreadsheet fetch returned status ${res.status}. Attempt ${i + 1} of ${retries}.`);
    } catch (err: any) {
      console.warn(`Spreadsheet fetch network error: ${err.message}. Attempt ${i + 1} of ${retries}.`);
    }
    if (i < retries - 1) {
      const backoffDelay = delay * Math.pow(2, i);
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
    }
  }
  throw new Error(`Failed to fetch spreadsheet after ${retries} attempts.`);
}

/**
 * Compare two JSON metadata objects for key-value equality independent of insertion order
 */
function areObjectsEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (String(a[key] ?? "") !== String(b[key] ?? "")) return false;
  }
  return true;
}

/**
 * Split array into smaller chunks for batch processing
 */
function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * Execute update operations in batched non-interactive transactions to prevent P2028 timeouts
 */
async function runBatchedTransactions<T>(
  items: T[],
  operation: (item: T) => any,
  batchSize = 20
): Promise<void> {
  for (const batch of chunkArray(items, batchSize)) {
    await prisma.$transaction(
      batch.map(item => operation(item))
    );
  }
}

export const syncService = {
  /**
   * Synchronizes the entire database from the consolidated Google Sheets CSV export.
   * Uses batched array transactions to prevent long-lived interactive transaction timeouts (P2028).
   */
  async syncFullSheet(spreadsheetId: string, gid?: string) {
    if (isSyncing) {
      throw new Error("SyncInProgress: A spreadsheet synchronization is already in progress.");
    }
    isSyncing = true;
    console.log("🔄 Starting full sync service processing...");

    try {
      // 1. Fetch CSV contents with retry logic
      const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv${gid ? `&gid=${gid}` : ""}`;
      const response = await fetchWithRetry(url);
      const csvText = await response.text();

      // 2. Parse CSV
      const rows = parseCSV(csvText);
      if (rows.length < 2) {
        throw new Error("Spreadsheet contains no data rows.");
      }

      const headers = rows[0].map(h => h.trim().replace(/^\uFEFF/, ""));
      const dataRows = rows.slice(1);

      // Validate required spreadsheet headers
      const requiredHeaders = [
        "Ticket ID",
        "Application ID",
        "Customer Name",
        "State",
        "District"
      ];

      const missingHeaders = requiredHeaders.filter(
        header => !headers.includes(header)
      );

      if (missingHeaders.length > 0) {
        throw new Error(
          `Spreadsheet validation failed. Missing required headers: ${missingHeaders.join(", ")}`
        );
      }

      // 3. Preload all necessary tables to eliminate loops with inline awaits
      const states = await prisma.state.findMany();
      const stateMap = new Map<string, string>(); // name.toLowerCase() -> id
      states.forEach(s => stateMap.set(s.name.toLowerCase().trim(), s.id));

      const districts = await prisma.district.findMany();
      const districtMap = new Map<string, string>(); // stateId:name.toLowerCase() -> id
      districts.forEach(d => districtMap.set(`${d.stateId}:${d.name.toLowerCase().trim()}`, d.id));

      const engineers = await prisma.engineer.findMany();
      const engineerMap = new Map<string, string>(); // email.toLowerCase() -> engineerId
      engineers.forEach(e => {
        engineerMap.set(e.email.toLowerCase().trim(), e.id);
      });

      const installations = await prisma.masterInstallation.findMany();
      const installationMap = new Map<string, any>(); // applicationId.toLowerCase() -> record
      installations.forEach(inst => {
        installationMap.set(inst.applicationId.toLowerCase().trim(), inst);
      });

      // Preload existing tickets for non-destructive incremental upserts
      const existingTickets = await prisma.ticket.findMany({
        include: {
          complaint: true,
          assignments: { where: { deletedAt: null } },
          initialVisits: { where: { deletedAt: null } },
          serviceReports: { where: { deletedAt: null } },
          materialRequests: { where: { deletedAt: null }, include: { items: true } }
        }
      });
      const existingTicketMap = new Map<string, any>(); // ticketNumber.toUpperCase() -> ticket record
      existingTickets.forEach(t => existingTicketMap.set(t.ticketNumber.toUpperCase().trim(), t));

      // 4. Preload/Upsert Admin Role and Admin User
      const adminRole = await prisma.role.upsert({
        where: { name: "Admin" },
        update: {},
        create: {
          name: "Admin",
          description: "Administrator with full control"
        }
      });

      const existingAdmin = await prisma.user.findUnique({
        where: { email: "admin@claro.com" }
      });

      if (!existingAdmin) {
        const bcrypt = await import("bcryptjs");
        const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || "admin123";

        if (!adminPassword) {
          throw new Error(
            "DEFAULT_ADMIN_PASSWORD environment variable is required."
          );
        }

        const adminPasswordHash = bcrypt.default.hashSync(
          adminPassword,
          10
        );

        await prisma.user.create({
          data: {
            email: "admin@claro.com",
            fullName: "System Admin",
            passwordHash: adminPasswordHash,
            roleId: adminRole.id
          }
        });
      }

      // Maps & collections to track incremental changes
      const newStates = new Map<string, any>(); // name.toLowerCase() -> state data
      const newDistricts = new Map<string, any>(); // stateId:name.toLowerCase() -> district data
      const newEngineers = new Map<string, any>(); // email -> operational engineer record

      const installationsToCreate: any[] = [];
      const installationsToUpdate: any[] = [];
      const processedInstallations = new Set<string>();

      const complaintsToCreate: any[] = [];
      const complaintsToUpdate: any[] = [];

      const ticketsToCreate: any[] = [];
      const ticketsToUpdate: any[] = [];

      const ticketAssignmentsToCreate: any[] = [];
      const ticketAssignmentsToUpdate: any[] = [];
      const ticketAssignmentsToDelete: string[] = [];

      const initialVisitsToCreate: any[] = [];
      const initialVisitsToUpdate: any[] = [];
      const initialVisitsToDelete: string[] = [];

      const serviceReportsToCreate: any[] = [];
      const serviceReportsToUpdate: any[] = [];
      const serviceReportsToDelete: string[] = [];

      const materialRequestsToCreate: any[] = [];
      const materialRequestItemsToCreate: any[] = [];
      const materialRequestsToUpdate: any[] = [];
      const materialRequestsToDelete: string[] = [];

      const ticketHistoriesToCreate: any[] = [];

      const processedTicketNumbers = new Set<string>();

      // 5. Parse sheet rows and construct database payload entities in memory
      for (let index = 0; index < dataRows.length; index++) {
        const row = dataRows[index];
        const rowNumber = index + 2;

        const getVal = (colName: string) => {
          const idx = headers.indexOf(colName);
          return (idx !== -1 && row[idx] !== undefined && row[idx] !== null) ? row[idx].toString().trim() : "";
        };

        const applicationId = getVal("Application ID");
        const clientName = getVal("Customer Name") || "Unknown Client";
        const districtStr = getVal("District") || "Unknown";
        const stateStr = getVal("State") || "Maharashtra";
        const installationDateStr = getVal("Installation Date");
        const complaintDateStr = getVal("Created At") || getVal("Date");
        const complainantPhone = getVal("Customer Phone") || "N/A";
        const complaintType = getVal("Issue Type") || "General";
        const description = getVal("Description") || "";
        const ticketNumberStr = getVal("Ticket ID");
        const assignedEngineerName = getVal("Assigned Engineer Name");
        const initialVisitDateStr = getVal("Initial Visit Date");
        const serviceReportDateStr = getVal("Service Report Date");
        const materialStatusStr = getVal("Material Status");
        const engineerEmail = getVal("Engineer Email") || getVal("Assigned Engineer Email");
        const engineerPhone = getVal("Engineer Phone") || "N/A";

        // Map missing Application IDs to distinct, row-specific placeholders
        let finalAppId = applicationId ? applicationId.trim().toUpperCase() : "";
        if (!finalAppId || finalAppId === "N/A") {
          if (!clientName && !ticketNumberStr && !complaintDateStr) {
            continue; // Skip empty/blank spacer rows
          }
          finalAppId = `UNKNOWN-APP-ROW-${rowNumber}`;
        }

        // Map State
        let stateId = stateMap.get(stateStr.toLowerCase().trim()) || null;
        if (stateStr && !stateId) {
          const cleanState = stateStr.toLowerCase().trim();
          let stateObj = newStates.get(cleanState);
          if (!stateObj) {
            stateId = randomUUID();
            stateObj = { id: stateId, name: stateStr };
            newStates.set(cleanState, stateObj);
          } else {
            stateId = stateObj.id;
          }
        }

        // Map District
        let districtId = (stateId && districtStr) ? districtMap.get(`${stateId}:${districtStr.toLowerCase().trim()}`) : null;
        if (stateId && districtStr && !districtId) {
          const districtKey = `${stateId}:${districtStr.toLowerCase().trim()}`;
          let districtObj = newDistricts.get(districtKey);
          if (!districtObj) {
            districtId = randomUUID();
            districtObj = { id: districtId, stateId, name: districtStr };
            newDistricts.set(districtKey, districtObj);
          } else {
            districtId = districtObj.id;
          }
        }

        const installationDate = parseSafeDate(installationDateStr);
        const complaintDate = parseSafeDate(complaintDateStr) || new Date();

        // Queue installations to create or update
        const cleanAppId = finalAppId.toLowerCase().trim();
        if (!processedInstallations.has(cleanAppId)) {
          const existing = installationMap.get(cleanAppId);
          const address = `${districtStr.trim()}, ${stateStr.trim()}`;
          const finalClientName = finalAppId.startsWith("UNKNOWN-APP-ROW-") ? "N/A" : clientName.trim();
          const finalAddress = finalAppId.startsWith("UNKNOWN-APP-ROW-") ? "N/A" : address;

          if (!existing) {
            installationsToCreate.push({
              id: randomUUID(),
              applicationId: finalAppId,
              clientName: finalClientName,
              address: finalAddress,
              stateId,
              districtId,
              installationDate
            });
          } else {
            const existingInstallationTime = existing.installationDate
              ? new Date(existing.installationDate).getTime()
              : null;

            const incomingInstallationTime = installationDate
              ? installationDate.getTime()
              : null;

            const hasChanged =
              existing.clientName !== finalClientName ||
              existing.address !== finalAddress ||
              existing.stateId !== stateId ||
              existing.districtId !== districtId ||
              existingInstallationTime !== incomingInstallationTime;

            if (hasChanged) {
              installationsToUpdate.push({
                id: existing.id,
                clientName: finalClientName,
                address: finalAddress,
                stateId,
                districtId,
                installationDate
              });
            }
          }
          processedInstallations.add(cleanAppId);
        }

        // Construct complete row metadata JSON
        const rowMetadata: Record<string, any> = {};
        headers.forEach((h, i) => {
          rowMetadata[h] = row[i] || "";
        });

        // Prepare operational engineer record in memory (no User login account created)
        let engineerDbId: string | null = null;
        if (engineerEmail && engineerEmail.trim()) {
          const cleanEmail = engineerEmail.trim().toLowerCase();
          engineerDbId = engineerMap.get(cleanEmail) || null;

          if (!engineerDbId && assignedEngineerName) {
            let preparedEngineer = newEngineers.get(cleanEmail);

            if (!preparedEngineer) {
              engineerDbId = randomUUID();

              preparedEngineer = {
                id: engineerDbId,
                name: assignedEngineerName.trim(),
                email: cleanEmail,
                phone: engineerPhone.trim(),
                stateId,
                districtId
              };

              newEngineers.set(cleanEmail, preparedEngineer);
            } else {
              engineerDbId = preparedEngineer.id;
            }
          }
        }

        // Ticket status & priority normalization
        const liveStageStr = getVal("Live Stage");
        let liveStage = "RECEIVED";
        const mappedStage = normalizeStatus(liveStageStr);
        if (mappedStage) {
          liveStage = mappedStage;
        } else {
          if (serviceReportDateStr) liveStage = "RESOLVED";
          else if (materialStatusStr && materialStatusStr !== "N/A") liveStage = "MATERIAL_REQUESTED";
          else if (initialVisitDateStr) liveStage = "INITIAL_VISIT_COMPLETED";
          else if (engineerDbId) liveStage = "ASSIGNED";
        }

        const priorityStr = getVal("Priority");
        const priority = normalizePriority(priorityStr) || "STANDARD";

        // Generate deterministic ticket number
        let finalTicketNumber = ticketNumberStr ? ticketNumberStr.trim().toUpperCase() : "";
        if (!finalTicketNumber) {
          const yy = complaintDate.getFullYear().toString().slice(-2);
          const mm = (complaintDate.getMonth() + 1).toString().padStart(2, '0');
          const dd = complaintDate.getDate().toString().padStart(2, '0');
          const datePrefix = `${yy}${mm}${dd}`;
          finalTicketNumber = `CLR-${datePrefix}-ROW${rowNumber}`;
        }

        if (processedTicketNumbers.has(finalTicketNumber)) {
          continue; // Guard against sheet double-entries
        }
        processedTicketNumbers.add(finalTicketNumber);

        // Check if ticket exists in database for incremental update
        const existingTicket = existingTicketMap.get(finalTicketNumber);

        if (existingTicket) {
          const ticketId = existingTicket.id;
          const complaintId = existingTicket.complaintId;

          // Accurate Metadata Comparison
          const metadataChanged = !areObjectsEqual(existingTicket.metadata, rowMetadata);

          // Check if complaint fields changed
          const complaintChanged =
            existingTicket.complaint.complainantName !== clientName.trim() ||
            existingTicket.complaint.complainantPhone !== complainantPhone.trim() ||
            existingTicket.complaint.complaintType !== complaintType.trim() ||
            existingTicket.complaint.description !== description.trim() ||
            metadataChanged;

          if (complaintChanged) {
            complaintsToUpdate.push({
              id: complaintId,
              complainantName: clientName.trim(),
              complainantPhone: complainantPhone.trim(),
              complaintType: complaintType.trim(),
              description: description.trim(),
              metadata: rowMetadata
            });
          }

          // Check if ticket status or priority changed
          const ticketChanged =
            existingTicket.status !== liveStage ||
            existingTicket.priority !== priority ||
            metadataChanged;

          if (ticketChanged) {
            ticketsToUpdate.push({
              id: ticketId,
              status: liveStage,
              priority,
              metadata: rowMetadata
            });

            // Generate status history entry ONLY on actual status changes
            if (existingTicket.status !== liveStage) {
              ticketHistoriesToCreate.push({
                id: randomUUID(),
                ticketId,
                oldStatus: existingTicket.status,
                newStatus: liveStage,
                changeSummary: `Status updated from ${existingTicket.status} to ${liveStage} via Google Sheets sync.`
              });
            }
          }

          // Assignment handling & Cleared Fields handling
          const currentAssignment = existingTicket.assignments[0];
          if (engineerDbId) {
            if (!currentAssignment) {
              ticketAssignmentsToCreate.push({
                id: randomUUID(),
                ticketId,
                engineerId: engineerDbId,
                assignedAt: complaintDate
              });
            } else if (currentAssignment.engineerId !== engineerDbId) {
              ticketAssignmentsToUpdate.push({
                id: currentAssignment.id,
                engineerId: engineerDbId,
                assignedAt: complaintDate
              });
            }
          } else if (currentAssignment) {
            // Handle cleared engineer assignment field
            ticketAssignmentsToDelete.push(currentAssignment.id);
          }

          // Initial visit handling & Cleared Fields handling (Skip unchanged updates)
          const currentVisit = existingTicket.initialVisits[0];
          if (initialVisitDateStr && engineerDbId) {
            const visitDate = parseSafeDate(initialVisitDateStr) || complaintDate;
            if (!currentVisit) {
              initialVisitsToCreate.push({
                id: randomUUID(),
                ticketId,
                engineerId: engineerDbId,
                visitDate,
                remarks: "Completed diagnostic check on pump."
              });
            } else {
              const visitDateChanged = !currentVisit.visitDate || new Date(currentVisit.visitDate).getTime() !== visitDate.getTime();
              const engChanged = currentVisit.engineerId !== engineerDbId;
              if (visitDateChanged || engChanged) {
                initialVisitsToUpdate.push({
                  id: currentVisit.id,
                  engineerId: engineerDbId,
                  visitDate
                });
              }
            }
          } else if (currentVisit && !initialVisitDateStr) {
            // Handle cleared initial visit field
            initialVisitsToDelete.push(currentVisit.id);
          }

          // Service report handling & Cleared Fields handling (Skip unchanged updates)
          const currentReport = existingTicket.serviceReports[0];
          if (serviceReportDateStr) {
            const reportDate = parseSafeDate(serviceReportDateStr) || complaintDate;
            if (!currentReport) {
              serviceReportsToCreate.push({
                id: randomUUID(),
                ticketId,
                reportDate,
                workDone: "Inspected wiring and restored system operation.",
                status: "COMPLETED"
              });
            } else {
              const reportDateChanged = !currentReport.reportDate || new Date(currentReport.reportDate).getTime() !== reportDate.getTime();
              if (reportDateChanged) {
                serviceReportsToUpdate.push({
                  id: currentReport.id,
                  reportDate
                });
              }
            }
          } else if (currentReport && !serviceReportDateStr) {
            // Handle cleared service report field
            serviceReportsToDelete.push(currentReport.id);
          }

          // Material request handling & Cleared Fields handling
          const currentMR = existingTicket.materialRequests[0];
          const hasMaterialRequest =
            Boolean(materialStatusStr) &&
            materialStatusStr.toUpperCase() !== "N/A" &&
            Boolean(engineerDbId);

          if (hasMaterialRequest && engineerDbId) {
            const materialStatusClean =
              materialStatusStr.toUpperCase() === "SUBMITTED"
                ? "PENDING"
                : materialStatusStr.toUpperCase();

            if (!currentMR) {
              const materialRequestId = randomUUID();

              materialRequestsToCreate.push({
                id: materialRequestId,
                ticketId,
                requestedBy: engineerDbId,
                status: materialStatusClean,
                remarks: "Required solar components."
              });

              materialRequestItemsToCreate.push({
                id: randomUUID(),
                materialRequestId,
                itemName: "Solar Pump Controller Card",
                quantity: 1
              });
            } else if (
              currentMR.status !== materialStatusClean ||
              currentMR.requestedBy !== engineerDbId
            ) {
              materialRequestsToUpdate.push({
                id: currentMR.id,
                status: materialStatusClean,
                requestedBy: engineerDbId
              });
            }
          } else if (currentMR) {
            materialRequestsToDelete.push(currentMR.id);
          }

        } else {
          // BRAND NEW TICKET
          const complaintId = randomUUID();
          const ticketId = randomUUID();

          complaintsToCreate.push({
            id: complaintId,
            formResponseId: rowNumber.toString(),
            applicationId: finalAppId,
            complainantName: clientName.trim(),
            complainantPhone: complainantPhone.trim(),
            complaintType: complaintType.trim(),
            description: description.trim(),
            submissionTimestamp: complaintDate,
            syncStatus: "SYNCED",
            metadata: rowMetadata
          });

          ticketsToCreate.push({
            id: ticketId,
            ticketNumber: finalTicketNumber,
            complaintId,
            status: liveStage,
            priority,
            createdAt: complaintDate,
            dueDate: new Date(complaintDate.getTime() + 72 * 60 * 60 * 1000),
            metadata: rowMetadata
          });

          ticketHistoriesToCreate.push({
            id: randomUUID(),
            ticketId,
            newStatus: liveStage,
            changeSummary: "Ticket created from Google Sheets sync."
          });

          if (engineerDbId) {
            ticketAssignmentsToCreate.push({
              id: randomUUID(),
              ticketId,
              engineerId: engineerDbId,
              assignedAt: complaintDate
            });
          }

          if (initialVisitDateStr && engineerDbId) {
            initialVisitsToCreate.push({
              id: randomUUID(),
              ticketId,
              engineerId: engineerDbId,
              visitDate: parseSafeDate(initialVisitDateStr) || complaintDate,
              remarks: "Completed diagnostic check on pump."
            });
          }

          if (serviceReportDateStr) {
            serviceReportsToCreate.push({
              id: randomUUID(),
              ticketId,
              reportDate: parseSafeDate(serviceReportDateStr) || complaintDate,
              workDone: "Inspected wiring and restored system operation.",
              status: "COMPLETED"
            });
          }

          if (materialStatusStr && materialStatusStr !== "N/A" && engineerDbId) {
            const materialRequestId = randomUUID();
            const materialStatusClean = materialStatusStr.toUpperCase() === "SUBMITTED" ? "PENDING" : materialStatusStr.toUpperCase();
            materialRequestsToCreate.push({
              id: materialRequestId,
              ticketId,
              requestedBy: engineerDbId,
              status: materialStatusClean,
              remarks: "Required solar components."
            });
            materialRequestItemsToCreate.push({
              id: randomUUID(),
              materialRequestId,
              itemName: "Solar Pump Controller Card",
              quantity: 1
            });
          }
        }
      }

      // 6. Execute direct bulk creations
      if (newStates.size > 0) {
        await prisma.state.createMany({ data: Array.from(newStates.values()), skipDuplicates: true });
      }

      if (newDistricts.size > 0) {
        await prisma.district.createMany({ data: Array.from(newDistricts.values()), skipDuplicates: true });
      }

      if (newEngineers.size > 0) {
        await prisma.engineer.createMany({ data: Array.from(newEngineers.values()), skipDuplicates: true });
      }

      if (installationsToCreate.length > 0) {
        await prisma.masterInstallation.createMany({ data: installationsToCreate, skipDuplicates: true });
      }

      if (complaintsToCreate.length > 0) {
        await prisma.complaint.createMany({ data: complaintsToCreate, skipDuplicates: true });
      }

      if (ticketsToCreate.length > 0) {
        await prisma.ticket.createMany({ data: ticketsToCreate, skipDuplicates: true });
      }

      if (ticketAssignmentsToCreate.length > 0) {
        await prisma.ticketAssignment.createMany({ data: ticketAssignmentsToCreate, skipDuplicates: true });
      }

      if (initialVisitsToCreate.length > 0) {
        await prisma.initialVisit.createMany({ data: initialVisitsToCreate, skipDuplicates: true });
      }

      if (serviceReportsToCreate.length > 0) {
        await prisma.serviceReport.createMany({ data: serviceReportsToCreate, skipDuplicates: true });
      }

      if (materialRequestsToCreate.length > 0) {
        await prisma.materialRequest.createMany({ data: materialRequestsToCreate, skipDuplicates: true });
      }

      if (materialRequestItemsToCreate.length > 0) {
        await prisma.materialRequestItem.createMany({ data: materialRequestItemsToCreate, skipDuplicates: true });
      }

      if (ticketHistoriesToCreate.length > 0) {
        await prisma.ticketHistory.createMany({ data: ticketHistoriesToCreate, skipDuplicates: true });
      }

      // 7. Execute updates using batched non-interactive transactions (prevents P2028 timeouts)
      if (installationsToUpdate.length > 0) {
        await runBatchedTransactions(
          installationsToUpdate,
          inst =>
            prisma.masterInstallation.update({
              where: { id: inst.id },
              data: {
                clientName: inst.clientName,
                address: inst.address,
                stateId: inst.stateId,
                districtId: inst.districtId,
                installationDate: inst.installationDate
              }
            })
        );
      }

      if (complaintsToUpdate.length > 0) {
        await runBatchedTransactions(
          complaintsToUpdate,
          c =>
            prisma.complaint.update({
              where: { id: c.id },
              data: {
                complainantName: c.complainantName,
                complainantPhone: c.complainantPhone,
                complaintType: c.complaintType,
                description: c.description,
                metadata: c.metadata
              }
            })
        );
      }

      if (ticketsToUpdate.length > 0) {
        await runBatchedTransactions(
          ticketsToUpdate,
          t =>
            prisma.ticket.update({
              where: { id: t.id },
              data: {
                status: t.status,
                priority: t.priority,
                metadata: t.metadata
              }
            })
        );
      }

      if (ticketAssignmentsToUpdate.length > 0) {
        await runBatchedTransactions(
          ticketAssignmentsToUpdate,
          a =>
            prisma.ticketAssignment.update({
              where: { id: a.id },
              data: { engineerId: a.engineerId, assignedAt: a.assignedAt }
            })
        );
      }

      if (initialVisitsToUpdate.length > 0) {
        await runBatchedTransactions(
          initialVisitsToUpdate,
          v =>
            prisma.initialVisit.update({
              where: { id: v.id },
              data: { engineerId: v.engineerId, visitDate: v.visitDate }
            })
        );
      }

      if (serviceReportsToUpdate.length > 0) {
        await runBatchedTransactions(
          serviceReportsToUpdate,
          sr =>
            prisma.serviceReport.update({
              where: { id: sr.id },
              data: { reportDate: sr.reportDate }
            })
        );
      }

      if (materialRequestsToUpdate.length > 0) {
        await runBatchedTransactions(
          materialRequestsToUpdate,
          mr =>
            prisma.materialRequest.update({
              where: { id: mr.id },
              data: {
                status: mr.status,
                requestedBy: mr.requestedBy
              }
            })
        );
      }

      // 8. Execute deletions for cleared sub-entities
      if (ticketAssignmentsToDelete.length > 0) {
        await prisma.ticketAssignment.deleteMany({ where: { id: { in: ticketAssignmentsToDelete } } });
      }

      if (initialVisitsToDelete.length > 0) {
        await prisma.initialVisit.deleteMany({ where: { id: { in: initialVisitsToDelete } } });
      }

      if (serviceReportsToDelete.length > 0) {
        await prisma.serviceReport.deleteMany({ where: { id: { in: serviceReportsToDelete } } });
      }

      if (materialRequestsToDelete.length > 0) {
        await prisma.materialRequestItem.deleteMany({
          where: { materialRequestId: { in: materialRequestsToDelete } }
        });
        await prisma.materialRequest.deleteMany({
          where: { id: { in: materialRequestsToDelete } }
        });
      }

      // 9. 🛡️ Strict Deletion Safety Guard before deleting missing tickets
      const ABSOLUTE_MINIMUM_ROWS = 600;
      const percentageMinimum = Math.floor(existingTickets.length * 0.9);

      const minimumSafeRows =
        existingTickets.length === 0
          ? 1
          : Math.min(ABSOLUTE_MINIMUM_ROWS, percentageMinimum);

      const isSafeToPrune = processedTicketNumbers.size >= minimumSafeRows;

      if (isSafeToPrune) {
        const ticketsToDelete = existingTickets.filter(t => !processedTicketNumbers.has(t.ticketNumber.toUpperCase().trim()));
        if (ticketsToDelete.length > 0) {
          const deleteIds = ticketsToDelete.map(t => t.id);
          const deleteComplaintIds = ticketsToDelete.map(t => t.complaintId);

          await prisma.ticketHistory.deleteMany({ where: { ticketId: { in: deleteIds } } });
          await prisma.initialVisit.deleteMany({ where: { ticketId: { in: deleteIds } } });
          await prisma.serviceReport.deleteMany({ where: { ticketId: { in: deleteIds } } });
          await prisma.materialRequestItem.deleteMany({ where: { materialRequest: { ticketId: { in: deleteIds } } } });
          await prisma.materialRequest.deleteMany({ where: { ticketId: { in: deleteIds } } });
          await prisma.ticketAssignment.deleteMany({ where: { ticketId: { in: deleteIds } } });
          await prisma.ticket.deleteMany({ where: { id: { in: deleteIds } } });
          await prisma.complaint.deleteMany({ where: { id: { in: deleteComplaintIds } } });
        }
      } else if (existingTickets.length > 0) {
        console.warn(`⚠️ Safety Guard Triggered: Parsed row count (${processedTicketNumbers.size}) is lower than minimum safe threshold (${minimumSafeRows}). Skipped deleting missing tickets to preserve database integrity.`);
      }

      return {
        installationsCount: processedInstallations.size,
        ticketsCount: processedTicketNumbers.size,
        created: {
          tickets: ticketsToCreate.length,
          complaints: complaintsToCreate.length,
          assignments: ticketAssignmentsToCreate.length,
          visits: initialVisitsToCreate.length,
          reports: serviceReportsToCreate.length,
          materialRequests: materialRequestsToCreate.length
        },
        updated: {
          tickets: ticketsToUpdate.length,
          complaints: complaintsToUpdate.length,
          assignments: ticketAssignmentsToUpdate.length,
          visits: initialVisitsToUpdate.length,
          reports: serviceReportsToUpdate.length,
          materialRequests: materialRequestsToUpdate.length
        },
        cleared: {
          assignments: ticketAssignmentsToDelete.length,
          visits: initialVisitsToDelete.length,
          reports: serviceReportsToDelete.length,
          materialRequests: materialRequestsToDelete.length
        }
      };

    } finally {
      // Always unlock the mutex lock
      isSyncing = false;
    }
  }
};

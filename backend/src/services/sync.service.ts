import { prisma } from "../db.js";
import { parseCSV } from "../utils/csv.js";
import { parseSafeDate } from "../utils/date.js";
import { normalizeStatus, normalizePriority } from "../utils/status.js";
import { engineerService } from "./engineer.service.js";
import { ticketService } from "./ticket.service.js";
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

export const syncService = {
  /**
   * Synchronizes the entire database from the consolidated Google Sheets CSV export.
   * Runs as a single atomic transaction to prevent partial states.
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

      // 3. Preload all necessary tables to eliminate loops with inline awaits
      const states = await prisma.state.findMany();
      const stateMap = new Map<string, string>(); // name.toLowerCase() -> id
      states.forEach(s => stateMap.set(s.name.toLowerCase().trim(), s.id));

      const districts = await prisma.district.findMany();
      const districtMap = new Map<string, string>(); // stateId:name.toLowerCase() -> id
      districts.forEach(d => districtMap.set(`${d.stateId}:${d.name.toLowerCase().trim()}`, d.id));

      const engineers = await prisma.engineer.findMany({ include: { user: true } });
      const engineerMap = new Map<string, string>(); // email.toLowerCase() -> engineerId
      const userMap = new Map<string, string>(); // email.toLowerCase() -> userId
      engineers.forEach(e => {
        engineerMap.set(e.email.toLowerCase().trim(), e.id);
        if (e.user) {
          userMap.set(e.email.toLowerCase().trim(), e.user.id);
        }
      });

      const installations = await prisma.masterInstallation.findMany();
      const installationMap = new Map<string, any>(); // applicationId.toLowerCase() -> record
      installations.forEach(inst => {
        installationMap.set(inst.applicationId.toLowerCase().trim(), inst);
      });

      // 4. Preload/Upsert Roles
      const adminRole = await prisma.role.upsert({
        where: { name: "Admin" },
        update: {},
        create: { name: "Admin", description: "Administrator with full control" }
      });

      const engineerRole = await prisma.role.upsert({
        where: { name: "Engineer" },
        update: {},
        create: { name: "Engineer", description: "Field Engineer" }
      });

      const defaultPassword = await import("bcryptjs").then(b => b.default.hashSync("admin123", 10));
      const engPassword = await import("bcryptjs").then(b => b.default.hashSync("engineer123", 10));

      // Ensure default system admin user exists
      await prisma.user.upsert({
        where: { email: "admin@claro.com" },
        update: {},
        create: {
          email: "admin@claro.com",
          fullName: "System Admin",
          passwordHash: defaultPassword,
          roleId: adminRole.id
        }
      });

      // Maps to collect and deduplicate in-memory entities for bulk creation
      const newStates = new Map<string, any>(); // name.toLowerCase() -> state data
      const newDistricts = new Map<string, any>(); // stateId:name.toLowerCase() -> district data
      const newUsers = new Map<string, any>(); // email -> user data
      const newEngineers = new Map<string, any>(); // email -> engineer data

      const installationsToCreate: any[] = [];
      const installationsToUpdate: any[] = [];
      const processedInstallations = new Set<string>();

      const complaints: any[] = [];
      const tickets: any[] = [];
      const ticketAssignments: any[] = [];
      const initialVisits: any[] = [];
      const serviceReports: any[] = [];
      const materialRequests: any[] = [];
      const materialRequestItems: any[] = [];
      const ticketHistories: any[] = [];

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

        // Map State, generating dynamic UUIDs for newly encountered states in memory
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

        // Map District, generating dynamic UUIDs for newly encountered districts in memory
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
            const hasChanged =
              existing.clientName !== finalClientName ||
              existing.address !== finalAddress ||
              existing.stateId !== stateId ||
              existing.districtId !== districtId ||
              (existing.installationDate && installationDate && new Date(existing.installationDate).getTime() !== installationDate.getTime());

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

        // Add Complaint record
        const complaintId = randomUUID();
        complaints.push({
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

        // Prepare new user/engineer accounts in memory
        let engineerDbId: string | null = null;
        if (engineerEmail && engineerEmail.trim()) {
          const cleanEmail = engineerEmail.trim().toLowerCase();
          engineerDbId = engineerMap.get(cleanEmail) || null;

          if (!engineerDbId && assignedEngineerName) {
            let preparedEng = newEngineers.get(cleanEmail);
            if (!preparedEng) {
              const userId = userMap.get(cleanEmail) || randomUUID();
              engineerDbId = randomUUID();

              if (!userMap.has(cleanEmail)) {
                newUsers.set(cleanEmail, {
                  id: userId,
                  email: cleanEmail,
                  fullName: assignedEngineerName,
                  passwordHash: engPassword,
                  roleId: engineerRole.id
                });
              }

              preparedEng = {
                id: engineerDbId,
                userId,
                name: assignedEngineerName.trim(),
                email: cleanEmail,
                phone: engineerPhone.trim(),
                stateId,
                districtId
              };
              newEngineers.set(cleanEmail, preparedEng);
            } else {
              engineerDbId = preparedEng.id;
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

        // Generate deterministic ticket number using row number and complaint/submission date prefix
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

        const ticketId = randomUUID();
        tickets.push({
          id: ticketId,
          ticketNumber: finalTicketNumber,
          complaintId,
          status: liveStage,
          priority: priority,
          createdAt: complaintDate,
          dueDate: new Date(complaintDate.getTime() + 72 * 60 * 60 * 1000),
          metadata: rowMetadata
        });

        // Assignments array
        if (engineerDbId) {
          ticketAssignments.push({
            id: randomUUID(),
            ticketId,
            engineerId: engineerDbId,
            assignedAt: complaintDate
          });
        }

        // Visits array
        if (initialVisitDateStr && engineerDbId) {
          initialVisits.push({
            id: randomUUID(),
            ticketId,
            engineerId: engineerDbId,
            visitDate: parseSafeDate(initialVisitDateStr) || complaintDate,
            remarks: "Completed diagnostic check on pump."
          });
        }

        // Service Reports array
        if (serviceReportDateStr) {
          serviceReports.push({
            id: randomUUID(),
            ticketId,
            reportDate: parseSafeDate(serviceReportDateStr) || complaintDate,
            workDone: "Inspected wiring and restored system operation.",
            status: "COMPLETED"
          });
        }

        // Material Requests array
        if (materialStatusStr && materialStatusStr !== "N/A" && engineerDbId) {
          const materialRequestId = randomUUID();
          const materialStatusClean = materialStatusStr.toUpperCase() === "SUBMITTED" ? "PENDING" : materialStatusStr.toUpperCase();
          materialRequests.push({
            id: materialRequestId,
            ticketId,
            requestedBy: engineerDbId,
            status: materialStatusClean,
            remarks: "Required solar components."
          });
          materialRequestItems.push({
            id: randomUUID(),
            materialRequestId,
            itemName: "Solar Pump Controller Card",
            quantity: 1
          });
        }

        // History logs array
        ticketHistories.push({
          id: randomUUID(),
          ticketId,
          newStatus: liveStage,
          changeSummary: "Ticket synced from Google Sheets."
        });
      }

      // 6. Execute all deletions and creations inside ONE atomic interactive transaction
      await prisma.$transaction(async (tx) => {
        // Create new States
        if (newStates.size > 0) {
          await tx.state.createMany({
            data: Array.from(newStates.values()),
            skipDuplicates: true
          });
        }

        // Create new Districts
        if (newDistricts.size > 0) {
          await tx.district.createMany({
            data: Array.from(newDistricts.values()),
            skipDuplicates: true
          });
        }

        // Create new Users
        if (newUsers.size > 0) {
          await tx.user.createMany({
            data: Array.from(newUsers.values()),
            skipDuplicates: true
          });
        }

        // Create new Engineers
        if (newEngineers.size > 0) {
          await tx.engineer.createMany({
            data: Array.from(newEngineers.values()),
            skipDuplicates: true
          });
        }

        // Create new installations
        if (installationsToCreate.length > 0) {
          await tx.masterInstallation.createMany({
            data: installationsToCreate,
            skipDuplicates: true
          });
        }

        // Update modified installations
        for (const inst of installationsToUpdate) {
          await tx.masterInstallation.update({
            where: { id: inst.id },
            data: {
              clientName: inst.clientName,
              address: inst.address,
              stateId: inst.stateId,
              districtId: inst.districtId,
              installationDate: inst.installationDate
            }
          });
        }

        // Clear transactional history (except permanent installations / user / engineer structures)
        await tx.syncLog.deleteMany();
        await tx.ticketHistory.deleteMany();
        await tx.initialVisit.deleteMany();
        await tx.serviceReport.deleteMany();
        await tx.materialRequestItem.deleteMany();
        await tx.materialRequest.deleteMany();
        await tx.ticketAssignment.deleteMany();
        await tx.ticket.deleteMany();
        await tx.complaint.deleteMany();

        // Write fresh transaction data rows
        await tx.complaint.createMany({ data: complaints, skipDuplicates: true });
        await tx.ticket.createMany({ data: tickets, skipDuplicates: true });
        await tx.ticketAssignment.createMany({ data: ticketAssignments, skipDuplicates: true });
        await tx.initialVisit.createMany({ data: initialVisits, skipDuplicates: true });
        await tx.serviceReport.createMany({ data: serviceReports, skipDuplicates: true });
        await tx.materialRequest.createMany({ data: materialRequests, skipDuplicates: true });
        await tx.materialRequestItem.createMany({ data: materialRequestItems, skipDuplicates: true });
        await tx.ticketHistory.createMany({ data: ticketHistories, skipDuplicates: true });

      }, {
        timeout: 45000 // 45s timeout limit for large workbook loads
      });

      return {
        installationsCount: processedInstallations.size,
        ticketsCount: tickets.length
      };

    } finally {
      // Always unlock the mutex lock
      isSyncing = false;
    }
  }
};

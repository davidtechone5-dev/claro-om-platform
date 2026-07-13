import { prisma } from "../db.js";
import { parseCSV } from "../utils/csv.js";
import { parseSafeDate } from "../utils/date.js";
import { normalizeStatus, normalizePriority } from "../utils/status.js";
import { engineerService } from "./engineer.service.js";
import { ticketService } from "./ticket.service.js";
import { randomUUID } from "crypto";

export const syncService = {
  /**
   * Synchronizes the entire database from the consolidated Google Sheets CSV export.
   */
  async syncFullSheet(spreadsheetId: string, gid?: string) {
    console.log("🔄 Starting full sync service processing...");

    // 1. Fetch CSV contents
    const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv${gid ? `&gid=${gid}` : ""}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch spreadsheet: ${response.statusText}`);
    }
    const csvText = await response.text();

    // 2. Parse CSV
    const rows = parseCSV(csvText);
    if (rows.length < 2) {
      throw new Error("Spreadsheet contains no data rows.");
    }

    const headers = rows[0].map(h => h.trim().replace(/^\uFEFF/, ""));
    const dataRows = rows.slice(1);

    // 3. Clear database tables (except master_installations)
    await prisma.$transaction([
      prisma.syncLog.deleteMany(),
      prisma.ticketHistory.deleteMany(),
      prisma.initialVisit.deleteMany(),
      prisma.serviceReport.deleteMany(),
      prisma.materialRequestItem.deleteMany(),
      prisma.materialRequest.deleteMany(),
      prisma.ticketAssignment.deleteMany(),
      prisma.ticket.deleteMany(),
      prisma.complaint.deleteMany()
    ]);

    // 4. Seed basic roles & retrieve administrators
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

    // 5. Pre-fetch engineers, states, and districts to avoid inline queries
    const engineers = await prisma.engineer.findMany();
    const engineerMap = new Map<string, string>();
    engineers.forEach(e => {
      engineerMap.set(e.email.toLowerCase().trim(), e.id);
    });

    const states = await prisma.state.findMany();
    const stateMap = new Map<string, string>();
    states.forEach(s => {
      stateMap.set(s.name.toLowerCase().trim(), s.id);
    });

    const districts = await prisma.district.findMany();
    const districtMap = new Map<string, string>();
    districts.forEach(d => {
      districtMap.set(`${d.stateId}:${d.name.toLowerCase().trim()}`, d.id);
    });

    // Batch insertion arrays
    const masterInstallationsMap = new Map<string, any>();
    const complaints: any[] = [];
    const tickets: any[] = [];
    const ticketAssignments: any[] = [];
    const initialVisits: any[] = [];
    const serviceReports: any[] = [];
    const materialRequests: any[] = [];
    const materialRequestItems: any[] = [];
    const ticketHistories: any[] = [];

    const processedInstallations = new Set<string>();
    const processedTicketNumbers = new Set<string>();

    // Helper functions for CSV extraction
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

      let finalAppId = applicationId ? applicationId.trim().toUpperCase() : "";
      if (!finalAppId) {
        if (!clientName && !ticketNumberStr && !complaintDateStr) {
          continue;
        }
        finalAppId = "N/A";
      }

      // Upsert State & District dynamically
      let stateId = (finalAppId !== "N/A" && stateStr) ? stateMap.get(stateStr.toLowerCase().trim()) : null;
      if (finalAppId !== "N/A" && stateStr && !stateId) {
        const newState = await prisma.state.upsert({
          where: { name: stateStr },
          update: {},
          create: { name: stateStr }
        });
        stateId = newState.id;
        stateMap.set(stateStr.toLowerCase().trim(), stateId);
      }

      let districtId = (finalAppId !== "N/A" && stateId && districtStr) ? districtMap.get(`${stateId}:${districtStr.toLowerCase().trim()}`) : null;
      if (finalAppId !== "N/A" && stateId && districtStr && !districtId) {
        const newDistrict = await prisma.district.upsert({
          where: { uq_state_district: { stateId, name: districtStr } },
          update: {},
          create: { stateId, name: districtStr }
        });
        districtId = newDistrict.id;
        districtMap.set(`${stateId}:${districtStr.toLowerCase().trim()}`, districtId);
      }

      const installationDate = parseSafeDate(installationDateStr);
      const complaintDate = parseSafeDate(complaintDateStr) || new Date();

      // Upsert physical installation
      if (!processedInstallations.has(finalAppId)) {
        await prisma.masterInstallation.upsert({
          where: { applicationId: finalAppId },
          update: {
            clientName: finalAppId === "N/A" ? "N/A" : clientName.trim(),
            address: finalAppId === "N/A" ? "N/A" : `${districtStr.trim()}, ${stateStr.trim()}`,
            stateId,
            districtId,
            installationDate
          },
          create: {
            applicationId: finalAppId,
            clientName: finalAppId === "N/A" ? "N/A" : clientName.trim(),
            address: finalAppId === "N/A" ? "N/A" : `${districtStr.trim()}, ${stateStr.trim()}`,
            stateId,
            districtId,
            installationDate
          }
        });
        processedInstallations.add(finalAppId);
      }

      // Metadata mapping
      const rowMetadata: Record<string, any> = {};
      headers.forEach((h, i) => {
        rowMetadata[h] = row[i] || "";
      });

      // Construct complaint
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

      // Upsert Engineer account
      let engineerDbId: string | null = null;
      if (engineerEmail && engineerEmail.trim()) {
        const cleanEmail = engineerEmail.trim().toLowerCase();
        engineerDbId = engineerMap.get(cleanEmail) || null;

        if (!engineerDbId && assignedEngineerName) {
          const user = await prisma.user.upsert({
            where: { email: cleanEmail },
            update: { fullName: assignedEngineerName },
            create: {
              email: cleanEmail,
              fullName: assignedEngineerName,
              passwordHash: engPassword,
              roleId: engineerRole.id
            }
          });

          const newEng = await prisma.engineer.create({
            data: {
              userId: user.id,
              name: assignedEngineerName.trim(),
              email: cleanEmail,
              phone: engineerPhone.trim(),
              stateId,
              districtId
            }
          });
          engineerDbId = newEng.id;
          engineerMap.set(cleanEmail, engineerDbId);
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

      let finalTicketNumber = ticketNumberStr ? ticketNumberStr.trim().toUpperCase() : "";
      if (!finalTicketNumber) {
        finalTicketNumber = `CLR-${rowNumber}-${Math.floor(1000 + Math.random() * 9000)}`;
      }

      // Deduplicate ticket numbers in memory
      if (processedTicketNumbers.has(finalTicketNumber)) {
        continue;
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

      // Construct assignments
      if (engineerDbId) {
        ticketAssignments.push({
          id: randomUUID(),
          ticketId,
          engineerId: engineerDbId,
          assignedAt: complaintDate
        });
      }

      // Construct Initial Visits
      if (initialVisitDateStr && engineerDbId) {
        initialVisits.push({
          id: randomUUID(),
          ticketId,
          engineerId: engineerDbId,
          visitDate: parseSafeDate(initialVisitDateStr) || complaintDate,
          remarks: "Completed diagnostic check on pump."
        });
      }

      // Construct Service Reports
      if (serviceReportDateStr) {
        serviceReports.push({
          id: randomUUID(),
          ticketId,
          reportDate: parseSafeDate(serviceReportDateStr) || complaintDate,
          workDone: "Inspected wiring and restored system operation.",
          status: "COMPLETED"
        });
      }

      // Construct Material Requests
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

      // Construct history logs
      ticketHistories.push({
        id: randomUUID(),
        ticketId,
        newStatus: liveStage,
        changeSummary: "Ticket synced from Google Sheets."
      });
    }

    // Write all transactional objects
    await prisma.$transaction([
      prisma.complaint.createMany({ data: complaints, skipDuplicates: true }),
      prisma.ticket.createMany({ data: tickets, skipDuplicates: true }),
      prisma.ticketAssignment.createMany({ data: ticketAssignments, skipDuplicates: true }),
      prisma.initialVisit.createMany({ data: initialVisits, skipDuplicates: true }),
      prisma.serviceReport.createMany({ data: serviceReports, skipDuplicates: true }),
      prisma.materialRequest.createMany({ data: materialRequests, skipDuplicates: true }),
      prisma.materialRequestItem.createMany({ data: materialRequestItems, skipDuplicates: true }),
      prisma.ticketHistory.createMany({ data: ticketHistories, skipDuplicates: true })
    ]);

    return {
      installationsCount: processedInstallations.size,
      ticketsCount: tickets.length
    };
  }
};

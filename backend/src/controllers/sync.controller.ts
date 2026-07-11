import { Request, Response } from "express";
import { randomUUID } from "crypto";
import { prisma } from "../db.js";
import { assignmentService } from "../services/assignment.service.js";

export const syncController = {
  /**
   * Sync Complaint Form Submissions
   * POST /api/v1/sync/complaint
   */
  async syncComplaint(req: Request, res: Response) {
    const payload = req.body;
    const rowNumber = payload.__row_number || 0;
    const sheetName = payload.__sheet_name || "Complaint Form";

    // Extract sheet parameters based on standard naming and trim whitespace
    const applicationId = (payload["Application ID"] || payload["application_id"])?.toString().trim();
    const complainantName = (payload["Customer Name"] || payload["Complainant Name"] || payload["Name"] || payload["complainant_name"] || "Unknown Client").toString().trim();
    const complainantPhone = (payload["Customer Phone"] || payload["Complainant Phone"] || payload["Phone"] || payload["complainant_phone"] || "N/A").toString().trim();
    const complaintType = (payload["Issue Type"] || payload["Complaint Type"] || payload["complaint_type"] || "General").toString().trim();
    const description = (payload["Description"] || payload["description"] || "").toString().trim();
    const ticketNumberFromPayload = (payload["Ticket ID"] || payload["ticket_number"] || "")?.toString().trim();
    const assignedEngineerName = (payload["Assigned Engineer Name"] || payload["Engineer assigned"] || "").toString().trim();
    const engineerEmail = (payload["Engineer Email"] || "").toString().trim();
    const engineerPhone = (payload["Engineer Phone"] || "").toString().trim();
    const initialVisitDateStr = (payload["Initial Visit Date"] || "").toString().trim();
    const serviceReportDateStr = (payload["Service Report Date"] || "").toString().trim();
    const materialStatusStr = (payload["Material Status"] || "").toString().trim();
    const timestampStr = payload["Timestamp"] || new Date().toISOString();

    console.log("📥 Incoming webhook payload keys:", Object.keys(payload));
    console.log(`📥 Row: ${rowNumber} | Application ID: '${applicationId}' | Ticket ID from payload: '${ticketNumberFromPayload}'`);

    if (!applicationId) {
      const errorMsg = "Missing required parameter 'Application ID'";
      await prisma.syncLog.create({
        data: { sheetName, rowNumber, status: "FAILED", errorMessage: errorMsg }
      });
      return res.status(400).json({ detail: errorMsg });
    }

    try {
      // 1. Validate application exists in master installations database
      const installation = await prisma.masterInstallation.findUnique({
        where: { applicationId }
      });

      if (!installation) {
        const errorMsg = `Invalid Application ID: ${applicationId} is not registered in Master Installations.`;
        await prisma.syncLog.create({
          data: { sheetName, rowNumber, status: "FAILED", errorMessage: errorMsg }
        });
        return res.status(400).json({ detail: errorMsg });
      }

      // 1.5. Prevent duplicate ticket logs if this row was already synced
      // Or if the Ticket ID is already present in the sheet and exists in the DB
      let existingTicket = null;
      if (ticketNumberFromPayload) {
        existingTicket = await prisma.ticket.findUnique({
          where: { ticketNumber: ticketNumberFromPayload },
          include: { complaint: { include: { tickets: true } } }
        });
      }

      const existingComplaint = existingTicket?.complaint || await prisma.complaint.findFirst({
        where: {
          formResponseId: rowNumber.toString(),
          applicationId
        },
        include: {
          tickets: true
        }
      });

      console.log(`🔍 Lookup Result - existingTicket:`, existingTicket ? existingTicket.ticketNumber : 'null');
      console.log(`🔍 Lookup Result - existingComplaint found:`, existingComplaint ? 'YES' : 'NO');

      if (existingComplaint && existingComplaint.tickets.length > 0) {
        // Update the existing complaint with new details from the sheet
        await prisma.complaint.update({
          where: { id: existingComplaint.id },
          data: {
            complainantName,
            complainantPhone,
            complaintType,
            description,
            submissionTimestamp: new Date(timestampStr),
            metadata: payload
          }
        });

        const ticket = existingComplaint.tickets[0];

        // Seed/retrieve role and admin user to map associations
        const adminRole = await prisma.role.upsert({
          where: { name: "Admin" },
          update: {},
          create: { name: "Admin", description: "System Administrator" }
        });

        const adminUser = await prisma.user.upsert({
          where: { email: "admin@claro.com" },
          update: {},
          create: {
            id: "admin-default-id",
            email: "admin@claro.com",
            fullName: "System Admin",
            passwordHash: "$2b$10$tM2LdskVp1Jz/KxX9.jXKeX6g9nK1lH4B2FwYxI49lG1E1E1E1E1E",
            roleId: adminRole.id
          }
        });
        const adminId = adminUser.id;

        // Update Engineer Assignment if changed
        let engineerProfileId: string | null = null;

        if (assignedEngineerName && engineerEmail) {
          const engineer = await prisma.engineer.upsert({
            where: { email: engineerEmail },
            update: { name: assignedEngineerName, phone: engineerPhone },
            create: { name: assignedEngineerName, email: engineerEmail, phone: engineerPhone }
          });
          engineerProfileId = engineer.id;

          // Re-create cleanly
          await prisma.ticketAssignment.deleteMany({
            where: { ticketId: ticket.id }
          });

          await prisma.ticketAssignment.create({
            data: {
              ticketId: ticket.id,
              engineerId: engineer.id,
              assignedBy: adminId,
              assignedAt: new Date()
            }
          });

          // Check if the ticket should move status to ASSIGNED if currently RECEIVED
          if (ticket.status === "RECEIVED") {
            await prisma.ticket.update({
              where: { id: ticket.id },
              data: { status: "ASSIGNED" }
            });
          }
        } else if (!assignedEngineerName || assignedEngineerName === "N/A" || assignedEngineerName === "") {
          // If engineer details cleared, wipe current assignments
          await prisma.ticketAssignment.deleteMany({
            where: { ticketId: ticket.id }
          });
        } else {
          // Retrieve currently assigned engineer if not updating
          const currentAssignment = await prisma.ticketAssignment.findFirst({
            where: { ticketId: ticket.id }
          });
          if (currentAssignment) {
            engineerProfileId = currentAssignment.engineerId;
          }
        }

        // Helper to parse dates safely
        const parseSafeDate = (dStr: string) => {
          if (!dStr) return null;
          const parsed = new Date(dStr);
          return isNaN(parsed.getTime()) ? null : parsed;
        };

        const visitDate = parseSafeDate(initialVisitDateStr);
        const reportDate = parseSafeDate(serviceReportDateStr);

        let resolvedStatus = ticket.status;

        // 1. Update Initial Visit if provided
        if (visitDate && engineerProfileId) {
          await prisma.initialVisit.deleteMany({
            where: { ticketId: ticket.id }
          });
          await prisma.initialVisit.create({
            data: {
              ticketId: ticket.id,
              engineerId: engineerProfileId,
              visitDate,
              remarks: "Completed diagnostic check."
            }
          });
          if (resolvedStatus === "ASSIGNED" || resolvedStatus === "RECEIVED") {
            resolvedStatus = "INITIAL_VISIT_COMPLETED";
          }
        }

        // 2. Update Material Request if status changed
        if (materialStatusStr && materialStatusStr !== "N/A" && engineerProfileId) {
          const statusVal = materialStatusStr.toUpperCase() === "SUBMITTED" ? "PENDING" : materialStatusStr.toUpperCase();
          await prisma.materialRequest.deleteMany({
            where: { ticketId: ticket.id }
          });
          const matRequest = await prisma.materialRequest.create({
            data: {
              ticketId: ticket.id,
              requestedBy: engineerProfileId,
              status: statusVal,
              remarks: "Required solar components."
            }
          });
          await prisma.materialRequestItem.create({
            data: {
              materialRequestId: matRequest.id,
              itemName: "Solar Pump Controller Card",
              quantity: 1
            }
          });
          if (resolvedStatus !== "RESOLVED") {
            resolvedStatus = "MATERIAL_REQUESTED";
          }
        }

        // 3. Update Service Report if resolution date provided
        if (reportDate) {
          await prisma.serviceReport.deleteMany({
            where: { ticketId: ticket.id }
          });
          await prisma.serviceReport.create({
            data: {
              ticketId: ticket.id,
              reportDate,
              workDone: "Inspected wiring and restored system operation.",
              status: "COMPLETED"
            }
          });
          resolvedStatus = "RESOLVED";
        }

        // Update Ticket Status and Metadata
        await prisma.ticket.update({
          where: { id: ticket.id },
          data: { 
            status: resolvedStatus,
            metadata: payload
          }
        });

        return res.status(200).json({
          ticketNumber: ticket.ticketNumber,
          detail: "Ticket updated successfully from Google Sheets."
        });
      }

      // 2. Create Complaint record
      const complaint = await prisma.complaint.create({
        data: {
          formResponseId: rowNumber.toString(),
          applicationId,
          complainantName,
          complainantPhone,
          complaintType,
          description,
          submissionTimestamp: new Date(timestampStr),
          syncStatus: "SYNCED",
          metadata: payload
        }
      });

      // 3. Generate Ticket ID (format: CLR-YYMMDD-XXXX)
      const now = new Date();
      const yy = now.getFullYear().toString().slice(-2);
      const mm = (now.getMonth() + 1).toString().padStart(2, '0');
      const dd = now.getDate().toString().padStart(2, '0');
      const datePrefix = `CLR-${yy}${mm}${dd}`;

      // Count tickets created today to generate sequential 4-digit number
      const todayCount = await prisma.ticket.count({
        where: {
          ticketNumber: {
            startsWith: datePrefix
          }
        }
      });
      const sequence = (todayCount + 1).toString().padStart(4, '0');
      const ticketNumber = `${datePrefix}-${sequence}`;

      // 4. Create Ticket
      const ticket = await prisma.ticket.create({
        data: {
          ticketNumber,
          complaintId: complaint.id,
          status: "RECEIVED",
          priority: (payload["Priority"] || payload["priority"] || "STANDARD").toString().trim(),
          metadata: payload
        }
      });

      // Create history entry
      await prisma.ticketHistory.create({
        data: {
          ticketId: ticket.id,
          newStatus: "RECEIVED",
          changeSummary: "Ticket created successfully from synced Google Form complaint."
        }
      });

      // 5. Trigger auto-assignment service
      const assignedEngineerId = await assignmentService.assignEngineerToTicket(ticket.id, applicationId);

      let finalStatus = "RECEIVED";
      if (!assignedEngineerId) {
        // Update status if no engineer matches
        finalStatus = "MANUAL_ASSIGNMENT_REQUIRED";
        await prisma.ticket.update({
          where: { id: ticket.id },
          data: { status: finalStatus }
        });

        await prisma.ticketHistory.create({
          data: {
            ticketId: ticket.id,
            newStatus: finalStatus,
            oldStatus: "RECEIVED",
            changeSummary: "System could not auto-assign ticket. Placed in queue for Manual Assignment."
          }
        });
      } else {
        finalStatus = "ASSIGNED";
      }

      // Log success
      await prisma.syncLog.create({
        data: { sheetName, rowNumber, status: "SUCCESS" }
      });

      return res.status(200).json({
        ticketNumber,
        status: finalStatus
      });

    } catch (e: any) {
      console.error("Complaint sync error:", e);
      await prisma.syncLog.create({
        data: { sheetName, rowNumber, status: "FAILED", errorMessage: e.message }
      });
      return res.status(500).json({ detail: `Complaint Sync Error: ${e.message}` });
    }
  },

  /**
   * Sync Initial Visit Submissions
   * POST /api/v1/sync/visit
   */
  async syncVisit(req: Request, res: Response) {
    const payload = req.body;
    const rowNumber = payload.__row_number || 0;
    const sheetName = payload.__sheet_name || "Initial Visit Form";

    const ticketNumber = payload["Ticket ID"] || payload["Ticket Number"] || payload["ticket_number"];
    const visitRemarks = payload["Remarks"] || payload["remarks"] || "";
    const timestampStr = payload["Timestamp"] || new Date().toISOString();

    if (!ticketNumber) {
      return res.status(400).json({ detail: "Missing required 'Ticket ID' parameter." });
    }

    try {
      const ticket = await prisma.ticket.findUnique({
        where: { ticketNumber },
        include: { assignments: { where: { deletedAt: null } } }
      });

      if (!ticket) {
        return res.status(404).json({ detail: `Ticket ${ticketNumber} not found.` });
      }

      // Identify active assignment engineer
      const activeAssignment = ticket.assignments[0];
      if (!activeAssignment) {
        return res.status(400).json({ detail: `No engineer is currently assigned to Ticket ${ticketNumber}.` });
      }

      // Create Initial Visit record
      await prisma.initialVisit.create({
        data: {
          ticketId: ticket.id,
          engineerId: activeAssignment.engineerId,
          visitDate: new Date(timestampStr),
          remarks: visitRemarks
        }
      });

      // Update Ticket status
      const oldStatus = ticket.status;
      const newStatus = "INITIAL_VISIT_COMPLETED";

      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { status: newStatus }
      });

      await prisma.ticketHistory.create({
        data: {
          ticketId: ticket.id,
          newStatus,
          oldStatus,
          changeSummary: "Engineer completed initial visit and recorded remarks."
        }
      });

      await prisma.syncLog.create({
        data: { sheetName, rowNumber, status: "SUCCESS" }
      });

      return res.status(200).json({ detail: "Initial Visit synchronized successfully." });
    } catch (e: any) {
      console.error("Visit sync error:", e);
      await prisma.syncLog.create({
        data: { sheetName, rowNumber, status: "FAILED", errorMessage: e.message }
      });
      return res.status(500).json({ detail: `Visit Sync Error: ${e.message}` });
    }
  },

  /**
   * Sync Material Request Submissions
   * POST /api/v1/sync/material-request
   */
  async syncMaterialRequest(req: Request, res: Response) {
    const payload = req.body;
    const rowNumber = payload.__row_number || 0;
    const sheetName = payload.__sheet_name || "Material Request Form";

    const ticketNumber = payload["Ticket ID"] || payload["ticket_number"];
    const itemsText = payload["Items"] || payload["items"] || ""; // E.g. "Pipe (2), Valve (1)"
    const remarks = payload["Remarks"] || payload["remarks"] || "";

    if (!ticketNumber) {
      return res.status(400).json({ detail: "Missing required 'Ticket ID' parameter." });
    }

    try {
      const ticket = await prisma.ticket.findUnique({
        where: { ticketNumber },
        include: { assignments: { where: { deletedAt: null } } }
      });

      if (!ticket) {
        return res.status(404).json({ detail: `Ticket ${ticketNumber} not found.` });
      }

      const activeAssignment = ticket.assignments[0];
      if (!activeAssignment) {
        return res.status(400).json({ detail: `No engineer assigned to Ticket ${ticketNumber}.` });
      }

      // Create Material Request (pending warehouse manager review)
      const materialRequest = await prisma.materialRequest.create({
        data: {
          ticketId: ticket.id,
          requestedBy: activeAssignment.engineerId,
          status: "PENDING",
          remarks: remarks
        }
      });

      // Parse items text (Simple CSV parse e.g. "ItemA (5), ItemB (2)")
      // We will parse them into rows in material_request_items
      const itemsList = itemsText.split(",");
      for (let itemStr of itemsList) {
        itemStr = itemStr.trim();
        if (!itemStr) continue;

        let itemName = itemStr;
        let quantity = 1;

        // Try extracting quantity if formatted like "Valve (3)" or "Pipe - 2"
        const qtyMatch = itemStr.match(/\(([^)]+)\)/) || itemStr.match(/- (\d+)/);
        if (qtyMatch) {
          quantity = parseInt(qtyMatch[1], 10) || 1;
          itemName = itemStr.replace(qtyMatch[0], "").trim();
        }

        await prisma.materialRequestItem.create({
          data: {
            materialRequestId: materialRequest.id,
            itemName,
            quantity
          }
        });
      }

      // Update Ticket status
      const oldStatus = ticket.status;
      const newStatus = "MATERIAL_REQUESTED";

      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { status: newStatus }
      });

      await prisma.ticketHistory.create({
        data: {
          ticketId: ticket.id,
          newStatus,
          oldStatus,
          changeSummary: `Engineer requested materials: ${itemsText}`
        }
      });

      await prisma.syncLog.create({
        data: { sheetName, rowNumber, status: "SUCCESS" }
      });

      return res.status(200).json({ detail: "Material request synchronized successfully." });
    } catch (e: any) {
      console.error("Material sync error:", e);
      await prisma.syncLog.create({
        data: { sheetName, rowNumber, status: "FAILED", errorMessage: e.message }
      });
      return res.status(500).json({ detail: `Material Sync Error: ${e.message}` });
    }
  },

  /**
   * Sync Insurance Submission Form
   * POST /api/v1/sync/insurance
   */
  async syncInsurance(req: Request, res: Response) {
    const payload = req.body;
    const rowNumber = payload.__row_number || 0;
    const sheetName = payload.__sheet_name || "Insurance Form";

    const ticketNumber = payload["Ticket ID"] || payload["ticket_number"];
    const claimNumber = payload["Claim Number"] || payload["claim_number"] || `CLM-${Date.now()}`;
    const providerName = payload["Provider"] || payload["provider"] || "Claro Insurance";
    const amountStr = payload["Estimated Amount"] || payload["amount"] || "0";
    const remarks = payload["Remarks"] || payload["remarks"] || "";

    if (!ticketNumber) {
      return res.status(400).json({ detail: "Missing required 'Ticket ID' parameter." });
    }

    try {
      const ticket = await prisma.ticket.findUnique({
        where: { ticketNumber }
      });

      if (!ticket) {
        return res.status(404).json({ detail: `Ticket ${ticketNumber} not found.` });
      }

      // Create Insurance Claim
      await prisma.insuranceClaim.create({
        data: {
          ticketId: ticket.id,
          claimNumber,
          providerName,
          amountEstimated: parseFloat(amountStr) || 0,
          status: "SUBMITTED",
          remarks
        }
      });

      // Update Ticket status
      const oldStatus = ticket.status;
      const newStatus = "INSURANCE_SUBMITTED";

      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { status: newStatus }
      });

      await prisma.ticketHistory.create({
        data: {
          ticketId: ticket.id,
          newStatus,
          oldStatus,
          changeSummary: `Insurance claim submitted: #${claimNumber} ($${amountStr})`
        }
      });

      await prisma.syncLog.create({
        data: { sheetName, rowNumber, status: "SUCCESS" }
      });

      return res.status(200).json({ detail: "Insurance claim synced successfully." });
    } catch (e: any) {
      console.error("Insurance sync error:", e);
      await prisma.syncLog.create({
        data: { sheetName, rowNumber, status: "FAILED", errorMessage: e.message }
      });
      return res.status(500).json({ detail: `Insurance Sync Error: ${e.message}` });
    }
  },

  /**
   * Sync Service Report Submissions
   * POST /api/v1/sync/service-report
   */
  async syncServiceReport(req: Request, res: Response) {
    const payload = req.body;
    const rowNumber = payload.__row_number || 0;
    const sheetName = payload.__sheet_name || "Service Report Form";

    const ticketNumber = payload["Ticket ID"] || payload["ticket_number"];
    const workDone = payload["Work Done"] || payload["work_done"] || "Repair work finished";
    const isCompletedStr = payload["Is Completed"] || payload["completed"] || "Yes";
    const timestampStr = payload["Timestamp"] || new Date().toISOString();

    if (!ticketNumber) {
      return res.status(400).json({ detail: "Missing required 'Ticket ID' parameter." });
    }

    try {
      const ticket = await prisma.ticket.findUnique({
        where: { ticketNumber }
      });

      if (!ticket) {
        return res.status(404).json({ detail: `Ticket ${ticketNumber} not found.` });
      }

      // Calculate Turnaround Time (TAT) in minutes
      const reportDate = new Date(timestampStr);
      const ticketCreatedDate = new Date(ticket.createdAt);
      const diffMs = reportDate.getTime() - ticketCreatedDate.getTime();
      const tatMinutes = Math.max(0, Math.floor(diffMs / (1000 * 60)));

      const isCompleted = isCompletedStr.toLowerCase() === "yes" || isCompletedStr === "true";
      const status = isCompleted ? "RESOLVED" : "IN_PROGRESS";

      // Create Service Report
      await prisma.serviceReport.create({
        data: {
          ticketId: ticket.id,
          reportDate,
          workDone,
          tatMinutes,
          status: isCompleted ? "COMPLETED" : "PARTIALLY_COMPLETED"
        }
      });

      // Update Ticket status
      const oldStatus = ticket.status;

      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { status }
      });

      await prisma.ticketHistory.create({
        data: {
          ticketId: ticket.id,
          newStatus: status,
          oldStatus,
          changeSummary: `Service Report submitted. Action: ${status}. Calculated TAT: ${tatMinutes} mins.`
        }
      });

      await prisma.syncLog.create({
        data: { sheetName, rowNumber, status: "SUCCESS" }
      });

      return res.status(200).json({ detail: "Service report synced and ticket updated." });
    } catch (e: any) {
      console.error("Service report sync error:", e);
      await prisma.syncLog.create({
        data: { sheetName, rowNumber, status: "FAILED", errorMessage: e.message }
      });
      return res.status(500).json({ detail: `Service Report Sync Error: ${e.message}` });
    }
  },

  /**
   * Complete database clean reload from Google Sheets consolidated tab
   * POST /api/v1/sync/full
   */
  async syncFullSheet(req: Request, res: Response) {
    let SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
    if (SPREADSHEET_ID && SPREADSHEET_ID.includes("docs.google.com/spreadsheets")) {
      const match = SPREADSHEET_ID.match(/\/d\/([^/]+)/);
      if (match) {
        SPREADSHEET_ID = match[1];
      }
    }

    if (!SPREADSHEET_ID) {
      return res.status(500).json({ detail: "GOOGLE_SPREADSHEET_ID is not configured in backend environment." });
    }

    try {
      console.log("🔄 Starting Full Database Clean Sync from Google Sheets...");

      // 1. Fetch spreadsheet content as CSV
      const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv`;
      const fetchRes = await fetch(url);
      if (!fetchRes.ok) {
        return res.status(502).json({ detail: `Failed to download spreadsheet: ${fetchRes.statusText}` });
      }
      const csvText = await fetchRes.text();

      // Parse CSV
      const lines = csvText.split(/\r?\n/);
      const rows = lines
        .map((line) => {
          const result: string[] = [];
          let current = "";
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === "," && !inQuotes) {
              result.push(current.trim());
              current = "";
            } else {
              current += char;
            }
          }
          result.push(current.trim());
          return result.map((val) => val.replace(/^"|"$/g, "").trim());
        })
        .filter((row) => row.length > 0 && row.some((cell) => cell !== ""));

      if (rows.length < 2) {
        return res.status(400).json({ detail: "Downloaded spreadsheet contains no data rows." });
      }

      // Extract headers from Row 1 and normalize them (BOM-safe and case/space-safe)
      const headers = rows[0].map((h) => h.trim().replace(/^\uFEFF/, ""));
      const dataRows = rows.slice(1);

      // 2. Clear dynamic tables to mirror deletions!
      await prisma.$transaction([
        prisma.syncLog.deleteMany(),
        prisma.ticketHistory.deleteMany(),
        prisma.initialVisit.deleteMany(),
        prisma.serviceReport.deleteMany(),
        prisma.materialRequestItem.deleteMany(),
        prisma.materialRequest.deleteMany(),
        prisma.ticketAssignment.deleteMany(),
        prisma.ticket.deleteMany(),
        prisma.complaint.deleteMany(),
        prisma.masterInstallation.deleteMany()
      ]);

      // Seed/retrieve role and admin user to map associations
      const adminRole = await prisma.role.upsert({
        where: { name: "Admin" },
        update: {},
        create: { name: "Admin", description: "System Administrator" }
      });

      const adminUser = await prisma.user.upsert({
        where: { email: "admin@claro.com" },
        update: {},
        create: {
          id: "admin-default-id",
          email: "admin@claro.com",
          fullName: "System Admin",
          passwordHash: "$2b$10$tM2LdskVp1Jz/KxX9.jXKeX6g9nK1lH4B2FwYxI49lG1E1E1E1E1E",
          roleId: adminRole.id
        }
      });
      const adminId = adminUser.id;

      // --- OPTIMIZATION STEP 1: Pre-process States, Districts, and Engineers ---
      // Collect unique state names, district names, and engineers from sheet rows
      const uniqueStates = new Set<string>();
      const stateDistricts = new Map<string, Set<string>>(); // state -> districts
      const uniqueEngineers = new Map<string, { name: string, email: string, phone: string }>(); // email -> details

      for (const row of dataRows) {
        const getVal = (colName: string) => {
          const idx = headers.indexOf(colName);
          return idx !== -1 ? row[idx] : "";
        };
        const stateStr = getVal("State") || "Maharashtra";
        const districtStr = getVal("District") || "Unknown";
        if (stateStr) {
          uniqueStates.add(stateStr);
          if (!stateDistricts.has(stateStr)) {
            stateDistricts.set(stateStr, new Set());
          }
          if (districtStr) {
            stateDistricts.get(stateStr)!.add(districtStr);
          }
        }

        const assignedEngineerName = getVal("Assigned Engineer Name");
        const engineerEmail = getVal("Engineer Email") || getVal("Assigned Engineer Email");
        const engineerPhone = getVal("Engineer Phone") || getVal("Assigned Engineer Phone");
        if (assignedEngineerName && engineerEmail && engineerEmail.trim() !== "" && engineerEmail.includes("@")) {
          const emailTrim = engineerEmail.trim().toLowerCase();
          if (!uniqueEngineers.has(emailTrim)) {
            uniqueEngineers.set(emailTrim, {
              name: assignedEngineerName.trim(),
              email: emailTrim,
              phone: engineerPhone.trim() || "N/A"
            });
          }
        }
      }

      // Upsert States in batch / sequence
      const stateMap = new Map<string, string>(); // name -> id
      for (const stateName of uniqueStates) {
        const state = await prisma.state.upsert({
          where: { name: stateName },
          update: {},
          create: { name: stateName }
        });
        stateMap.set(stateName, state.id);
      }

      // Upsert Districts in sequence
      const districtMap = new Map<string, string>(); // "stateId:districtName" -> id
      for (const [stateName, districts] of stateDistricts.entries()) {
        const stateId = stateMap.get(stateName)!;
        for (const districtName of districts) {
          const district = await prisma.district.upsert({
            where: {
              uq_state_district: {
                stateId,
                name: districtName
              }
            },
            update: {},
            create: {
              stateId,
              name: districtName
            }
          });
          districtMap.set(`${stateId}:${districtName}`, district.id);
        }
      }

      // Upsert Engineers dynamically (makes sure they are registered on the platform)
      const engineerMap = new Map<string, string>(); // email -> id
      for (const eng of uniqueEngineers.values()) {
        const dbEng = await prisma.engineer.upsert({
          where: { email: eng.email },
          update: { name: eng.name, phone: eng.phone },
          create: { name: eng.name, email: eng.email, phone: eng.phone }
        });
        engineerMap.set(eng.email, dbEng.id);
      }

      // --- OPTIMIZATION STEP 3: Batch Data Arrays ---
      const masterInstallations: any[] = [];
      const complaints: any[] = [];
      const tickets: any[] = [];
      const ticketAssignments: any[] = [];
      const initialVisits: any[] = [];
      const serviceReports: any[] = [];
      const materialRequests: any[] = [];
      const materialRequestItems: any[] = [];
      const ticketHistories: any[] = [];

      const processedInstallations = new Set<string>();

      const safeDate = (dStr?: string) => {
        if (!dStr) return null;
        const parsed = new Date(dStr.trim());
        return isNaN(parsed.getTime()) ? null : parsed;
      };

      for (let index = 0; index < dataRows.length; index++) {
        const row = dataRows[index];
        const rowNumber = index + 2;

        const getVal = (colName: string) => {
          const idx = headers.indexOf(colName);
          return idx !== -1 ? row[idx] : "";
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

        if (!applicationId) continue;

        const stateId = stateMap.get(stateStr)!;
        const districtId = districtMap.get(`${stateId}:${districtStr}`)!;

        const installationDate = safeDate(installationDateStr);
        const complaintDate = safeDate(complaintDateStr) || new Date();

        // 1. Master Installation
        if (!processedInstallations.has(applicationId)) {
          masterInstallations.push({
            applicationId,
            clientName,
            address: `${districtStr}, ${stateStr}`,
            stateId,
            districtId,
            installationDate
          });
          processedInstallations.add(applicationId);
        }

        // Skip if no complaint date and no ticket ID
        if (!complaintDateStr && !ticketNumberStr) {
          continue;
        }

        // Construct dynamic metadata map for all 40+ columns
        const rowMetadata: Record<string, any> = {};
        headers.forEach((h, i) => {
          rowMetadata[h] = row[i] || "";
        });

        // 2. Complaint
        const complaintId = randomUUID();
        complaints.push({
          id: complaintId,
          formResponseId: rowNumber.toString(),
          applicationId,
          complainantName: clientName,
          complainantPhone,
          complaintType,
          description,
          submissionTimestamp: complaintDate,
          syncStatus: "SYNCED",
          metadata: rowMetadata
        });

        // Engineer lookup
        let engineerDbId = null;
        if (engineerEmail && engineerEmail.trim() !== "") {
          engineerDbId = engineerMap.get(engineerEmail.trim().toLowerCase()) || null;
        }

        // Stage
        let liveStage = "RECEIVED";
        if (serviceReportDateStr) {
          liveStage = "RESOLVED";
        } else if (materialStatusStr && materialStatusStr !== "N/A") {
          liveStage = "MATERIAL_REQUESTED";
        } else if (initialVisitDateStr) {
          liveStage = "INITIAL_VISIT_COMPLETED";
        } else if (engineerDbId) {
          liveStage = "ASSIGNED";
        }

        const ticketNumber = ticketNumberStr || `CLR-${rowNumber}-${Date.now().toString().slice(-4)}`;

        // 3. Ticket
        const ticketId = randomUUID();
        tickets.push({
          id: ticketId,
          ticketNumber,
          complaintId,
          status: liveStage,
          priority: getVal("Priority") || "STANDARD",
          createdAt: complaintDate,
          dueDate: new Date(complaintDate.getTime() + 72 * 60 * 60 * 1000),
          metadata: rowMetadata
        });

        // 4. Assignment
        if (engineerDbId) {
          ticketAssignments.push({
            id: randomUUID(),
            ticketId,
            engineerId: engineerDbId,
            assignedAt: complaintDate
          });
        }

        // 5. Initial Visit
        if (initialVisitDateStr && engineerDbId) {
          initialVisits.push({
            id: randomUUID(),
            ticketId,
            engineerId: engineerDbId,
            visitDate: safeDate(initialVisitDateStr) || complaintDate,
            remarks: "Completed diagnostic check on pump."
          });
        }

        // 6. Service Report
        if (serviceReportDateStr) {
          serviceReports.push({
            id: randomUUID(),
            ticketId,
            reportDate: safeDate(serviceReportDateStr) || complaintDate,
            workDone: "Inspected wiring and restored system operation.",
            status: "COMPLETED"
          });
        }

        // 7. Material Request
        if (materialStatusStr && materialStatusStr !== "N/A" && engineerDbId) {
          const materialRequestId = randomUUID();
          materialRequests.push({
            id: materialRequestId,
            ticketId,
            requestedBy: engineerDbId,
            status: materialStatusStr.toUpperCase() === "SUBMITTED" ? "PENDING" : materialStatusStr.toUpperCase(),
            remarks: "Required solar components."
          });
          materialRequestItems.push({
            id: randomUUID(),
            materialRequestId,
            itemName: "Solar Pump Controller Card",
            quantity: 1
          });
        }

        // 8. Ticket History
        ticketHistories.push({
          id: randomUUID(),
          ticketId,
          newStatus: liveStage,
          changeSummary: "Ticket synced from Google Sheets."
        });
      }

      // --- OPTIMIZATION STEP 4: Write all processed batches ---
      // We run these in a single Prisma transaction using createMany for maximum speed!
      await prisma.$transaction([
        prisma.masterInstallation.createMany({ data: masterInstallations }),
        prisma.complaint.createMany({ data: complaints }),
        prisma.ticket.createMany({ data: tickets }),
        prisma.ticketAssignment.createMany({ data: ticketAssignments }),
        prisma.initialVisit.createMany({ data: initialVisits }),
        prisma.serviceReport.createMany({ data: serviceReports }),
        prisma.materialRequest.createMany({ data: materialRequests }),
        prisma.materialRequestItem.createMany({ data: materialRequestItems }),
        prisma.ticketHistory.createMany({ data: ticketHistories })
      ]);

      console.log(`🎉 SUCCESS: Optimized Full Database Sync completed. Installations: ${masterInstallations.length}, Tickets: ${tickets.length}`);
      return res.status(200).json({
        detail: "Spreadsheet database sync complete!",
        installationsCount: masterInstallations.length,
        ticketsCount: tickets.length
      });

    } catch (err: any) {
      console.error("Full spreadsheet sync error:", err);
      return res.status(500).json({ detail: `Full Sync Error: ${err.message}` });
    }
  }
};

import { Request, Response } from "express";
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
            submissionTimestamp: new Date(timestampStr)
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

        // Update Ticket Status if changed
        if (resolvedStatus !== ticket.status) {
          await prisma.ticket.update({
            where: { id: ticket.id },
            data: { status: resolvedStatus }
          });
        }

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
          syncStatus: "SYNCED"
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
          priority: "STANDARD"
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

      // Extract headers from Row 1
      const headers = rows[0];
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

      let installationsCount = 0;
      let ticketsCount = 0;
      const processedInstallations = new Set<string>();

      // 3. Process every row sequentially
      for (let index = 0; index < dataRows.length; index++) {
        const row = dataRows[index];
        const rowNumber = index + 2; // Row number in sheet (2-indexed)

        // Helper to extract column values
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

        if (!applicationId) continue;

        // Ensure State exists
        const state = await prisma.state.upsert({
          where: { name: stateStr },
          update: {},
          create: { name: stateStr }
        });

        // Ensure District exists
        const district = await prisma.district.upsert({
          where: {
            uq_state_district: {
              stateId: state.id,
              name: districtStr
            }
          },
          update: {},
          create: {
            stateId: state.id,
            name: districtStr
          }
        });

        // Parse Safe Dates
        const safeDate = (dStr?: string) => {
          if (!dStr) return null;
          const parsed = new Date(dStr.trim());
          return isNaN(parsed.getTime()) ? null : parsed;
        };

        const installationDate = safeDate(installationDateStr);
        const complaintDate = safeDate(complaintDateStr) || new Date();

        // Create Master Installation if not already processed
        if (!processedInstallations.has(applicationId)) {
          await prisma.masterInstallation.create({
            data: {
              applicationId,
              clientName,
              address: `${districtStr}, ${stateStr}`,
              stateId: state.id,
              districtId: district.id,
              installationDate
            }
          });
          processedInstallations.add(applicationId);
          installationsCount++;
        }

        // If no complaint date or ticket is present, it's just an AMC client without an active ticket
        if (!complaintDateStr && !ticketNumberStr) {
          continue;
        }

        // Create Complaint
        const complaint = await prisma.complaint.create({
          data: {
            formResponseId: rowNumber.toString(),
            applicationId,
            complainantName: clientName,
            complainantPhone,
            complaintType,
            description,
            submissionTimestamp: complaintDate,
            syncStatus: "SYNCED"
          }
        });

        // Find engineer matching name if provided
        let engineerDbId = null;
        if (assignedEngineerName && assignedEngineerName !== "N/A" && assignedEngineerName.trim() !== "") {
          const eng = await prisma.engineer.findFirst({
            where: { name: { contains: assignedEngineerName.trim() } }
          });
          if (eng) engineerDbId = eng.id;
        }

        // Determine stage
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

        // Create Ticket
        const ticket = await prisma.ticket.create({
          data: {
            ticketNumber,
            complaintId: complaint.id,
            status: liveStage,
            priority: "STANDARD",
            createdAt: complaintDate,
            dueDate: new Date(complaintDate.getTime() + 72 * 60 * 60 * 1000)
          }
        });
        ticketsCount++;

        // Assignment
        if (engineerDbId) {
          await prisma.ticketAssignment.create({
            data: {
              ticketId: ticket.id,
              engineerId: engineerDbId,
              assignedBy: adminId,
              assignedAt: complaintDate
            }
          });
        }

        // Initial Visit
        if (initialVisitDateStr && engineerDbId) {
          await prisma.initialVisit.create({
            data: {
              ticketId: ticket.id,
              engineerId: engineerDbId,
              visitDate: safeDate(initialVisitDateStr) || complaintDate,
              remarks: "Completed diagnostic check on pump."
            }
          });
        }

        // Service Report
        if (serviceReportDateStr) {
          await prisma.serviceReport.create({
            data: {
              ticketId: ticket.id,
              reportDate: safeDate(serviceReportDateStr) || complaintDate,
              workDone: "Inspected wiring and restored system operation.",
              status: "COMPLETED"
            }
          });
        }

        // Material Request
        if (materialStatusStr && materialStatusStr !== "N/A" && engineerDbId) {
          const matRequest = await prisma.materialRequest.create({
            data: {
              ticketId: ticket.id,
              requestedBy: engineerDbId,
              status: materialStatusStr.toUpperCase() === "SUBMITTED" ? "PENDING" : materialStatusStr.toUpperCase(),
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
        }

        // History Log
        await prisma.ticketHistory.create({
          data: {
            ticketId: ticket.id,
            newStatus: liveStage,
            changedBy: adminId,
            changeSummary: "Ticket synced from Google Sheets."
          }
        });
      }

      console.log(`🎉 SUCCESS: Full Database Clean Sync completed. Installations: ${installationsCount}, Tickets: ${ticketsCount}`);
      return res.status(200).json({
        detail: "Spreadsheet database sync complete!",
        installationsCount,
        ticketsCount
      });

    } catch (err: any) {
      console.error("Full spreadsheet sync error:", err);
      return res.status(500).json({ detail: `Full Sync Error: ${err.message}` });
    }
  }
};

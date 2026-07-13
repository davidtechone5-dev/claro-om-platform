import { Request, Response } from "express";
import { randomUUID } from "crypto";
import { prisma } from "../db.js";
import { parseSafeDate } from "../utils/date.js";
import { normalizeStatus, normalizePriority, normalizeMaterialStatus } from "../utils/status.js";
import { engineerService } from "../services/engineer.service.js";
import { ticketService } from "../services/ticket.service.js";
import { syncService } from "../services/sync.service.js";
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
    const liveStageFromPayload = (payload["Live Stage"] || payload["live_stage"] || "").toString().trim().toUpperCase();
    const priorityFromPayload = (payload["Priority"] || payload["priority"] || "").toString().trim().toUpperCase();

    if (!applicationId) {
      const errorMsg = "Missing required parameter 'Application ID'";
      await prisma.syncLog.create({
        data: { sheetName, rowNumber, status: "FAILED", errorMessage: errorMsg }
      });
      return res.status(400).json({ detail: errorMsg });
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        // 1. Validate application exists in master installations
        const installation = await tx.masterInstallation.findUnique({
          where: { applicationId }
        });

        if (!installation) {
          throw new Error(`Invalid Application ID: ${applicationId} is not registered in Master Installations.`);
        }

        // 2. Retrieve existing ticket/complaint
        let existingTicket = null;
        if (ticketNumberFromPayload) {
          existingTicket = await tx.ticket.findUnique({
            where: { ticketNumber: ticketNumberFromPayload },
            include: { complaint: { include: { tickets: true } } }
          });
        }

        const existingComplaint = existingTicket?.complaint || await tx.complaint.findFirst({
          where: { formResponseId: rowNumber.toString(), applicationId },
          include: { tickets: true }
        });

        const { adminUser } = await engineerService.getAdminUser(tx);
        const adminId = adminUser.id;

        // If updating existing ticket/complaint
        if (existingComplaint && existingComplaint.tickets.length > 0) {
          await tx.complaint.update({
            where: { id: existingComplaint.id },
            data: {
              complainantName,
              complainantPhone,
              complaintType,
              description,
              submissionTimestamp: parseSafeDate(timestampStr) || new Date(),
              metadata: payload
            }
          });

          const ticket = existingComplaint.tickets[0];
          let engineerProfileId: string | null = null;

          if (assignedEngineerName && engineerEmail) {
            const engineer = await engineerService.upsertEngineer(
              assignedEngineerName,
              engineerEmail,
              engineerPhone,
              null,
              null,
              tx
            );
            if (engineer) {
              engineerProfileId = engineer.id;
              await ticketService.handleAssignment(ticket.id, engineer.id, new Date(), tx);

              if (ticket.status === "RECEIVED") {
                await tx.ticket.update({
                  where: { id: ticket.id },
                  data: { status: "ASSIGNED" }
                });
                await ticketService.createStatusHistory(ticket.id, "RECEIVED", "ASSIGNED", "Engineer assigned manually.", tx);
              }
            }
          } else if (!assignedEngineerName || assignedEngineerName === "N/A" || assignedEngineerName === "") {
            await tx.ticketAssignment.deleteMany({
              where: { ticketId: ticket.id }
            });
          } else {
            const currentAssignment = await tx.ticketAssignment.findFirst({
              where: { ticketId: ticket.id }
            });
            if (currentAssignment) {
              engineerProfileId = currentAssignment.engineerId;
            }
          }

          const visitDate = parseSafeDate(initialVisitDateStr);
          const reportDate = parseSafeDate(serviceReportDateStr);
          let resolvedStatus = ticket.status;

          const mappedStage = normalizeStatus(liveStageFromPayload);
          if (mappedStage) {
            resolvedStatus = mappedStage;
          } else {
            if (visitDate && engineerProfileId) {
              await ticketService.handleInitialVisit(ticket.id, engineerProfileId, visitDate, "Completed diagnostic check.", tx);
              if (resolvedStatus === "ASSIGNED" || resolvedStatus === "RECEIVED") {
                resolvedStatus = "INITIAL_VISIT_COMPLETED";
              }
            }

            if (materialStatusStr && materialStatusStr !== "N/A" && engineerProfileId) {
              await ticketService.handleMaterialRequest(ticket.id, engineerProfileId, materialStatusStr, tx);
              if (resolvedStatus !== "RESOLVED") {
                resolvedStatus = "MATERIAL_REQUESTED";
              }
            }

            if (reportDate) {
              await ticketService.handleServiceReport(ticket.id, reportDate, "Inspected wiring and restored system operation.", "COMPLETED", tx);
              resolvedStatus = "RESOLVED";
            }
          }

          if (resolvedStatus !== ticket.status) {
            await ticketService.createStatusHistory(ticket.id, ticket.status, resolvedStatus, "Status updated from Google Sheets sync.", tx);
          }

          const resolvedPriority = normalizePriority(priorityFromPayload) || ticket.priority;

          await tx.ticket.update({
            where: { id: ticket.id },
            data: {
              status: resolvedStatus,
              priority: resolvedPriority,
              metadata: payload
            }
          });

          return { ticketNumber: ticket.ticketNumber, status: resolvedStatus };
        }

        // Creating brand new ticket/complaint
        const complaint = await tx.complaint.create({
          data: {
            formResponseId: rowNumber.toString(),
            applicationId,
            complainantName,
            complainantPhone,
            complaintType,
            description,
            submissionTimestamp: parseSafeDate(timestampStr) || new Date(),
            syncStatus: "SYNCED",
            metadata: payload
          }
        });

        const now = new Date();
        const yy = now.getFullYear().toString().slice(-2);
        const mm = (now.getMonth() + 1).toString().padStart(2, '0');
        const dd = now.getDate().toString().padStart(2, '0');
        const datePrefix = `CLR-${yy}${mm}${dd}`;

        const ticketNumber = await ticketService.generateUniqueTicketNumber(datePrefix, tx);

        const ticket = await tx.ticket.create({
          data: {
            ticketNumber,
            complaintId: complaint.id,
            status: "RECEIVED",
            priority: normalizePriority(priorityFromPayload) || "STANDARD",
            metadata: payload
          }
        });

        await ticketService.createStatusHistory(ticket.id, null, "RECEIVED", "Ticket created from synced Google Form complaint.", tx);

        return { ticketId: ticket.id, ticketNumber, isNew: true };
      });

      // Handle auto assignment outside the main transaction if it is a new ticket
      let finalStatus = "RECEIVED";
      if (result.isNew) {
        const assignedEngineerId = await assignmentService.assignEngineerToTicket(result.ticketId!, applicationId);
        if (!assignedEngineerId) {
          finalStatus = "MANUAL_ASSIGNMENT_REQUIRED";
          await prisma.ticket.update({
            where: { id: result.ticketId },
            data: { status: finalStatus }
          });
          await ticketService.createStatusHistory(result.ticketId!, "RECEIVED", finalStatus, "System could not auto-assign ticket. Placed in Manual queue.");
        } else {
          finalStatus = "ASSIGNED";
        }
      } else {
        finalStatus = result.status!;
      }

      await prisma.syncLog.create({
        data: { sheetName, rowNumber, status: "SUCCESS" }
      });

      return res.status(200).json({
        ticketNumber: result.ticketNumber,
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
      await prisma.$transaction(async (tx) => {
        const ticket = await tx.ticket.findUnique({
          where: { ticketNumber },
          include: { assignments: { where: { deletedAt: null } } }
        });

        if (!ticket) {
          throw new Error(`Ticket ${ticketNumber} not found.`);
        }

        const activeAssignment = ticket.assignments[0];
        if (!activeAssignment) {
          throw new Error(`No engineer is currently assigned to Ticket ${ticketNumber}.`);
        }

        const visitDate = parseSafeDate(timestampStr) || new Date();
        await ticketService.handleInitialVisit(ticket.id, activeAssignment.engineerId, visitDate, visitRemarks, tx);

        const oldStatus = ticket.status;
        const newStatus = "INITIAL_VISIT_COMPLETED";

        await tx.ticket.update({
          where: { id: ticket.id },
          data: { status: newStatus }
        });

        await ticketService.createStatusHistory(ticket.id, oldStatus, newStatus, "Engineer completed initial visit and recorded remarks.", tx);
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
    const itemsText = payload["Items"] || payload["items"] || "";
    const remarks = payload["Remarks"] || payload["remarks"] || "";

    if (!ticketNumber) {
      return res.status(400).json({ detail: "Missing required 'Ticket ID' parameter." });
    }

    try {
      await prisma.$transaction(async (tx) => {
        const ticket = await tx.ticket.findUnique({
          where: { ticketNumber },
          include: { assignments: { where: { deletedAt: null } } }
        });

        if (!ticket) {
          throw new Error(`Ticket ${ticketNumber} not found.`);
        }

        const activeAssignment = ticket.assignments[0];
        if (!activeAssignment) {
          throw new Error(`No engineer assigned to Ticket ${ticketNumber}.`);
        }

        const normalizedMRStatus = normalizeMaterialStatus("PENDING");

        const existingMR = await tx.materialRequest.findFirst({
          where: { ticketId: ticket.id }
        });

        let mrId: string;
        if (existingMR) {
          mrId = existingMR.id;
          await tx.materialRequest.update({
            where: { id: mrId },
            data: { requestedBy: activeAssignment.engineerId, status: normalizedMRStatus, remarks }
          });
        } else {
          mrId = randomUUID();
          await tx.materialRequest.create({
            data: {
              id: mrId,
              ticketId: ticket.id,
              requestedBy: activeAssignment.engineerId,
              status: normalizedMRStatus,
              remarks
            }
          });
        }

        // Sync items
        await tx.materialRequestItem.deleteMany({
          where: { materialRequestId: mrId }
        });

        const itemsList = itemsText.split(",");
        for (let itemStr of itemsList) {
          itemStr = itemStr.trim();
          if (!itemStr) continue;

          let itemName = itemStr;
          let quantity = 1;

          const qtyMatch = itemStr.match(/\(([^)]+)\)/) || itemStr.match(/- (\d+)/);
          if (qtyMatch) {
            quantity = parseInt(qtyMatch[1], 10) || 1;
            itemName = itemStr.replace(qtyMatch[0], "").trim();
          }

          await tx.materialRequestItem.create({
            data: {
              materialRequestId: mrId,
              itemName,
              quantity
            }
          });
        }

        const oldStatus = ticket.status;
        const newStatus = "MATERIAL_REQUESTED";

        await tx.ticket.update({
          where: { id: ticket.id },
          data: { status: newStatus }
        });

        await ticketService.createStatusHistory(ticket.id, oldStatus, newStatus, `Engineer requested materials: ${itemsText}`, tx);
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
      await prisma.$transaction(async (tx) => {
        const ticket = await tx.ticket.findUnique({
          where: { ticketNumber }
        });

        if (!ticket) {
          throw new Error(`Ticket ${ticketNumber} not found.`);
        }

        const existingClaim = await tx.insuranceClaim.findUnique({
          where: { claimNumber }
        });

        if (existingClaim) {
          await tx.insuranceClaim.update({
            where: { id: existingClaim.id },
            data: {
              ticketId: ticket.id,
              providerName,
              amountEstimated: parseFloat(amountStr) || 0,
              remarks
            }
          });
        } else {
          await tx.insuranceClaim.create({
            data: {
              ticketId: ticket.id,
              claimNumber,
              providerName,
              amountEstimated: parseFloat(amountStr) || 0,
              status: "SUBMITTED",
              remarks
            }
          });
        }

        const oldStatus = ticket.status;
        const newStatus = "INSURANCE_SUBMITTED";

        await tx.ticket.update({
          where: { id: ticket.id },
          data: { status: newStatus }
        });

        await ticketService.createStatusHistory(ticket.id, oldStatus, newStatus, `Insurance claim submitted: #${claimNumber} ($${amountStr})`, tx);
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
      await prisma.$transaction(async (tx) => {
        const ticket = await tx.ticket.findUnique({
          where: { ticketNumber }
        });

        if (!ticket) {
          throw new Error(`Ticket ${ticketNumber} not found.`);
        }

        const reportDate = parseSafeDate(timestampStr) || new Date();
        const ticketCreatedDate = new Date(ticket.createdAt);
        const diffMs = reportDate.getTime() - ticketCreatedDate.getTime();
        const tatMinutes = Math.max(0, Math.floor(diffMs / (1000 * 60)));

        const isCompleted = isCompletedStr.toLowerCase() === "yes" || isCompletedStr === "true";
        const status = isCompleted ? "RESOLVED" : "IN_PROGRESS";

        const existingReport = await tx.serviceReport.findFirst({
          where: { ticketId: ticket.id }
        });

        if (existingReport) {
          await tx.serviceReport.update({
            where: { id: existingReport.id },
            data: {
              reportDate,
              workDone,
              tatMinutes,
              status: isCompleted ? "COMPLETED" : "PARTIALLY_COMPLETED"
            }
          });
        } else {
          await tx.serviceReport.create({
            data: {
              ticketId: ticket.id,
              reportDate,
              workDone,
              tatMinutes,
              status: isCompleted ? "COMPLETED" : "PARTIALLY_COMPLETED"
            }
          });
        }

        const oldStatus = ticket.status;

        await tx.ticket.update({
          where: { id: ticket.id },
          data: { status }
        });

        await ticketService.createStatusHistory(
          ticket.id,
          oldStatus,
          status,
          `Service Report submitted. Action: ${status}. Calculated TAT: ${tatMinutes} mins.`,
          tx
        );
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
    let SPREADSHEET_ID = (req.body.spreadsheetId || req.query.spreadsheetId || process.env.GOOGLE_SPREADSHEET_ID) as string;
    let gid = (req.body.gid || req.query.gid || "") as string;

    if (SPREADSHEET_ID && SPREADSHEET_ID.includes("docs.google.com/spreadsheets")) {
      const gidMatch = SPREADSHEET_ID.match(/[?&]gid=([^&#]+)/);
      if (gidMatch && !gid) {
        gid = gidMatch[1];
      }
      const match = SPREADSHEET_ID.match(/\/d\/([^/]+)/);
      if (match) {
        SPREADSHEET_ID = match[1];
      }
    }

    if (!SPREADSHEET_ID) {
      return res.status(400).json({ detail: "Missing spreadsheet identification (GOOGLE_SPREADSHEET_ID)." });
    }

    try {
      const counts = await syncService.syncFullSheet(SPREADSHEET_ID, gid);
      return res.status(200).json({
        detail: "Spreadsheet database sync complete!",
        installationsCount: counts.installationsCount,
        ticketsCount: counts.ticketsCount
      });
    } catch (err: any) {
      console.error("Full spreadsheet sync error:", err);
      return res.status(500).json({ detail: `Full Sync Error: ${err.message}` });
    }
  }
};

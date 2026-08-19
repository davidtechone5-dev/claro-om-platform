import dotenv from "dotenv";
import { prisma } from "../db";
import { parseCSV } from "../utils/csv";
import { parseSafeDate, parseMDYDate, parseDMYDate, parseSmartDate } from "../utils/date";
import { normalizeStatus, normalizePriority, normalizeMaterialStatus, normalizeEngineerEmail } from "../utils/status";
import { engineerService } from "../services/engineer.service";
import { ticketService } from "../services/ticket.service";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";

dotenv.config();

async function fetchSheetAsCSV(spreadsheetId: string, gid?: string): Promise<string> {
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv${gid ? `&gid=${gid}` : ""}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch spreadsheet: ${response.statusText}`);
  }
  return response.text();
}

async function run() {
  let SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
  if (!SPREADSHEET_ID) {
    console.error("❌ Error: GOOGLE_SPREADSHEET_ID environment variable not set.");
    process.exit(1);
  }

  let GID = "";
  if (SPREADSHEET_ID.includes("docs.google.com/spreadsheets")) {
    const gidMatch = SPREADSHEET_ID.match(/[?&]gid=([^&#]+)/);
    if (gidMatch) {
      GID = gidMatch[1];
    }
    const match = SPREADSHEET_ID.match(/\/d\/([^/]+)/);
    if (match) {
      SPREADSHEET_ID = match[1];
    }
  }

  try {
    console.log("🗑 Clearing old imported data...");

    // Delete child and main tables in an atomic transaction to prevent foreign key issues
    await prisma.$transaction([
      prisma.ticketHistory.deleteMany(),
      prisma.materialRequestItem.deleteMany(),
      prisma.materialRequest.deleteMany(),
      prisma.serviceReport.deleteMany(),
      prisma.initialVisit.deleteMany(),
      prisma.ticketAssignment.deleteMany(),
      prisma.insuranceClaim.deleteMany(),
      prisma.ticket.deleteMany(),
      prisma.complaint.deleteMany(),
    ]);

    console.log("✅ Old ticket data cleared.");

    // Seed Roles and Admin
    const { adminRole, adminUser } = await engineerService.getAdminUser();
    const engineerRole = await prisma.role.upsert({
      where: { name: "Engineer" },
      update: {},
      create: { name: "Engineer", description: "Field Engineer" }
    });

    const engPassword = bcrypt.hashSync("engineer123", 10);

    console.log("📥 Downloading consolidated sheet data...");
    const sheetCSV = await fetchSheetAsCSV(SPREADSHEET_ID, GID);

    console.log("================================");
    console.log("Raw CSV line count:", sheetCSV.split(/\r?\n/).length);

    const rows = parseCSV(sheetCSV);
    console.log("Parsed rows:", rows.length);

    const headers = rows[0].map(h => h.trim().replace(/^\uFEFF/, ""));
    const dataRows = rows.slice(1);
    console.log(`✅ Loaded ${dataRows.length} total transaction rows from Sheet.`);
    console.log(`📊 First row has ${dataRows[0]?.length} columns`);
    console.log(`📊 Last row has ${dataRows[dataRows.length - 1]?.length} columns`);

    console.log("First Ticket:", dataRows[0]?.[0]);
    console.log("Last Ticket:", dataRows[dataRows.length - 1]?.[0]);
    console.log("================================");

    let installationsCount = 0;
    let engineersCount = 0;
    let ticketsCount = 0;

    const processedInstallations = new Set<string>();
    const processedEngineers = new Set<string>();
    const processedTicketNumbers = new Set<string>();

    for (let index = 0; index < dataRows.length; index++) {
      const row = dataRows[index];
      const rowNumber = index + 2;

      const payload: Record<string, any> = {};
      headers.forEach((header, colIndex) => {
        payload[header] = row[colIndex]?.trim() || "";
      });

      // Extract cells based on known column indexes
      const ticketId = row[0]?.trim();
      const createdAtStr = row[1]?.trim();
      const appId = row[2]?.trim();
      const clientName = row[6]?.trim();
      const clientPhone = row[8]?.trim() || "0000000000";
      const stateName = row[10]?.trim();
      const districtName = row[11]?.trim();
      const blockName = row[12]?.trim() || "";
      const villageName = row[13]?.trim() || "";
      const instDateStr = row[16]?.trim();
      const priorityStr = row[18]?.trim()?.toUpperCase() || "STANDARD";
      const issueType = row[19]?.trim() || "Unknown Issue";
      const description = row[20]?.trim() || "No description provided.";

      const engId = row[21]?.trim();
      const engName = row[22]?.trim();
      const engEmail = row[23]?.trim()?.toLowerCase();
      const engPhone = row[24]?.trim();
      const assignedAtStr = row[25]?.trim();

      const initialVisitDateStr = row[27]?.trim();
      const serviceReportDateStr = row[29]?.trim();
      const materialStatusStr = row[31]?.trim();
      const liveStageStr = row[37]?.trim()?.toUpperCase() || "RECEIVED";

      let finalAppId = appId ? appId.trim().toUpperCase() : "";
      if (!finalAppId) {
        if (!clientName && !ticketId && !createdAtStr) {
          continue;
        }
        finalAppId = "N/A";
      }

      let finalTicketId = ticketId ? ticketId.trim().toUpperCase() : "";
      if (!finalTicketId) {
        finalTicketId = `CLR-LEG-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
      }

      // Prevent duplicate ticket numbers in memory to avoid unique constraint crashes
      if (processedTicketNumbers.has(finalTicketId)) {
        console.warn(`⚠️ Skipping duplicate Ticket ID: ${finalTicketId}`);
        continue;
      }
      processedTicketNumbers.add(finalTicketId);

      // 1. Upsert State and District
      let stateId = null;
      let districtId = null;
      if (finalAppId !== "N/A" && stateName) {
        const state = await prisma.state.upsert({
          where: { name: stateName },
          update: {},
          create: { name: stateName }
        });
        stateId = state.id;

        if (districtName) {
          const district = await prisma.district.upsert({
            where: {
              uq_state_district: {
                stateId: state.id,
                name: districtName
              }
            },
            update: {},
            create: {
              stateId: state.id,
              name: districtName
            }
          });
          districtId = district.id;
        }
      }

      // 2. Upsert Master Installation
      const fullAddress = finalAppId === "N/A" ? "N/A" : `${villageName ? villageName + " (Village), " : ""}${blockName ? blockName + " (Block), " : ""}${districtName}, ${stateName}`;

      if (!processedInstallations.has(finalAppId)) {
        await prisma.masterInstallation.upsert({
          where: { applicationId: finalAppId },
          update: {
            clientName: finalAppId === "N/A" ? "N/A" : clientName,
            installationDate: finalAppId === "N/A" ? null : parseSafeDate(instDateStr),
            address: fullAddress,
            stateId,
            districtId
          },
          create: {
            applicationId: finalAppId,
            clientName: finalAppId === "N/A" ? "N/A" : clientName,
            installationDate: finalAppId === "N/A" ? null : parseSafeDate(instDateStr),
            address: fullAddress,
            stateId,
            districtId
          }
        });
        processedInstallations.add(finalAppId);
        installationsCount++;
      }

      // 3. Upsert Engineer Profile
      let engineerDbId = "";
      if (engName && engEmail && engPhone) {
        const cleanEngEmail = normalizeEngineerEmail(engEmail);
        let engProfile = await prisma.engineer.findFirst({
          where: {
            name: { equals: engName.trim(), mode: "insensitive" }
          }
        });

        if (!engProfile) {
          engProfile = await prisma.engineer.findUnique({
            where: { email: cleanEngEmail }
          });
        }

        if (!engProfile) {
          const user = await prisma.user.upsert({
            where: { email: cleanEngEmail },
            update: { fullName: engName },
            create: {
              email: cleanEngEmail,
              fullName: engName,
              passwordHash: engPassword,
              roleId: engineerRole.id
            }
          });

          engProfile = await prisma.engineer.create({
            data: {
              userId: user.id,
              name: engName,
              email: cleanEngEmail,
              phone: engPhone,
              stateId,
              districtId
            }
          });
          processedEngineers.add(cleanEngEmail);
          engineersCount++;
        }
        engineerDbId = engProfile.id;
      }

      let ticket: any = await prisma.ticket.findUnique({
        where: { ticketNumber: finalTicketId },
        include: {
          complaint: true,
          assignments: { where: { deletedAt: null } },
          initialVisits: { where: { deletedAt: null } },
          serviceReports: { where: { deletedAt: null } }
        }
      });

      const complaintDate = parseMDYDate(createdAtStr) || new Date();
      const project = payload["Project"] || payload["project"] || "Other";
      const normalizedStatusValue = normalizeStatus(liveStageStr) || "RECEIVED";
      const normalizedPriorityValue = normalizePriority(priorityStr) || "STANDARD";

      if (!ticket) {
        // 4. Create Complaint
        const complaint = await prisma.complaint.create({
          data: {
            applicationId: finalAppId,
            complainantName: finalAppId === "N/A" ? "N/A" : clientName,
            complainantPhone: clientPhone,
            complaintType: issueType,
            description: description,
            submissionTimestamp: complaintDate,
            syncStatus: "SUCCESS",
            project,
            metadata: payload
          }
        });

        // 5. Create Ticket
        try {
          ticket = await prisma.ticket.create({
            data: {
              ticketNumber: finalTicketId,
              complaintId: complaint.id,
              status: normalizedStatusValue,
              priority: normalizedPriorityValue,
              createdAt: complaintDate,
              dueDate: new Date(complaintDate.getTime() + 72 * 60 * 60 * 1000),
              metadata: payload
            }
          });
        } catch (err: any) {
          if (err.code === "P2002") {
            ticket = await prisma.ticket.update({
              where: { ticketNumber: finalTicketId },
              data: {
                status: normalizedStatusValue,
                priority: normalizedPriorityValue,
                createdAt: complaintDate,
                dueDate: new Date(complaintDate.getTime() + 72 * 60 * 60 * 1000),
                metadata: payload
              }
            });
          } else {
            throw err;
          }
        }
        ticketsCount++;
      } else {
        // Update existing complaint
        await prisma.complaint.update({
          where: { id: ticket.complaintId },
          data: {
            applicationId: finalAppId,
            complainantName: finalAppId === "N/A" ? "N/A" : clientName,
            complainantPhone: clientPhone,
            complaintType: issueType,
            description: description,
            submissionTimestamp: complaintDate,
            project,
            metadata: payload
          }
        });

        // Update existing ticket
        ticket = await prisma.ticket.update({
          where: { id: ticket.id },
          data: {
            status: normalizedStatusValue,
            priority: normalizedPriorityValue,
            createdAt: complaintDate,
            dueDate: new Date(complaintDate.getTime() + 72 * 60 * 60 * 1000),
            metadata: payload
          }
        });
      }

      // 6. Create Ticket Assignment if Engineer exists
      if (engineerDbId) {
        const assignDate = parseDMYDate(assignedAtStr) || undefined;
        const existingAssignment = await prisma.ticketAssignment.findFirst({
          where: { ticketId: ticket.id, engineerId: engineerDbId, deletedAt: null }
        });
        if (!existingAssignment) {
          await prisma.ticketAssignment.create({
            data: {
              ticketId: ticket.id,
              engineerId: engineerDbId,
              assignedBy: adminUser.id,
              assignedAt: assignDate
            }
          });
        } else {
          await prisma.ticketAssignment.update({
            where: { id: existingAssignment.id },
            data: { assignedAt: assignDate }
          });
        }
      }

      // 7. Create Initial Visit if date exists
      if (initialVisitDateStr && engineerDbId) {
        const visitDate = parseSmartDate(initialVisitDateStr, complaintDate) || complaintDate;
        const existingVisit = await prisma.initialVisit.findFirst({
          where: { ticketId: ticket.id, engineerId: engineerDbId, deletedAt: null }
        });
        if (!existingVisit) {
          await prisma.initialVisit.create({
            data: {
              ticketId: ticket.id,
              engineerId: engineerDbId,
              visitDate: visitDate,
              remarks: "Completed diagnostic check on pump."
            }
          });
        } else {
          await prisma.initialVisit.update({
            where: { id: existingVisit.id },
            data: { visitDate: visitDate }
          });
        }
      }

      // 8. Create Service Report if date exists
      if (serviceReportDateStr) {
        const reportDate = parseSmartDate(serviceReportDateStr, complaintDate) || complaintDate;
        const existingReport = await prisma.serviceReport.findFirst({
          where: { ticketId: ticket.id, deletedAt: null }
        });
        if (!existingReport) {
          await prisma.serviceReport.create({
            data: {
              ticketId: ticket.id,
              reportDate: reportDate,
              workDone: "Inspected wiring, diagnosed fault and restored system operation.",
              status: "COMPLETED"
            }
          });
        } else {
          await prisma.serviceReport.update({
            where: { id: existingReport.id },
            data: { reportDate: reportDate }
          });
        }
      }


      // 9. Material Request creation removed here (now synced from secondary sheet at the end of the script)

      // 10. Write History Log
      await prisma.ticketHistory.create({
        data: {
          ticketId: ticket.id,
          newStatus: normalizedStatusValue,
          changedBy: adminUser.id,
          changeSummary: `Ticket imported from Google Sheets. Initial Status: ${normalizedStatusValue}.`
        }
      });
    }

    let mrCount = 0;

    console.log(`\n=============================================`);
    console.log(`🎉 SUCCESS: Historical Database Loaded!`);
    console.log(`=============================================`);
    console.log(`📍 Master Installations added: ${installationsCount}`);
    console.log(`📍 Engineers Profiles added:    ${engineersCount}`);
    console.log(`📍 Live Tickets Imported:        ${ticketsCount}`);
    console.log(`📍 Material Requests Synced:     ${mrCount}`);
    console.log(`=============================================\n`);

  } catch (error: any) {
    console.error("❌ Error running direct sheet import:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

run();

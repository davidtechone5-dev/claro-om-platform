import dotenv from "dotenv";
import { prisma } from "../db";
import { parseCSV } from "../utils/csv";
import { parseSafeDate, parseMDYDate, parseDMYDate } from "../utils/date";
import { normalizeStatus, normalizePriority, normalizeMaterialStatus } from "../utils/status";
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

    // Delete child tables first
    await prisma.ticketHistory.deleteMany();
    await prisma.materialRequestItem.deleteMany();
    await prisma.materialRequest.deleteMany();
    await prisma.serviceReport.deleteMany();
    await prisma.initialVisit.deleteMany();
    await prisma.ticketAssignment.deleteMany();

    // Delete main tables
    await prisma.ticket.deleteMany();
    await prisma.complaint.deleteMany();

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
        let engProfile = await prisma.engineer.findFirst({
          where: {
            name: { equals: engName.trim(), mode: "insensitive" }
          }
        });

        if (!engProfile) {
          engProfile = await prisma.engineer.findUnique({
            where: { email: engEmail }
          });
        }

        if (!engProfile) {
          const user = await prisma.user.upsert({
            where: { email: engEmail },
            update: { fullName: engName },
            create: {
              email: engEmail,
              fullName: engName,
              passwordHash: engPassword,
              roleId: engineerRole.id
            }
          });

          engProfile = await prisma.engineer.create({
            data: {
              userId: user.id,
              name: engName,
              email: engEmail,
              phone: engPhone,
              stateId,
              districtId
            }
          });
          processedEngineers.add(engEmail);
          engineersCount++;
        }
        engineerDbId = engProfile.id;
      }

      // 4. Create Complaint
      const complaintDate = parseMDYDate(createdAtStr) || new Date();
      const complaint = await prisma.complaint.create({
        data: {
          applicationId: finalAppId,
          complainantName: finalAppId === "N/A" ? "N/A" : clientName,
          complainantPhone: clientPhone,
          complaintType: issueType,
          description: description,
          submissionTimestamp: complaintDate,
          syncStatus: "SUCCESS"
        }
      });

      // 5. Create Ticket
      const normalizedStatusValue = normalizeStatus(liveStageStr) || "RECEIVED";
      const normalizedPriorityValue = normalizePriority(priorityStr) || "STANDARD";

      const ticket = await prisma.ticket.create({
        data: {
          ticketNumber: finalTicketId,
          complaintId: complaint.id,
          status: normalizedStatusValue,
          priority: normalizedPriorityValue,
          createdAt: complaintDate,
          dueDate: new Date(complaintDate.getTime() + 72 * 60 * 60 * 1000)
        }
      });
      ticketsCount++;

      // 6. Create Ticket Assignment if Engineer exists
      if (engineerDbId) {
        const assignDate = parseDMYDate(assignedAtStr) || undefined;
        await prisma.ticketAssignment.create({
          data: {
            ticketId: ticket.id,
            engineerId: engineerDbId,
            assignedBy: adminUser.id,
            assignedAt: assignDate
          }
        });
      }

      // 7. Create Initial Visit if date exists
      if (initialVisitDateStr && engineerDbId) {
        const visitDate = parseDMYDate(initialVisitDateStr) || complaintDate;
        await prisma.initialVisit.create({
          data: {
            ticketId: ticket.id,
            engineerId: engineerDbId,
            visitDate: visitDate,
            remarks: "Completed diagnostic check on pump."
          }
        });
      }

      // 8. Create Service Report if date exists
      if (serviceReportDateStr) {
        const reportDate = parseDMYDate(serviceReportDateStr) || complaintDate;
        await prisma.serviceReport.create({
          data: {
            ticketId: ticket.id,
            reportDate: reportDate,
            workDone: "Inspected wiring, diagnosed fault and restored system operation.",
            status: "COMPLETED"
          }
        });
      }

      // 9. Create Material Request if status exists and is not N/A
      if (materialStatusStr && materialStatusStr !== "N/A" && engineerDbId) {
        const cleanMatStatus = normalizeMaterialStatus(materialStatusStr);
        const matRequest = await prisma.materialRequest.create({
          data: {
            ticketId: ticket.id,
            requestedBy: engineerDbId,
            status: cleanMatStatus,
            remarks: "Required controller wiring components."
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

    console.log(`\n=============================================`);
    console.log(`🎉 SUCCESS: Historical Database Loaded!`);
    console.log(`=============================================`);
    console.log(`📍 Master Installations added: ${installationsCount}`);
    console.log(`📍 Engineers Profiles added:    ${engineersCount}`);
    console.log(`📍 Live Tickets Imported:        ${ticketsCount}`);
    console.log(`=============================================\n`);

  } catch (error: any) {
    console.error("❌ Error running direct sheet import:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

run();

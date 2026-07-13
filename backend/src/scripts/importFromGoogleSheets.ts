import { prisma } from "../db.js";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

let SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
let GID = "";
if (SPREADSHEET_ID && SPREADSHEET_ID.includes("docs.google.com/spreadsheets")) {
  const gidMatch = SPREADSHEET_ID.match(/[?&]gid=([^&#]+)/);
  if (gidMatch) {
    GID = gidMatch[1];
  }
  const match = SPREADSHEET_ID.match(/\/d\/([^/]+)/);
  if (match) {
    SPREADSHEET_ID = match[1];
  }
}

/**
 * Parses CSV strings (handles quoted fields containing commas)
 */
function parseCSV(csvText: string): string[][] {
  const lines = csvText.split(/\r?\n/);
  return lines
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
}

/**
 * Safely parses date strings to avoid Prisma validation crashes on invalid date entries
 */
function safeDate(dateStr?: string): Date | null {
  if (!dateStr) return null;
  const parsed = new Date(dateStr.trim());
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Downloads the sheet tab as CSV
 */
async function fetchSheetAsCSV(spreadsheetId: string, gid: string = ""): Promise<string> {
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv${gid ? `&gid=${gid}` : ""}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch sheet: ${response.statusText}`);
  }
  return await response.text();
}

async function run() {
  console.log("🚀 Starting Google Sheets Public Import Script...");

  if (!SPREADSHEET_ID) {
    console.error("❌ Error: GOOGLE_SPREADSHEET_ID is not configured in your .env file.");
    process.exit(1);
  }

  try {
    // Upsert Default Admin User & Roles
    const adminRole = await prisma.role.upsert({
      where: { name: "Admin" },
      update: {},
      create: { name: "Admin", description: "System Administrator" }
    });

    const engineerRole = await prisma.role.upsert({
      where: { name: "Engineer" },
      update: {},
      create: { name: "Engineer", description: "Field Engineer role" }
    });

    // Create a default administrator user for dashboard login testing
    const defaultPassword = bcrypt.hashSync("admin123", 10);
    const engPassword = bcrypt.hashSync("engineer123", 10);
    
    const adminUser = await prisma.user.upsert({
      where: { email: "admin@claro.com" },
      update: {},
      create: {
        email: "admin@claro.com",
        fullName: "System Admin",
        passwordHash: defaultPassword,
        roleId: adminRole.id
      }
    });

    console.log("📥 Downloading consolidated sheet data...");
    const sheetCSV = await fetchSheetAsCSV(SPREADSHEET_ID, GID);
    const rows = parseCSV(sheetCSV);
    
    // Slice off header row
    const dataRows = rows.slice(1);
    console.log(`✅ Loaded ${dataRows.length} total transaction rows from Sheet.`);

    let installationsCount = 0;
    let engineersCount = 0;
    let ticketsCount = 0;

    const processedInstallations = new Set<string>();
    const processedEngineers = new Set<string>();

    for (const row of dataRows) {
      // Columns based on fetched dump:
      // row[0] = Ticket ID
      // row[1] = Created At
      // row[2] = Application ID
      // row[6] = Customer Name (Client Name)
      // row[8] = Customer Phone
      // row[10] = State
      // row[11] = District
      // row[12] = Block/Taluka
      // row[13] = Village
      // row[16] = Installation Date
      // row[18] = Priority
      // row[19] = Issue Type
      // row[20] = Description
      // row[21] = Assigned Engineer ID
      // row[22] = Assigned Engineer Name
      // row[23] = Engineer Email
      // row[24] = Engineer Phone
      // row[25] = Assigned At
      // row[27] = Initial Visit Date
      // row[29] = Service Report Date
      // row[31] = Material Status
      // row[37] = Live Stage (Status)

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

      let finalAppId = appId ? appId.trim() : "";
      if (!finalAppId) {
        if (!clientName && !ticketId && !createdAtStr) {
          continue;
        }
        finalAppId = "N/A";
      }

      let finalTicketId = ticketId ? ticketId.trim() : "";
      if (!finalTicketId) {
        finalTicketId = `CLR-LEG-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Date.now().toString().slice(-4)}`;
      }

      // Skip duplicate ticket numbers to prevent constraint failure crashes
      const existingTicket = await prisma.ticket.findUnique({
        where: { ticketNumber: finalTicketId }
      });
      if (existingTicket) {
        continue;
      }

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
            installationDate: finalAppId === "N/A" ? null : safeDate(instDateStr),
            address: fullAddress,
            stateId,
            districtId
          },
          create: {
            applicationId: finalAppId,
            clientName: finalAppId === "N/A" ? "N/A" : clientName,
            installationDate: finalAppId === "N/A" ? null : safeDate(instDateStr),
            address: fullAddress,
            stateId,
            districtId
          }
        });
        processedInstallations.add(finalAppId);
        installationsCount++;
      }

      // 3. Upsert Engineer
      let engineerDbId = "";
      if (engName && engEmail && engPhone) {
        // If stateId is null, map it to a default or check
        let engProfile = await prisma.engineer.findUnique({
          where: { email: engEmail }
        });

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
      const complaintDate = safeDate(createdAtStr) || new Date();
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
      // Live stage could map to states (RECEIVED, ASSIGNED, INITIAL_VISIT_COMPLETED, RESOLVED, etc.)
      const ticket = await prisma.ticket.create({
        data: {
          ticketNumber: finalTicketId,
          complaintId: complaint.id,
          status: liveStageStr === "RESOLVED" ? "RESOLVED" : liveStageStr,
          priority: priorityStr,
          createdAt: complaintDate,
          dueDate: new Date(complaintDate.getTime() + 72 * 60 * 60 * 1000) // Default 72 hours due date
        }
      });
      ticketsCount++;

      // 6. Create Ticket Assignment if Engineer exists
      if (engineerDbId) {
        const assignDate = safeDate(assignedAtStr) || complaintDate;
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
        const visitDate = safeDate(initialVisitDateStr) || complaintDate;
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
        const reportDate = safeDate(serviceReportDateStr) || complaintDate;
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
        const matRequest = await prisma.materialRequest.create({
          data: {
            ticketId: ticket.id,
            requestedBy: engineerDbId,
            status: materialStatusStr.toUpperCase() === "SUBMITTED" ? "PENDING" : materialStatusStr.toUpperCase(),
            remarks: "Required controller wiring components."
          }
        });

        // Add a sample material item
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
          newStatus: liveStageStr,
          changedBy: adminUser.id,
          changeSummary: `Ticket imported from Google Sheets. Initial Status: ${liveStageStr}.`
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

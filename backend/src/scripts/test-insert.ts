import { parseCSV } from "../utils/csv.js";
import { parseSafeDate } from "../utils/date.js";
import { normalizeStatus, normalizePriority } from "../utils/status.js";
import { randomUUID } from "crypto";
import { prisma } from "../db.js";

async function testInsert() {
  console.log("🚀 Running step-by-step database insert simulation...");

  const SPREADSHEET_ID = "14ZCBnG-TBiS9wYrOe9zRkVJfdKt1vvVhZTZGUi842gw";
  const gid = "755478552";

  const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=${gid}`;
  const response = await fetch(url);
  const csvText = await response.text();

  const rows = parseCSV(csvText);
  const headers = rows[0].map(h => h.trim().replace(/^\uFEFF/, ""));
  const dataRows = rows.slice(1);

  // 1. Seed admin
  const adminRole = await prisma.role.upsert({
    where: { name: "Admin" },
    update: {},
    create: { name: "Admin", description: "Admin" }
  });

  const engineerRole = await prisma.role.upsert({
    where: { name: "Engineer" },
    update: {},
    create: { name: "Engineer", description: "Engineer" }
  });

  const processedInstallations = new Set<string>();
  const processedTicketNumbers = new Set<string>();

  const complaints: any[] = [];
  const tickets: any[] = [];
  const ticketAssignments: any[] = [];

  for (let index = 0; index < dataRows.length; index++) {
    const row = dataRows[index];
    const rowNumber = index + 2;

    const getVal = (colName: string) => {
      const idx = headers.indexOf(colName);
      return (idx !== -1 && row[idx] !== undefined && row[idx] !== null) ? row[idx].toString().trim() : "";
    };

    const applicationId = getVal("Application ID");
    const clientName = getVal("Customer Name") || "Unknown Client";
    const ticketNumberStr = getVal("Ticket ID");
    const engineerEmail = getVal("Engineer Email") || getVal("Assigned Engineer Email");
    const assignedEngineerName = getVal("Assigned Engineer Name");

    let finalAppId = applicationId ? applicationId.trim().toUpperCase() : "";
    if (!finalAppId) {
      if (!clientName && !ticketNumberStr) continue;
      finalAppId = "N/A";
    }

    let finalTicketNumber = ticketNumberStr ? ticketNumberStr.trim().toUpperCase() : "";
    if (!finalTicketNumber) {
      finalTicketNumber = `CLR-${rowNumber}-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    if (processedTicketNumbers.has(finalTicketNumber)) {
      continue;
    }
    processedTicketNumbers.add(finalTicketNumber);

    const complaintId = randomUUID();
    complaints.push({
      id: complaintId,
      formResponseId: rowNumber.toString(),
      applicationId: finalAppId,
      complainantName: clientName.trim(),
      complainantPhone: "N/A",
      complaintType: "Test",
      submissionTimestamp: new Date(),
      syncStatus: "SYNCED"
    });

    const ticketId = randomUUID();
    tickets.push({
      id: ticketId,
      ticketNumber: finalTicketNumber,
      complaintId,
      status: "RECEIVED",
      priority: "STANDARD"
    });

    if (engineerEmail && engineerEmail.trim() && assignedEngineerName) {
      ticketAssignments.push({
        id: randomUUID(),
        ticketId,
        engineerId: "some-eng-id-mock", // we will mock or lookup
        assignedAt: new Date()
      });
    }
  }

  console.log(`Parsed ${complaints.length} complaints, ${tickets.length} tickets, ${ticketAssignments.length} assignments.`);

  // Let's run a test query to find if any ticket is skipped when we execute transaction
  // We'll run it in a transaction rollback block
  await prisma.$transaction(async (tx) => {
    // Clear
    await tx.ticketHistory.deleteMany();
    await tx.materialRequestItem.deleteMany();
    await tx.materialRequest.deleteMany();
    await tx.serviceReport.deleteMany();
    await tx.initialVisit.deleteMany();
    await tx.ticketAssignment.deleteMany();
    await tx.ticket.deleteMany();
    await tx.complaint.deleteMany();

    console.log("Cleared live DB tables in transaction.");

    // Seed a mock engineer
    const mockUser = await tx.user.upsert({
      where: { email: "mock_eng@claro.com" },
      update: {},
      create: {
        email: "mock_eng@claro.com",
        fullName: "Mock Eng",
        passwordHash: "x",
        roleId: engineerRole.id
      }
    });

    const mockEng = await tx.engineer.create({
      data: {
        userId: mockUser.id,
        name: "Mock Eng",
        email: "mock_eng@claro.com",
        phone: "000"
      }
    });

    // Update assignment array with real mock engineer ID
    const updatedAssignments = ticketAssignments.map(ta => ({
      ...ta,
      engineerId: mockEng.id
    }));

    // Insert complaints
    const complaintsResult = await tx.complaint.createMany({ data: complaints, skipDuplicates: true });
    console.log("Inserted complaints count:", complaintsResult.count);

    // Insert tickets
    const ticketsResult = await tx.ticket.createMany({ data: tickets, skipDuplicates: true });
    console.log("Inserted tickets count:", ticketsResult.count);

    if (ticketsResult.count !== tickets.length) {
      console.log(`⚠️ WARNING: ${tickets.length - ticketsResult.count} tickets were skipped!`);
    } else {
      console.log("✅ All tickets inserted successfully!");
    }

    // Try inserting assignments!
    console.log("Inserting ticket assignments...");
    const assignmentsResult = await tx.ticketAssignment.createMany({ data: updatedAssignments, skipDuplicates: true });
    console.log("Inserted assignments count:", assignmentsResult.count);

    throw new Error("ROLLBACK");
  }).catch(err => {
    if (err.message !== "ROLLBACK") {
      console.error("❌ Transaction failed with error:", err);
    } else {
      console.log("Transaction rolled back safely.");
    }
  });
}

testInsert().catch(console.error).finally(() => prisma.$disconnect());

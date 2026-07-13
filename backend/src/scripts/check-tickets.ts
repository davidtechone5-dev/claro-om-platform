import { parseCSV } from "../utils/csv.js";
import { parseSafeDate } from "../utils/date.js";
import { normalizeStatus, normalizePriority } from "../utils/status.js";
import { randomUUID } from "crypto";

async function analyze() {
  const SPREADSHEET_ID = "14ZCBnG-TBiS9wYrOe9zRkVJfdKt1vvVhZTZGUi842gw";
  const gid = "755478552";

  const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=${gid}`;
  const response = await fetch(url);
  const csvText = await response.text();

  const rows = parseCSV(csvText);
  const headers = rows[0].map(h => h.trim().replace(/^\uFEFF/, ""));
  const dataRows = rows.slice(1);

  console.log("Headers count:", headers.length);
  console.log("Data rows count:", dataRows.length);

  const processedTicketNumbers = new Set<string>();
  const tickets: any[] = [];
  const ticketAssignments: any[] = [];

  for (let index = 0; index < dataRows.length; index++) {
    const row = dataRows[index];
    const rowNumber = index + 2;

    const getVal = (colName: string) => {
      const idx = headers.indexOf(colName);
      return (idx !== -1 && row[idx] !== undefined && row[idx] !== null) ? row[idx].toString().trim() : "";
    };

    const ticketNumberStr = getVal("Ticket ID");
    const engineerEmail = getVal("Engineer Email") || getVal("Assigned Engineer Email");
    const assignedEngineerName = getVal("Assigned Engineer Name");

    let finalTicketNumber = ticketNumberStr ? ticketNumberStr.trim().toUpperCase() : "";
    if (!finalTicketNumber) {
      finalTicketNumber = `CLR-${rowNumber}-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    if (processedTicketNumbers.has(finalTicketNumber)) {
      continue;
    }
    processedTicketNumbers.add(finalTicketNumber);

    const ticketId = randomUUID();
    tickets.push({ id: ticketId, ticketNumber: finalTicketNumber });

    if (engineerEmail && engineerEmail.trim() && assignedEngineerName) {
      ticketAssignments.push({ ticketId });
    }
  }

  console.log("Tickets array length:", tickets.length);
  console.log("Assignments array length:", ticketAssignments.length);

  // Check if every assignment's ticketId is in tickets
  const ticketIdsSet = new Set(tickets.map(t => t.id));
  let missingCount = 0;
  for (const ta of ticketAssignments) {
    if (!ticketIdsSet.has(ta.ticketId)) {
      console.log(`ERROR: Assignment references missing ticketId: ${ta.ticketId}`);
      missingCount++;
    }
  }

  if (missingCount === 0) {
    console.log("✅ All assignments map perfectly in memory!");
  } else {
    console.log(`❌ Found ${missingCount} unmapped assignments!`);
  }
}

analyze().catch(console.error);

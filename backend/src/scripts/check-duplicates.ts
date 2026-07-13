import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

async function checkDuplicates() {
  let SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
  if (!SPREADSHEET_ID) {
    console.error("No GOOGLE_SPREADSHEET_ID set.");
    return;
  }

  let gid = "";
  if (SPREADSHEET_ID.includes("docs.google.com/spreadsheets")) {
    const gidMatch = SPREADSHEET_ID.match(/[?&]gid=([^&#]+)/);
    if (gidMatch) {
      gid = gidMatch[1];
    }
    const match = SPREADSHEET_ID.match(/\/d\/([^/]+)/);
    if (match) {
      SPREADSHEET_ID = match[1];
    }
  }

  const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv${gid ? `&gid=${gid}` : ""}`;
  console.log("Fetching from:", url);

  const res = await fetch(url);
  const csvText = await res.text();

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

  const headers = rows[0].map((h) => (h || "").trim().replace(/^\uFEFF/, ""));
  const dataRows = rows.slice(1);

  const appIdx = headers.indexOf("Application ID");
  const nameIdx = headers.indexOf("Customer Name");
  const ticketIdx = headers.indexOf("Ticket ID");
  const dateIdx = headers.indexOf("Created At") !== -1 ? headers.indexOf("Created At") : headers.indexOf("Date");

  console.log(`Loaded ${dataRows.length} rows.`);

  const processed = new Set<string>();
  const duplicates = new Map<string, number[]>();

  dataRows.forEach((row, index) => {
    const rowNumber = index + 2;
    const rawId = row[appIdx] || "";
    const clientName = row[nameIdx] || "";
    const ticketId = row[ticketIdx] || "";
    const complaintDate = row[dateIdx] || "";

    let finalAppId = rawId.trim().toUpperCase();
    if (!finalAppId) {
      if (!clientName && !ticketId && !complaintDate) {
        return; // skipped empty row
      }
      finalAppId = "N/A";
    }

    if (processed.has(finalAppId)) {
      if (!duplicates.has(finalAppId)) {
        duplicates.set(finalAppId, []);
      }
      duplicates.get(finalAppId)!.push(rowNumber);
    } else {
      processed.add(finalAppId);
    }
  });

  if (duplicates.size === 0) {
    console.log("No duplicate Application IDs found in the sheet (after trimming and uppercasing)!");
  } else {
    console.log("Found duplicate Application IDs:");
    for (const [id, rows] of duplicates.entries()) {
      console.log(`- '${id}': duplicate found on rows: ${rows.join(", ")}`);
    }
  }
}

checkDuplicates().catch(console.error);

import dotenv from "dotenv";

dotenv.config();

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;

async function run() {
  if (!SPREADSHEET_ID) {
    console.error("No SPREADSHEET_ID set.");
    return;
  }
  let id = SPREADSHEET_ID;
  if (id.includes("docs.google.com/spreadsheets")) {
    const match = id.match(/\/d\/([^/]+)/);
    if (match) id = match[1];
  }

  const url = `https://docs.google.com/spreadsheets/d/${id}/edit`;
  console.log(`🔍 Fetching Google Sheet web page: ${url}`);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Failed to fetch page: ${response.statusText}`);
      return;
    }
    const html = await response.text();

    const foundSheets: { gid: string; name: string }[] = [];

    // Search via regex for sheet metadata. E.g. {"sheetId":0,"title":"Sheet1" ...}
    const sheetMetaRegex = /"sheetId"\s*:\s*(\d+)\s*,\s*"title"\s*:\s*"([^"]+)"/g;
    let metaMatch;
    while ((metaMatch = sheetMetaRegex.exec(html)) !== null) {
      foundSheets.push({ gid: metaMatch[1], name: metaMatch[2] });
    }

    // Try alternative pattern if none found
    if (foundSheets.length === 0) {
      const nameRegex = /"name"\s*:\s*"([^"]+)"\s*,\s*"id"\s*:\s*"([^"]+)"/g;
      while ((metaMatch = nameRegex.exec(html)) !== null) {
        foundSheets.push({ gid: metaMatch[2], name: metaMatch[1] });
      }
    }

    console.log("\n=================================");
    console.log("📊 DETECTED GOOGLE SHEET TABS:");
    console.log("=================================");
    if (foundSheets.length > 0) {
      // De-duplicate
      const uniqueSheets = Array.from(new Map(foundSheets.map(s => [s.name, s])).values());
      for (const sheet of uniqueSheets) {
        console.log(`👉 Tab Name: "${sheet.name}" (gid: ${sheet.gid})`);
      }
    } else {
      console.log("No sheet names found via regex scanning. Checking if sheet is shared publicly.");
    }
    console.log("=================================\n");

  } catch (error) {
    console.error("Error reading page metadata:", error);
  }
}

run();

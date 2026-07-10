import dotenv from "dotenv";

dotenv.config();

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;

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

async function fetchHeaders(sheetName: string) {
  if (!SPREADSHEET_ID) return;
  // Fallback if URL is set instead of ID
  let id = SPREADSHEET_ID;
  if (id.includes("docs.google.com/spreadsheets")) {
    const match = id.match(/\/d\/([^/]+)/);
    if (match) id = match[1];
  }
  const url = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}&range=A1:Z1`;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const text = await response.text();
    const parsed = parseCSV(text);
    return parsed[0] || null;
  } catch (e) {
    return null;
  }
}

async function run() {
  const tabs = [
    "Complaint Form",
    "Complaint",
    "Initial Visit Form",
    "Initial Visit",
    "Material Request Form",
    "Material Request",
    "Insurance Form",
    "Insurance",
    "Service Report Form",
    "Service Report",
    "Master Installations",
    "Engineer Registry",
    "Tickets"
  ];

  console.log("=================================================");
  console.log("🔍 FETCHING COLUMN HEADERS FROM SPREADSHEET TABS");
  console.log("=================================================");

  for (const tab of tabs) {
    const headers = await fetchHeaders(tab);
    if (headers) {
      console.log(`📌 Tab: "${tab}"`);
      console.log(`   Headers: [ ${headers.join(", ")} ]\n`);
    }
  }
}

run();

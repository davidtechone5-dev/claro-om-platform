import dotenv from "dotenv";

dotenv.config();

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;

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

async function run() {
  if (!SPREADSHEET_ID) return;
  let id = SPREADSHEET_ID;
  if (id.includes("docs.google.com/spreadsheets")) {
    const match = id.match(/\/d\/([^/]+)/);
    if (match) id = match[1];
  }

  // Let's fetch the default tab
  const url = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv`;
  console.log(`Fetch URL: ${url}`);
  try {
    const response = await fetch(url);
    const text = await response.text();
    const rows = parseCSV(text);
    console.log(`Total Rows fetched: ${rows.length}`);
    console.log("--- First 5 Rows of Sheet ---");
    for (let i = 0; i < Math.min(5, rows.length); i++) {
      console.log(`Row ${i}:`, rows[i]);
    }
  } catch (e) {
    console.error(e);
  }
}

run();

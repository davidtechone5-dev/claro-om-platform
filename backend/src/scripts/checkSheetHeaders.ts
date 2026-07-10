import dotenv from "dotenv";

dotenv.config();

async function run() {
  let SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
  if (!SPREADSHEET_ID) {
    console.error("Missing SPREADSHEET_ID");
    return;
  }
  if (SPREADSHEET_ID.includes("docs.google.com/spreadsheets")) {
    const match = SPREADSHEET_ID.match(/\/d\/([^/]+)/);
    if (match) {
      SPREADSHEET_ID = match[1];
    }
  }
  const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv`;
  const response = await fetch(url);
  const text = await response.text();
  const firstLine = text.split(/\r?\n/)[0];
  console.log("Headers line:", firstLine);
}

run();

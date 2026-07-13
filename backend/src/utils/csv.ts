/**
 * Robust RFC 4180-compliant CSV parser without external dependencies.
 * Correctly handles commas inside quotes, escaped double quotes (""), and multiline values.
 */
export function parseCSV(csvText: string): string[][] {
  const result: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let currentVal = "";

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote: "" inside a quoted field
        currentVal += '"';
        i++; // Skip the next quote character
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(currentVal.trim());
      currentVal = "";
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++; // Skip LF if this is CRLF
      }
      row.push(currentVal.trim());
      result.push(row);
      row = [];
      currentVal = "";
    } else {
      currentVal += char;
    }
  }

  // Handle remaining trailing values after parsing loop
  if (row.length > 0 || currentVal !== "") {
    row.push(currentVal.trim());
    result.push(row);
  }

  // Return clean parsed entries, filtering out empty rows at the end
  return result.filter(r => r.length > 0 && r.some(cell => cell !== ""));
}

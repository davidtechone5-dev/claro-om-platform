/**
 * Robust date parsing utility supporting DD/MM/YYYY, MM/DD/YYYY, and standard ISO formats.
 */
export function parseSafeDate(dStr?: string | null): Date | null {
  if (!dStr) return null;
  const trimmed = dStr.trim();
  if (!trimmed) return null;

  // Try standard parsing first (works for ISO and YYYY-MM-DD)
  const standardParsed = new Date(trimmed);
  if (!isNaN(standardParsed.getTime())) {
    return standardParsed;
  }

  // Try DD/MM/YYYY or DD-MM-YYYY format matching (optionally with HH:MM:SS)
  const dmyMatch = trimmed.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1; // 0-indexed month
    const year = parseInt(dmyMatch[3], 10);
    const hour = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 0;
    const minute = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;
    const second = dmyMatch[6] ? parseInt(dmyMatch[6], 10) : 0;

    const parsedDate = new Date(year, month, day, hour, minute, second);
    if (!isNaN(parsedDate.getTime())) {
      return parsedDate;
    }
  }

  // Fallback: Try regex parsing of typical US dates if DMY failed
  const mdyMatch = trimmed.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})/);
  if (mdyMatch) {
    // If we have a pattern but new Date() returned Invalid Date, try flipping fields
    const parsed = new Date(trimmed.replace(/-/g, "/"));
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
}

/**
 * Robust date parsing utility supporting MDY for system creation timestamps and DMY for manual logs.
 */

export function parseMDYDate(dStr?: string | null): Date | null {
  if (!dStr) return null;
  const trimmed = dStr.trim();
  if (!trimmed) return null;

  if (/^\d{4}[/\-]/.test(trimmed)) {
    const parsed = new Date(trimmed);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  const mdyMatch = trimmed.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4}|\d{2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (mdyMatch) {
    const month = parseInt(mdyMatch[1], 10) - 1;
    const day = parseInt(mdyMatch[2], 10);
    let year = parseInt(mdyMatch[3], 10);
    if (year < 100) year += 2000;

    const hour = mdyMatch[4] ? parseInt(mdyMatch[4], 10) : 0;
    const minute = mdyMatch[5] ? parseInt(mdyMatch[5], 10) : 0;
    const second = mdyMatch[6] ? parseInt(mdyMatch[6], 10) : 0;

    const parsedDate = new Date(year, month, day, hour, minute, second);
    return isNaN(parsedDate.getTime()) ? null : parsedDate;
  }

  const standardParsed = new Date(trimmed);
  return isNaN(standardParsed.getTime()) ? null : standardParsed;
}

export function parseDMYDate(dStr?: string | null): Date | null {
  if (!dStr) return null;
  const trimmed = dStr.trim();
  if (!trimmed) return null;

  if (/^\d{4}[/\-]/.test(trimmed)) {
    const parsed = new Date(trimmed);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  const dmyMatch = trimmed.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4}|\d{2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (dmyMatch) {
    const firstNum = parseInt(dmyMatch[1], 10);
    const secondNum = parseInt(dmyMatch[2], 10);
    let year = parseInt(dmyMatch[3], 10);
    if (year < 100) year += 2000;

    const hour = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 0;
    const minute = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;
    const second = dmyMatch[6] ? parseInt(dmyMatch[6], 10) : 0;

    let day = firstNum;
    let month = secondNum - 1;

    if (secondNum > 12) {
      month = firstNum - 1;
      day = secondNum;
    }

    const parsedDate = new Date(year, month, day, hour, minute, second);
    return isNaN(parsedDate.getTime()) ? null : parsedDate;
  }

  const standardParsed = new Date(trimmed);
  return isNaN(standardParsed.getTime()) ? null : standardParsed;
}

export function parseSafeDate(dStr?: string | null): Date | null {
  return parseDMYDate(dStr);
}

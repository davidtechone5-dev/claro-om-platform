/**
 * Normalizes status strings from Google Sheets to standard database statuses.
 */
export function normalizeStatus(statusStr: string): string | null {
  const s = statusStr.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "");
  if (s === "RECEIVED" || s === "RAISED" || s === "1TICKETRAISED" || s === "TICKETRAISED") return "RECEIVED";
  if (s === "ASSIGNED" || s === "2ASSIGNED") return "ASSIGNED";
  if (s === "VISITED" || s === "INITIALVISITCOMPLETED" || s === "INITIALVISITDONE" || s === "3DIAGNOSTICCHECKED" || s === "DIAGNOSTICCHECKED") return "INITIAL_VISIT_COMPLETED";
  if (s === "MATERIALREQ" || s === "MATERIALREQUESTED" || s === "4MATERIALREQUESTED" || s === "MATERIALSREQUIRED" || s === "MATERIALREQUIRED" || s === "MATERIALSREQUESTED" || s === "4MATERIALSREQUIRED") return "MATERIAL_REQUESTED";
  if (s === "INSURANCE" || s === "INSURANCESUBMITTED" || s === "5INSURANCESUBMITTED" || s === "INSURANCECLAIMSUBMITTED" || s === "INSURANCEMOVED") return "INSURANCE_SUBMITTED";
  if (s === "RESOLVED" || s === "FULLYRESOLVED" || s === "6FULLYRESOLVED" || s === "CLOSED" || s === "REMOTELYRESOLVED") return "RESOLVED";
  if (s === "VERIFIED") return "VERIFIED";
  if (s === "ONHOLD" || s === "ON_HOLD" || s === "HOLD") return "ON_HOLD";
  if (s === "OUTOFSCOPE" || s === "OUTOF_SCOPE" || s === "OUT_OF_SCOPE") return "OUT_OF_SCOPE";
  if (s === "MANUALASSIGN" || s === "MANUALASSIGNMENTREQUIRED" || s === "NEEDSASSIGNMENT" || s === "NEEDSMANUALASSIGNMENT") return "MANUAL_ASSIGNMENT_REQUIRED";
  return null;
}

/**
 * Normalizes priority strings from Google Sheets to standard database priorities.
 */
export function normalizePriority(priorityStr: string): string | null {
  const p = priorityStr.trim().toUpperCase();
  if (p === "CRITICAL") return "CRITICAL";
  if (p === "URGENT") return "URGENT";
  if (p === "STANDARD" || p === "NORMAL") return "STANDARD";
  if (p === "LOW") return "LOW";
  return null;
}

/**
 * Normalizes material request statuses to avoid enum validation crashes.
 */
export function normalizeMaterialStatus(statusStr: string): string {
  const s = statusStr.trim().toUpperCase();
  if (s === "APPROVED" || s === "APPROVE") return "APPROVED";
  if (s === "REJECTED" || s === "REJECT") return "REJECTED";
  if (s === "PENDING" || s === "SUBMITTED") return "PENDING";
  return "PENDING"; // Default safe fallback
}

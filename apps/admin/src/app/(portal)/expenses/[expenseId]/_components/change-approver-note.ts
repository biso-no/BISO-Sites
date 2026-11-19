/**
 * The note the change-approver dialog shows. Re-routing the general manager's
 * step (role `national`, also when it stands in for a missing president or
 * controller) never touches the approver directory, so it says the change is
 * for this reimbursement only. Every other step also updates the saved
 * approver for later reimbursements.
 */
export function changeApproverNoteKey(
  role: string
): "directoryNote" | "directorySkipped" {
  return role === "national" ? "directorySkipped" : "directoryNote";
}

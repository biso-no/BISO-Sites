export type MembershipLinkState =
  | "signed_out"
  | "needs_bi_link"
  | "needs_directory_record"
  | "linked";

/**
 * Which step of BI linking `/membership/link` shows. The app sends students
 * here because BI's tenant is reachable only through Appwrite's OIDC
 * provider, which only a browser holding the student's own session can use.
 */
export function resolveMembershipLinkState(input: {
  employeeId: string | null | undefined;
  isAuthenticated: boolean;
  studentId: string | null | undefined;
}): MembershipLinkState {
  if (!input.isAuthenticated) {
    return "signed_out";
  }
  if (!input.studentId) {
    return "needs_bi_link";
  }
  if (!input.employeeId) {
    return "needs_directory_record";
  }
  return "linked";
}

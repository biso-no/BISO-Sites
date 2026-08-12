/**
 * Parsing helpers for BI-issued student identifiers.
 *
 * `studentId` is the email local part exactly as BI issues it (`s1715738`) and
 * is what `user.student_id` stores — the member portal renders it and rebuilds
 * the address from it. `studentNumber` is the digits only, which is what every
 * Finago (24SevenOffice) lookup expects.
 */

export const BI_STUDENT_EMAIL_DOMAIN = "bi.no";

const NON_DIGITS_RE = /\D/g;
const BI_STUDENT_LOCAL_PART_RE = /^s\d+$/;

export function sanitizeStudentNumber(
  raw: string | null | undefined
): number | null {
  if (!raw) {
    return null;
  }
  const digits = raw.replace(NON_DIGITS_RE, "");
  if (!digits) {
    return null;
  }
  const parsed = Number.parseInt(digits, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Parse a BI student email address and extract identifiers.
 *
 * Accepts only the strict BI student format: `s<digits>@bi.no` (e.g., `s1715738@bi.no`).
 * Non-student bi.no addresses (e.g., staff: `firstname.lastname@bi.no`) are rejected
 * to prevent fabricated student numbers.
 *
 * @param email The email address to parse (trimmed and lowercased internally)
 * @returns Object with `studentId` (lowercased local part) and `studentNumber` (digits only),
 *          or null if the email does not match the strict student format
 */
export function parseBiStudentEmail(
  email: string | null | undefined
): { studentId: string; studentNumber: number } | null {
  if (!email) {
    return null;
  }

  const normalized = email.trim().toLowerCase();
  const atIndex = normalized.lastIndexOf("@");
  if (atIndex <= 0) {
    return null;
  }

  const domain = normalized.slice(atIndex + 1);
  if (domain !== BI_STUDENT_EMAIL_DOMAIN) {
    return null;
  }

  const studentId = normalized.slice(0, atIndex);
  if (!BI_STUDENT_LOCAL_PART_RE.test(studentId)) {
    return null;
  }

  const studentNumber = sanitizeStudentNumber(studentId);
  if (studentNumber === null) {
    return null;
  }

  return { studentId, studentNumber };
}

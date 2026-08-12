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
const HAS_DIGIT_RE = /\d/;

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
  if (!HAS_DIGIT_RE.test(studentId)) {
    return null;
  }

  const studentNumber = sanitizeStudentNumber(studentId);
  if (studentNumber === null) {
    return null;
  }

  return { studentId, studentNumber };
}

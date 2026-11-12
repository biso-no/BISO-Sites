const NUMBER_BASE = 10_000;
const NUMBER_WIDTH = 5;

/** Reimbursement number from `$sequence` (a string in node-appwrite). */
export function reimbursementNumber(sequence: number | string): string {
  return String(NUMBER_BASE + Number(sequence || 0)).padStart(
    NUMBER_WIDTH,
    "0"
  );
}

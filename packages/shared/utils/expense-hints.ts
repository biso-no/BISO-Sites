/**
 * Vocabulary for AI receipt issues and the hints shown to expense approvers.
 * Stored as JSON strings on the submission; parsers are tolerant so a bad or
 * outdated value never breaks a page.
 */

export const RECEIPT_ISSUE_CODES = [
  "not_a_receipt",
  "no_items",
  "unreadable",
  "missing_seller",
  "missing_date",
  "missing_total",
] as const;

export type ReceiptIssueCode = (typeof RECEIPT_ISSUE_CODES)[number];

export const APPROVER_HINT_CODES = [
  "amount_differs",
  "old_receipt",
  "possible_duplicate",
  "receipt_issue",
  "ai_account_unsure",
  "account_missing",
  "app_type_replaced",
  "type_defaulted",
  "occasion_missing",
  "type_unsure",
  "project_unsure",
  "project_missing",
  "project_not_created",
  "ai_check_incomplete",
  "ai_check_disagrees",
] as const;

export type ApproverHintCode = (typeof APPROVER_HINT_CODES)[number];

export interface ApproverHint {
  attachmentId?: string;
  code: ApproverHintCode;
  data?: Record<string, string | number>;
}

function parseJsonArray(value: string | null | undefined): unknown[] {
  if (!value) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isReceiptIssueCode(value: unknown): value is ReceiptIssueCode {
  return RECEIPT_ISSUE_CODES.some((code) => code === value);
}

function isApproverHintCode(value: unknown): value is ApproverHintCode {
  return APPROVER_HINT_CODES.some((code) => code === value);
}

const WHITESPACE_RUN = /\s+/g;
/** Longest text a hint carries; model-written reasons are cut to this. */
export const MAX_HINT_TEXT_CHARS = 200;

/** One line, at most `MAX_HINT_TEXT_CHARS` characters, ending in an ellipsis when cut. */
function tidyHintText(value: string): string {
  const oneLine = value.replace(WHITESPACE_RUN, " ").trim();
  const chars = Array.from(oneLine);
  return chars.length > MAX_HINT_TEXT_CHARS
    ? `${chars
        .slice(0, MAX_HINT_TEXT_CHARS - 1)
        .join("")
        .trimEnd()}…`
    : oneLine;
}

/**
 * Which text a hint uses: some codes have a longer form when they carry data.
 * The admin and the approval card both pick their wording with this.
 */
export function hintTextKey(
  code: string,
  data: Record<string, string | number> = {}
): string {
  if (code === "possible_duplicate" && data.reimbursementNumber) {
    return "possible_duplicate_number";
  }
  if ((code === "type_unsure" || code === "project_unsure") && data.reason) {
    return `${code}_reason`;
  }
  return code;
}

function pickHintData(
  value: unknown
): Record<string, string | number> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return;
  }
  const data: Record<string, string | number> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string") {
      data[key] = tidyHintText(entry);
    } else if (typeof entry === "number") {
      data[key] = entry;
    }
  }
  return data;
}

export function parseReceiptIssues(
  value: string | null | undefined
): ReceiptIssueCode[] {
  return parseJsonArray(value).filter(isReceiptIssueCode);
}

export function parseApproverHints(
  value: string | null | undefined
): ApproverHint[] {
  const hints: ApproverHint[] = [];
  for (const item of parseJsonArray(value)) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const { code, attachmentId, data } = item as Record<string, unknown>;
    if (!isApproverHintCode(code)) {
      continue;
    }
    const hint: ApproverHint = { code };
    if (typeof attachmentId === "string") {
      hint.attachmentId = attachmentId;
    }
    const picked = pickHintData(data);
    if (picked) {
      hint.data = picked;
    }
    hints.push(hint);
  }
  return hints;
}

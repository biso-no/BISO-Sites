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
/** Longest text a hint carries; model-written text is cut to this. */
export const MAX_HINT_TEXT_CHARS = 200;
/**
 * Longest reason a hint carries. Every receipt's hints share one column, so
 * a reason is kept short; the history keeps it whole.
 */
export const MAX_HINT_REASON_CHARS = 120;

/** The codes whose text shows `reason` (their `_reason` wording). */
const REASON_CODES = new Set<string>(["type_unsure", "project_unsure"]);

/**
 * The data each code's text can't do without. The rest only lengthens the
 * text (a reason, a reimbursement number) or is read by no text at all. A code
 * not listed reads well with none.
 */
const TEXT_DATA: Partial<Record<ApproverHintCode, readonly string[]>> = {
  ai_check_disagrees: ["aiType"],
  amount_differs: ["entered", "read"],
  app_type_replaced: ["aiType", "appType"],
  old_receipt: ["days"],
  project_not_created: ["series", "year"],
  receipt_issue: ["issue"],
};

/** One line, at most `max` characters, ending in an ellipsis when cut. */
function tidyHintText(value: string, max: number): string {
  const oneLine = value.replace(WHITESPACE_RUN, " ").trim();
  const chars = Array.from(oneLine);
  return chars.length > max
    ? `${chars
        .slice(0, max - 1)
        .join("")
        .trimEnd()}…`
    : oneLine;
}

/** Whether a code's text shows the hint's `reason`; only these store one. */
export function showsReason(code: string): boolean {
  return REASON_CODES.has(code);
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
  if (showsReason(code) && data.reason) {
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
      data[key] = tidyHintText(
        entry,
        key === "reason" ? MAX_HINT_REASON_CHARS : MAX_HINT_TEXT_CHARS
      );
    } else if (typeof entry === "number") {
      data[key] = entry;
    }
  }
  return data;
}

function withData(
  hint: ApproverHint,
  data: Record<string, string | number> | undefined
): ApproverHint {
  return {
    ...(hint.attachmentId === undefined
      ? {}
      : { attachmentId: hint.attachmentId }),
    code: hint.code,
    ...(data && Object.keys(data).length > 0 ? { data } : {}),
  };
}

/**
 * A hint as it is written to the column: its texts on one line and capped,
 * a reason at `MAX_HINT_REASON_CHARS`, and only on a code whose text shows
 * it (`showsReason`).
 */
export function storedHint(hint: ApproverHint): ApproverHint {
  const data = pickHintData(hint.data);
  if (!data || showsReason(hint.code)) {
    return withData(hint, data);
  }
  const { reason: _unshown, ...shown } = data;
  return withData(hint, shown);
}

/**
 * The hint's shortest form that still reads right: only the data its text
 * needs (`TEXT_DATA`). Used when the hints don't fit their column, before a
 * hint is dropped.
 */
export function codeOnlyHint(hint: ApproverHint): ApproverHint {
  const needed = TEXT_DATA[hint.code] ?? [];
  const data = Object.fromEntries(
    Object.entries(hint.data ?? {}).filter(([key]) => needed.includes(key))
  );
  return withData(hint, data);
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

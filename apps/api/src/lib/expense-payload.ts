import { Permission, Role } from "@repo/api";
import { ExpensesStatus } from "@repo/api/types/appwrite";
import { DEFAULT_COST_TYPE_SLUG } from "@repo/shared/utils/expense-cost-types";
import { z } from "zod";

const COST_TYPE_TEXT_MAX = 120;
const OCCASION_MAX = 1000;
const EVENT_ID_MAX = 64;

/**
 * One receipt as a client sends it. Server-owned columns (`ai_*`,
 * `ocr_amount`, `receipt_issues`, `file_hash`, `account_*`, `tax_code`,
 * `type_source`) are not in the schema, so whatever a client sends for them is
 * stripped here and never stored.
 */
const ExpenseAttachmentInputSchema = z
  .object({
    amount: z.coerce.number().finite().default(0),
    cost_type: z.string().nullish(),
    /**
     * Sent by the web and app versions that know about AI types: present means
     * the client only sends a type the student chose or accepted. Old app
     * versions (2.2.15, 2.2.16) never send it.
     */
    cost_type_chosen: z.boolean().nullish(),
    /** The student's own words when no listed type fits. */
    cost_type_text: z.string().trim().max(COST_TYPE_TEXT_MAX).nullish(),
    date: z.string().optional().default(""),
    description: z.string().optional().default(""),
    sort_order: z.coerce.number().int().nonnegative().optional().default(0),
    type: z.string().optional().default("application/octet-stream"),
    url: z.string().optional().default(""),
  })
  .transform(({ cost_type, ...attachment }) => ({
    ...attachment,
    // An old app's empty type has always meant "Other". A client that sends
    // `cost_type_chosen` leaves an empty type empty, so the server decides it
    // at submission instead of booking it silently to "Other".
    cost_type: isLegacyAttachment(attachment)
      ? cost_type || DEFAULT_COST_TYPE_SLUG
      : (cost_type ?? ""),
  }));

const ExpensePayloadSchema = z.object({
  bank_account: z.string().min(1),
  campus: z.string().min(1),
  department: z.string().min(1),
  description: z.string().nullable().optional(),
  event_id: z.string().max(EVENT_ID_MAX).nullish(),
  eventName: z.string().nullable().optional(),
  expenseAttachments: z.array(ExpenseAttachmentInputSchema).optional(),
  expenseId: z.string().min(1).optional(),
  occasion: z.string().trim().max(OCCASION_MAX).nullish(),
  prepayment_amount: z.coerce.number().finite().nullable().optional(),
  submitter_is_financial_manager: z.boolean().optional().default(false),
  total: z.coerce.number().finite().default(0),
});

export type ExpenseAttachmentInput = z.infer<
  typeof ExpenseAttachmentInputSchema
>;

export type ExpensePayload = z.infer<typeof ExpensePayloadSchema>;

/** An attachment as the draft writes it: `cost_type_chosen` is never stored. */
export interface ExpenseAttachmentRowInput {
  amount: number;
  cost_type: string;
  cost_type_text: string | null;
  date: string;
  description: string;
  sort_order: number;
  type: string;
  url: string;
}

export interface ExpenseRowInput {
  bank_account: string;
  campus: string;
  campusRel: string;
  department: string;
  departmentRel: string;
  description: string | null;
  event_id: string | null;
  eventName: string | null;
  expenseAttachments: ExpenseAttachmentRowInput[];
  occasion: string | null;
  prepayment_amount: number | null;
  status: ExpensesStatus;
  submitter_is_financial_manager: boolean;
  total: number;
  user: string;
  userId: string;
}

/** True for an attachment from an app version that predates AI types. */
export function isLegacyAttachment(attachment: {
  cost_type_chosen?: boolean | null;
}): boolean {
  return attachment.cost_type_chosen == null;
}

/**
 * True for a payload from an app version that predates AI types: no
 * attachment carries `cost_type_chosen`.
 */
export function isLegacyPayload(
  payload: Pick<ExpensePayload, "expenseAttachments">
): boolean {
  return (payload.expenseAttachments ?? []).every(isLegacyAttachment);
}

export function parseExpensePayload(body: unknown): ExpensePayload | null {
  const parsed = ExpensePayloadSchema.safeParse(body);
  return parsed.success ? parsed.data : null;
}

function toAttachmentRow(
  attachment: ExpenseAttachmentInput
): ExpenseAttachmentRowInput {
  return {
    amount: attachment.amount,
    cost_type: attachment.cost_type,
    cost_type_text: attachment.cost_type_text || null,
    date: attachment.date,
    description: attachment.description,
    sort_order: attachment.sort_order,
    type: attachment.type,
    url: attachment.url,
  };
}

export function buildExpenseRowInput(
  data: ExpensePayload,
  userId: string,
  status: ExpensesStatus = ExpensesStatus.DRAFT
): ExpenseRowInput {
  return {
    bank_account: data.bank_account,
    campus: data.campus,
    campusRel: data.campus,
    department: data.department,
    departmentRel: data.department,
    description: data.description || null,
    event_id: data.event_id || null,
    eventName: data.eventName || null,
    expenseAttachments: (data.expenseAttachments ?? []).map(toAttachmentRow),
    occasion: data.occasion || null,
    prepayment_amount: data.prepayment_amount ?? 0,
    status,
    submitter_is_financial_manager:
      data.submitter_is_financial_manager ?? false,
    total: data.total,
    user: userId,
    userId,
  };
}

/** The stored type of one attachment row, as the draft merge reads it. */
export interface StoredAttachmentType {
  cost_type?: string | null;
  cost_type_text?: string | null;
  url?: string | null;
}

/** One key per file, whether the url is a bare id or a full view URL. */
export function attachmentFileKey(
  url: string | null | undefined
): string | null {
  return receiptFileId(url) ?? (url?.trim() || null);
}

/**
 * Keeps the student's stored type when an old app re-saves a draft.
 *
 * Old app versions send a type for every receipt (a default when the student
 * didn't pick one) and know nothing of `cost_type_text`, so a web draft opened
 * in the app would otherwise lose the type chosen on the web. For each
 * incoming legacy attachment whose file the draft already has, the stored
 * `cost_type` and `cost_type_text` win; a client that sends
 * `cost_type_chosen` is taken as sent.
 */
export function mergeLegacyAttachmentTypes(
  incoming: ExpenseAttachmentInput[],
  existing: readonly StoredAttachmentType[]
): ExpenseAttachmentInput[] {
  const stored = new Map<string, StoredAttachmentType>();
  for (const row of existing) {
    const key = attachmentFileKey(row.url);
    const hasChoice = Boolean(row.cost_type || row.cost_type_text);
    if (key && hasChoice && !stored.has(key)) {
      stored.set(key, row);
    }
  }

  return incoming.map((attachment) => {
    const key = attachmentFileKey(attachment.url);
    const row = key ? stored.get(key) : undefined;
    if (!(row && isLegacyAttachment(attachment))) {
      return attachment;
    }
    return {
      ...attachment,
      cost_type: row.cost_type ?? "",
      cost_type_text: row.cost_type_text ?? undefined,
    };
  });
}

/** What the draft merge reads from the stored draft. */
export interface StoredDraft {
  event_id?: string | null;
  expenseAttachments?: readonly StoredAttachmentType[] | null;
  occasion?: string | null;
}

/**
 * The payload to save over a stored draft. Old app versions know nothing of
 * the student's own type text, the occasion or the matched event, so when an
 * old app re-saves or submits a draft made on the web, the draft's types (see
 * `mergeLegacyAttachmentTypes`) and, unless the payload sends them, its
 * `occasion` and `event_id` are kept. A client that sends `cost_type_chosen`
 * clears those two by leaving them out.
 */
export function mergeLegacyDraft(
  payload: ExpensePayload,
  existing: StoredDraft
): ExpensePayload {
  const merged: ExpensePayload = {
    ...payload,
    expenseAttachments: mergeLegacyAttachmentTypes(
      payload.expenseAttachments ?? [],
      existing.expenseAttachments ?? []
    ),
  };
  if (!isLegacyPayload(payload)) {
    return merged;
  }
  return {
    ...merged,
    event_id:
      payload.event_id === undefined ? existing.event_id : payload.event_id,
    occasion:
      payload.occasion === undefined ? existing.occasion : payload.occasion,
  };
}

/**
 * Row permissions for an expense: the submitter can read it, nothing more.
 *
 * Ledger posting pays out the row's `total` to its `bank_account` as they
 * stand at posting time, and approvals do not record the amount, so a
 * submitter who could edit the row could change either after approval. Every
 * change therefore goes through apps/api with the admin key, after an
 * ownership check.
 */
export function buildExpenseRowPermissions(userId: string): string[] {
  return [Permission.read(Role.user(userId))];
}

const APPWRITE_FILE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/;

const STORAGE_FILE_URL_RE =
  /\/storage\/buckets\/[^/?#]+\/files\/([^/?#]+)\/(?:view|preview|download)(?:[/?#]|$)/;

function decodeSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    // A stray "%" is not an encoding; take the segment as written.
    return value;
  }
}

/**
 * The `expenses` bucket file id one attachment `url` names, or null.
 *
 * Receipts uploaded through the web or `POST /api/expenses/attachments` store
 * a bare file id, but older rows stored the whole view URL. Both forms name
 * the same file, so both have to resolve to the same id: a reference check
 * that compared the raw strings would not see a legacy row pointing at the
 * file a newer draft names, and would delete a receipt that is still in use.
 */
export function receiptFileId(url: string | null | undefined): string | null {
  const value = url?.trim() ?? "";
  if (!value) {
    return null;
  }
  if (APPWRITE_FILE_ID_RE.test(value)) {
    return value;
  }

  const fromUrl = STORAGE_FILE_URL_RE.exec(value)?.[1];
  if (!fromUrl) {
    return null;
  }
  const decoded = decodeSegment(fromUrl);
  return APPWRITE_FILE_ID_RE.test(decoded) ? decoded : null;
}

/**
 * The `expenses` bucket file ids a draft's attachments point at, once each.
 *
 * Anything that names no file — an empty value, a URL that is not an Appwrite
 * storage URL — is not a file this API may delete.
 */
export function receiptFileIds(
  attachments: ReadonlyArray<{ url?: string | null }> | null | undefined
): string[] {
  const ids = (attachments ?? [])
    .map((attachment) => receiptFileId(attachment.url))
    .filter((id): id is string => id !== null);
  return [...new Set(ids)];
}

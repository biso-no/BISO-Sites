import { fastModel } from "@repo/ai/models";
import {
  AI_TYPE_CONFIDENCE_THRESHOLD,
  type CostTypeOption,
  DEFAULT_COST_TYPE_SLUG,
  findCostType,
} from "@repo/shared/utils/expense-cost-types";
import type { ApproverHint } from "@repo/shared/utils/expense-hints";
import { generateObject } from "ai";
import { z } from "zod";
import type { CostAccountOption } from "./expense-types";
import type { ExtractedReceipt, StoredScan } from "./receipt-scan";

const OLD_RECEIPT_DAYS = 90;
const AMOUNT_TOLERANCE_NOK = 1;
const MS_PER_DAY = 86_400_000;

export interface AttachmentDecisionInput {
  amount: number;
  attachmentId: string;
  /** The payload's `cost_type_chosen`; false means a legacy app payload. */
  chosen: boolean;
  clientCostType: string | null;
  clientText: string | null;
  date: string | null;
  isSupportingDoc: boolean;
  scan: StoredScan | null;
}

export interface AttachmentDecision {
  accountNumber: number | null;
  accountSource: "type" | "ai_freeform" | null;
  aiConfidence: number | null;
  aiCostType: string | null;
  attachmentId: string;
  costType: string | null;
  costTypeText: string | null;
  hints: ApproverHint[];
  needsAiAccount: boolean;
  taxCode: number | null;
  typeSource: "ai" | "student" | "legacy_app";
}

function withType(
  base: AttachmentDecision,
  slug: string,
  types: CostTypeOption[]
): AttachmentDecision {
  const type = findCostType(slug, types);
  return {
    ...base,
    accountNumber: type?.accountNumber ?? null,
    accountSource: type ? "type" : null,
    costType: slug,
    taxCode: type?.taxCode ?? null,
  };
}

interface DecisionContext {
  aiConfident: boolean;
  aiEnabled: boolean;
  aiSlug: string | null;
  clientSlug: string | null;
  decision: AttachmentDecision;
  input: AttachmentDecisionInput;
  types: CostTypeOption[];
}

function defaulted(
  decision: AttachmentDecision,
  types: CostTypeOption[]
): AttachmentDecision {
  return withType(
    {
      ...decision,
      hints: [{ attachmentId: decision.attachmentId, code: "type_defaulted" }],
    },
    DEFAULT_COST_TYPE_SLUG,
    types
  );
}

function decideChosen(ctx: DecisionContext): AttachmentDecision {
  const { aiConfident, aiEnabled, aiSlug, clientSlug, decision, input, types } =
    ctx;
  if (clientSlug) {
    return withType(
      { ...decision, typeSource: clientSlug === aiSlug ? "ai" : "student" },
      clientSlug,
      types
    );
  }
  const text = input.clientText?.trim();
  if (text) {
    return {
      ...decision,
      accountSource: aiEnabled ? "ai_freeform" : null,
      costTypeText: text,
      hints: aiEnabled
        ? []
        : [{ attachmentId: decision.attachmentId, code: "account_missing" }],
      needsAiAccount: aiEnabled,
    };
  }
  if (aiConfident && aiSlug) {
    return withType({ ...decision, typeSource: "ai" }, aiSlug, types);
  }
  return defaulted({ ...decision, typeSource: "ai" }, types);
}

function decideLegacy(ctx: DecisionContext): AttachmentDecision {
  const { aiConfident, aiSlug, clientSlug, decision, input, types } = ctx;
  const legacy = { ...decision, typeSource: "legacy_app" as const };
  if (aiConfident && aiSlug && aiSlug !== input.clientCostType) {
    return withType(
      {
        ...legacy,
        hints: [
          {
            attachmentId: decision.attachmentId,
            code: "app_type_replaced",
            data: { aiType: aiSlug, appType: input.clientCostType ?? "" },
          },
        ],
      },
      aiSlug,
      types
    );
  }
  if (clientSlug) {
    return withType(legacy, clientSlug, types);
  }
  return defaulted(legacy, types);
}

export function decideAttachment(
  input: AttachmentDecisionInput,
  types: CostTypeOption[],
  aiEnabled: boolean
): AttachmentDecision {
  const base: AttachmentDecision = {
    accountNumber: null,
    accountSource: null,
    aiConfidence: null,
    aiCostType: null,
    attachmentId: input.attachmentId,
    costType: null,
    costTypeText: null,
    hints: [],
    needsAiAccount: false,
    taxCode: null,
    typeSource: "student",
  };
  if (input.amount <= 0 || input.isSupportingDoc) {
    return base;
  }
  const ai = input.scan?.classification ?? null;
  const aiSlug = ai?.costType ?? null;
  // A stored classification may predate a deactivated type: only active slugs count.
  const aiConfident =
    aiSlug !== null &&
    ai !== null &&
    ai.confidence >= AI_TYPE_CONFIDENCE_THRESHOLD &&
    types.some((type) => type.slug === aiSlug);
  const ctx: DecisionContext = {
    aiConfident,
    aiEnabled,
    aiSlug,
    clientSlug: findCostType(input.clientCostType, types)?.slug ?? null,
    decision: {
      ...base,
      aiConfidence: ai?.confidence ?? null,
      aiCostType: aiSlug,
    },
    input,
    types,
  };
  return input.chosen ? decideChosen(ctx) : decideLegacy(ctx);
}

function dayNumber(value: string): number | null {
  const [year, month, day] = value.split("-").map(Number);
  if (!(year && month && day)) {
    return null;
  }
  return Math.floor(Date.UTC(year, month - 1, day) / MS_PER_DAY);
}

interface HintAttachment {
  amount: number;
  attachmentId: string;
  date: string | null;
  duplicate: { reimbursementNumber: string } | null;
  scan: StoredScan | null;
}

function attachmentHints(
  attachment: HintAttachment,
  today: number | null
): ApproverHint[] {
  const { attachmentId, amount, date, duplicate, scan } = attachment;
  if (amount <= 0) {
    return [];
  }
  const hints: ApproverHint[] = [];
  if (scan) {
    const read = scan.amountInNok ?? scan.receipt.amount;
    if (read !== null && Math.abs(amount - read) > AMOUNT_TOLERANCE_NOK) {
      hints.push({
        attachmentId,
        code: "amount_differs",
        data: { entered: amount, read },
      });
    }
  }
  const receiptDay = date ? dayNumber(date) : null;
  if (today !== null && receiptDay !== null) {
    const days = today - receiptDay;
    if (days > OLD_RECEIPT_DAYS) {
      hints.push({ attachmentId, code: "old_receipt", data: { days } });
    }
  }
  if (duplicate) {
    hints.push({
      attachmentId,
      code: "possible_duplicate",
      data: { reimbursementNumber: duplicate.reimbursementNumber },
    });
  }
  for (const issue of scan?.receipt.receiptIssues ?? []) {
    hints.push({ attachmentId, code: "receipt_issue", data: { issue } });
  }
  return hints;
}

export function computeApproverHints(input: {
  attachments: HintAttachment[];
  decisions: AttachmentDecision[];
  today: string;
}): ApproverHint[] {
  const today = dayNumber(input.today);
  return [
    ...input.attachments.flatMap((attachment) =>
      attachmentHints(attachment, today)
    ),
    ...input.decisions.flatMap((decision) => decision.hints),
  ];
}

const AccountChoiceSchema = z.object({
  accountNumber: z.number(),
  confidence: z.number(),
  reason: z.string(),
});

const MAX_PROMPT_VALUE = 200;
const WHITESPACE_RUN = /\s+/g;

function clean(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") {
    return "unknown";
  }
  return String(value)
    .replace(WHITESPACE_RUN, " ")
    .trim()
    .slice(0, MAX_PROMPT_VALUE);
}

export async function chooseAccountForText(input: {
  accounts: CostAccountOption[];
  receipt: ExtractedReceipt | null;
  text: string;
  types: CostTypeOption[];
}): Promise<{
  accountNumber: number;
  confidence: number;
  reason: string;
} | null> {
  const { accounts, receipt, text, types } = input;
  const prompt = [
    "A student bought something for a student organisation and described the expense type in their own words. Pick the ledger account it should be booked on.",
    "",
    "Existing expense types and the account each one uses:",
    ...types.map((type) => `${type.label} → ${type.accountNumber}`),
    "",
    "All accounts you may choose from:",
    ...accounts.map((account) => `${account.accountNumber} ${account.name}`),
    "",
    `Student's description of the expense type: ${clean(text)}`,
    `Vendor: ${clean(receipt?.vendor)}`,
    `Receipt description: ${clean(receipt?.description)}`,
    "",
    "Answer with exactly one account number from the list, a confidence between 0 and 1, and a one-sentence reason.",
  ].join("\n");
  try {
    const { object } = await generateObject({
      model: fastModel,
      prompt,
      reasoning: "low",
      schema: AccountChoiceSchema,
    });
    if (!accounts.some((a) => a.accountNumber === object.accountNumber)) {
      return null;
    }
    const confidence = Number.isFinite(object.confidence)
      ? Math.min(1, Math.max(0, object.confidence))
      : 0;
    return {
      accountNumber: object.accountNumber,
      confidence,
      reason: object.reason,
    };
  } catch {
    return null;
  }
}

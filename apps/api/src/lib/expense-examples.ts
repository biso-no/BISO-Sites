import { ID, Query } from "@repo/api";
import type { createAdminClient } from "@repo/api/server";
import type { ExpenseTypeExamples } from "@repo/api/types/appwrite";
import type { CostTypeOption } from "@repo/shared/utils/expense-cost-types";
import type { TypeExample } from "./receipt-scan";

type Db = Awaited<ReturnType<typeof createAdminClient>>["db"];

const MAX_EXAMPLES = 10;
const MAX_VENDOR_EXAMPLES = 6;
const VENDOR_FETCH_LIMIT = 20;
const RECENT_FETCH_LIMIT = 100;
const VENDOR_KEY_MAX = 120;
const DESCRIPTION_MAX = 255;

const COMBINING_MARKS = /[̀-ͯ]/g;
const NON_WORD = /[^\p{L}\p{N}\s]/gu;
const WHITESPACE = /\s+/g;
const LEGAL_SUFFIX = /\s(?:as|asa|ab|ltd|inc)$/;
const KEPT_LETTERS = new Set(["æ", "ø", "å"]);

function stripDiacritics(text: string): string {
  let out = "";
  for (const char of text) {
    out += KEPT_LETTERS.has(char)
      ? char
      : char.normalize("NFD").replace(COMBINING_MARKS, "");
  }
  return out;
}

export function normalizeVendor(vendor: string | null | undefined): string {
  if (!vendor) {
    return "";
  }
  const cleaned = stripDiacritics(vendor.toLowerCase())
    .replace(NON_WORD, " ")
    .replace(WHITESPACE, " ")
    .trim()
    .replace(LEGAL_SUFFIX, "")
    .trim();
  return cleaned.slice(0, VENDOR_KEY_MAX);
}

function toExample(row: ExpenseTypeExamples): TypeExample | null {
  if (!row.final_cost_type) {
    return null;
  }
  return {
    description: row.description ?? "",
    finalType: row.final_cost_type,
    source: row.source,
    vendorKey: row.vendor_key ?? "",
  };
}

async function vendorExamples(
  db: Db,
  vendorKey: string,
  activeSlugs: Set<string>
): Promise<TypeExample[]> {
  const { rows } = await db.listRows<ExpenseTypeExamples>(
    "app",
    "expense_type_examples",
    [
      Query.equal("vendor_key", vendorKey),
      Query.orderDesc("$createdAt"),
      Query.limit(VENDOR_FETCH_LIMIT),
    ]
  );
  const examples = rows
    .map(toExample)
    .filter(
      (e): e is TypeExample => e !== null && activeSlugs.has(e.finalType)
    );
  const weight = (e: TypeExample) => (e.source === "student" ? 1 : 0);
  // Array.sort is stable, so newest-first order holds within each group.
  return examples
    .sort((a, b) => weight(a) - weight(b))
    .slice(0, MAX_VENDOR_EXAMPLES);
}

async function recentPerType(
  db: Db,
  activeSlugs: Set<string>,
  seen: Set<string>,
  room: number
): Promise<TypeExample[]> {
  const { rows } = await db.listRows<ExpenseTypeExamples>(
    "app",
    "expense_type_examples",
    [Query.orderDesc("$createdAt"), Query.limit(RECENT_FETCH_LIMIT)]
  );
  const out: TypeExample[] = [];
  for (const row of rows) {
    if (out.length >= room) {
      break;
    }
    const example = toExample(row);
    if (
      example &&
      activeSlugs.has(example.finalType) &&
      !seen.has(example.finalType)
    ) {
      seen.add(example.finalType);
      out.push(example);
    }
  }
  return out;
}

export async function selectExamples(
  db: Db,
  input: { vendor: string | null; types: CostTypeOption[] }
): Promise<TypeExample[]> {
  try {
    const activeSlugs = new Set(input.types.map((t) => t.slug));
    const vendorKey = normalizeVendor(input.vendor);
    const matched = vendorKey
      ? await vendorExamples(db, vendorKey, activeSlugs)
      : [];
    const seen = new Set(matched.map((e) => e.finalType));
    const filler = await recentPerType(
      db,
      activeSlugs,
      seen,
      MAX_EXAMPLES - matched.length
    );
    return [...matched, ...filler];
  } catch {
    return [];
  }
}

export interface BookedExampleInput {
  accountNumber: number;
  aiConfidence: number | null;
  aiCostType: string | null;
  amount: number;
  description: string;
  finalCostType: string | null;
  finalText: string | null;
  source: "student" | "approver" | "admin";
  vendor: string | null;
}

/** Anonymous by design: no submitter, name or expense id is ever stored. */
export async function writeExamples(
  db: Db,
  rows: BookedExampleInput[]
): Promise<void> {
  for (const row of rows) {
    try {
      await db.createRow("app", "expense_type_examples", ID.unique(), {
        account_number: row.accountNumber,
        ai_confidence: row.aiConfidence,
        ai_cost_type: row.aiCostType,
        amount: row.amount,
        description: row.description.slice(0, DESCRIPTION_MAX),
        final_cost_type: row.finalCostType,
        final_text: row.finalText,
        source: row.source,
        vendor_key: normalizeVendor(row.vendor),
      });
    } catch (error) {
      console.error("Failed to write expense type example", error);
    }
  }
}

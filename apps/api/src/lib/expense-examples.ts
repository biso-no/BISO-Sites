import { Query } from "@repo/api";
import type { createAdminClient } from "@repo/api/server";
import type { ExpenseTypeExamples } from "@repo/api/types/appwrite";
import type { CostTypeOption } from "@repo/shared/utils/expense-cost-types";
import { normalizeVendor } from "@repo/shared/utils/expense-examples";
import type { TypeExample } from "./receipt-scan";

type Db = Awaited<ReturnType<typeof createAdminClient>>["db"];

const MAX_EXAMPLES = 10;
const MAX_VENDOR_EXAMPLES = 6;
const VENDOR_FETCH_LIMIT = 20;
const RECENT_FETCH_LIMIT = 100;

const MAX_KEYWORDS = 5;
const MIN_KEYWORD_LENGTH = 3;
const PREFIX_WORDS = 2;
const KEYWORD = /\p{L}{3,}/gu;
const WHITESPACE = /\s+/;

function toExample(
  row: ExpenseTypeExamples,
  departmentId?: string | null
): TypeExample | null {
  if (!row.final_cost_type) {
    return null;
  }
  return {
    confirmed: row.confirmed === true,
    description: row.description ?? "",
    finalType: row.final_cost_type,
    sameDepartment: Boolean(departmentId) && row.department_id === departmentId,
    source: row.source,
    vendorKey: row.vendor_key ?? "",
  };
}

interface Candidate {
  example: TypeExample;
  fromPerson: boolean;
  key: unknown;
}

/** Confirmed first, then a person's correction, then same department. */
function rank(c: Candidate): number {
  return (
    (c.example.confirmed ? 4 : 0) +
    (c.fromPerson ? 2 : 0) +
    (c.example.sameDepartment ? 1 : 0)
  );
}

function candidatesFrom(
  rows: ExpenseTypeExamples[],
  ctx: {
    activeSlugs: Set<string>;
    departmentId?: string | null;
    excludeId?: string;
  },
  taken: Set<unknown>
): Candidate[] {
  const out: Candidate[] = [];
  for (const row of rows) {
    const key = row.$id ?? row;
    if ((ctx.excludeId && row.$id === ctx.excludeId) || taken.has(key)) {
      continue;
    }
    const example = toExample(row, ctx.departmentId);
    if (example && ctx.activeSlugs.has(example.finalType)) {
      const origin = row.type_source ?? row.source;
      out.push({ example, fromPerson: origin !== "student", key });
    }
  }
  // Array.sort is stable, so newest-first order holds within each rank.
  return out.sort((a, b) => rank(b) - rank(a));
}

function keywordsOf(description: string | null | undefined): string[] {
  const words = (description ?? "").match(KEYWORD) ?? [];
  return [...new Set(words.map((w) => w.toLowerCase()))]
    .filter((w) => w.length >= MIN_KEYWORD_LENGTH)
    .slice(0, MAX_KEYWORDS);
}

async function fetchRows(
  db: Db,
  queries: string[]
): Promise<ExpenseTypeExamples[]> {
  const { rows } = await db.listRows<ExpenseTypeExamples>(
    "app",
    "expense_type_examples",
    [...queries, Query.orderDesc("$createdAt"), Query.limit(VENDOR_FETCH_LIMIT)]
  );
  return rows;
}

async function recentPerType(
  db: Db,
  activeSlugs: Set<string>,
  seen: Set<string>,
  room: number,
  excludeId?: string,
  departmentId?: string | null
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
    if (excludeId && row.$id === excludeId) {
      continue;
    }
    const example = toExample(row, departmentId);
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
  input: {
    /** The department the receipt is booked for, when known. */
    departmentId?: string | null;
    /** The receipt's description, for keyword matches. */
    description?: string | null;
    /** An example to leave out, so a re-run never sees the row it scores. */
    excludeId?: string;
    vendor: string | null;
    types: CostTypeOption[];
  }
): Promise<TypeExample[]> {
  const matched: TypeExample[] = [];
  const taken = new Set<unknown>();
  try {
    const ctx = {
      activeSlugs: new Set(input.types.map((t) => t.slug)),
      departmentId: input.departmentId,
      excludeId: input.excludeId,
    };
    const vendorKey = normalizeVendor(input.vendor);
    const prefix = vendorKey
      ? vendorKey.split(WHITESPACE).slice(0, PREFIX_WORDS).join(" ")
      : "";
    const keywords = keywordsOf(input.description);
    const groups: string[][] = [];
    if (vendorKey) {
      groups.push([Query.equal("vendor_key", vendorKey)]);
      if (prefix && prefix !== vendorKey) {
        groups.push([Query.startsWith("vendor_key", prefix)]);
      }
    }
    if (keywords.length > 0) {
      groups.push([Query.search("description", keywords.join(" "))]);
    }
    let vendorRoom = MAX_VENDOR_EXAMPLES;
    for (const group of groups) {
      const room = Math.min(vendorRoom, MAX_EXAMPLES - matched.length);
      if (room <= 0) {
        break;
      }
      let rows: ExpenseTypeExamples[];
      try {
        rows = await fetchRows(db, group);
      } catch (error) {
        console.warn("[expense-examples] A search failed, skipping it:", error);
        continue;
      }
      const picked = candidatesFrom(rows, ctx, taken).slice(0, room);
      for (const c of picked) {
        taken.add(c.key);
        matched.push(c.example);
      }
      vendorRoom -= picked.length;
    }
    const seen = new Set(matched.map((e) => e.finalType));
    let filler: TypeExample[] = [];
    try {
      filler = await recentPerType(
        db,
        ctx.activeSlugs,
        seen,
        MAX_EXAMPLES - matched.length,
        input.excludeId,
        input.departmentId
      );
    } catch (error) {
      console.warn("[expense-examples] The recent search failed:", error);
    }
    return [...matched, ...filler];
  } catch {
    return matched;
  }
}

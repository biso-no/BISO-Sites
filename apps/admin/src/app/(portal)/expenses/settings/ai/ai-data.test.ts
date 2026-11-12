import { beforeEach, describe, expect, mock, test } from "bun:test";

const db = { listRows: mock() };
const getUserAuthContext = mock();
mock.module("server-only", () => ({}));
mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db })),
}));
mock.module("@/lib/authorization", () => ({ getUserAuthContext }));

const { AI_EVAL_ROW_CAP, loadAiEvalData } = await import("./ai-data");

const LIMIT = /"method":"limit","values":\[(\d+)\]/;
const OFFSET = /"method":"offset","values":\[(\d+)\]/;

/** Serves `rows` a page at a time, as Appwrite's limit and offset would. */
function paged(rows: object[], queries: string[]): { rows: object[] } {
  const text = queries.join("\n");
  const limit = Number(LIMIT.exec(text)?.[1] ?? rows.length);
  const offset = Number(OFFSET.exec(text)?.[1] ?? 0);
  return { rows: rows.slice(offset, offset + limit) };
}

interface Tables {
  aiRows?: object[];
  drafts?: string[];
  ownTextRows?: object[];
}

function seed(tables: Tables) {
  db.listRows.mockImplementation(
    (_db: string, table: string, queries: string[]) => {
      const text = queries.join("\n");
      if (table === "expense_attachments") {
        return Promise.resolve(
          text.includes('"attribute":"ai_cost_type"')
            ? paged(tables.aiRows ?? [], queries)
            : paged(tables.ownTextRows ?? [], queries)
        );
      }
      if (table === "expense") {
        const drafts = tables.drafts ?? [];
        return Promise.resolve({
          rows: drafts
            .filter((id) => text.includes(`"${id}"`))
            .map(($id) => ({ $id })),
        });
      }
      return Promise.resolve({ rows: [] });
    }
  );
}

const NOW = new Date().toISOString();
const aiRow = (i: number, expenseId = `e${i}`) => ({
  $createdAt: NOW,
  ai_confidence: 0.9,
  ai_cost_type: "travel",
  cost_type: "travel",
  cost_type_text: null,
  expense_id: expenseId,
});
const ownText = (text: string, expenseId: string) => ({
  $createdAt: NOW,
  cost_type_text: text,
  expense_id: expenseId,
});

beforeEach(() => {
  db.listRows.mockReset();
  getUserAuthContext.mockReset();
  getUserAuthContext.mockResolvedValue({ roles: ["globaladmin"] });
});

describe("loadAiEvalData", () => {
  test("is capped only when more rows exist than the cap", async () => {
    seed({
      aiRows: Array.from({ length: AI_EVAL_ROW_CAP }, (_, i) => aiRow(i, "e")),
    });
    const exact = await loadAiEvalData();
    expect(exact.capped).toBe(false);
    expect(exact.rows).toHaveLength(AI_EVAL_ROW_CAP);

    seed({
      aiRows: Array.from({ length: AI_EVAL_ROW_CAP + 1 }, (_, i) =>
        aiRow(i, "e")
      ),
    });
    const over = await loadAiEvalData();
    expect(over.capped).toBe(true);
    expect(over.rows).toHaveLength(AI_EVAL_ROW_CAP);
  });

  test("reads draft status in chunks of 100 ids", async () => {
    seed({
      aiRows: Array.from({ length: 150 }, (_, i) => aiRow(i)),
      drafts: ["e5", "e120"],
    });

    const data = await loadAiEvalData();

    const expenseReads = db.listRows.mock.calls.filter(
      ([, table]) => table === "expense"
    );
    expect(expenseReads).toHaveLength(2);
    expect(data.rows).toHaveLength(148);
  });

  test("counts own texts from every non-draft receipt, not only AI picks", async () => {
    seed({
      drafts: ["draft-1"],
      ownTextRows: [
        ownText("Parking", "e1"),
        ownText("parking ", "e2"),
        ownText("Parking", "e3"),
        ownText("Parking", "draft-1"),
      ],
    });

    const data = await loadAiEvalData();

    expect(data.rows).toEqual([]);
    expect(data.ownTextRows).toEqual([
      { costTypeText: "Parking" },
      { costTypeText: "parking " },
      { costTypeText: "Parking" },
    ]);
  });
});

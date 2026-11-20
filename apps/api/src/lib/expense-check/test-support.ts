// Test helpers for the background check: a scripted mock model (no real
// model is ever called) and a small in-memory database. Only tests import
// this file.

import { MockLanguageModelV4 } from "ai/test";

/** One model turn: tool calls, plain text, or a call that waits for the abort. */
export type ScriptedStep =
  | { calls: { input: unknown; name: string }[] }
  | { text: string }
  | "hang";

export const STEP_USAGE = {
  inputTokens: { cacheRead: 40, cacheWrite: 0, noCache: 60, total: 100 },
  outputTokens: { reasoning: 5, text: 15, total: 20 },
};

/**
 * A model that answers each step from `script`, repeating the last entry
 * once the script runs out.
 */
export function scriptedModel(script: ScriptedStep[]): MockLanguageModelV4 {
  let turn = 0;
  return new MockLanguageModelV4({
    doGenerate: (options) => {
      const step = script[Math.min(turn, script.length - 1)] ?? "hang";
      turn += 1;
      if (step === "hang") {
        return new Promise((_resolve, reject) => {
          options.abortSignal?.addEventListener(
            "abort",
            () => reject(options.abortSignal?.reason),
            { once: true }
          );
        });
      }
      if ("text" in step) {
        return Promise.resolve({
          content: [{ text: step.text, type: "text" as const }],
          finishReason: { raw: undefined, unified: "stop" as const },
          usage: STEP_USAGE,
          warnings: [],
        });
      }
      return Promise.resolve({
        content: step.calls.map((call, index) => ({
          input: JSON.stringify(call.input),
          toolCallId: `call-${turn}-${index}`,
          toolName: call.name,
          type: "tool-call" as const,
        })),
        finishReason: { raw: undefined, unified: "tool-calls" as const },
        usage: STEP_USAGE,
        warnings: [],
      });
    },
  });
}

/** Everything the model was sent, over all steps, as one string. */
export function sentToModel(model: MockLanguageModelV4): string {
  return JSON.stringify(model.doGenerateCalls.map((call) => call.prompt));
}

type Row = Record<string, unknown> & { $id: string };

interface ParsedQuery {
  attribute?: string;
  method: string;
  values?: unknown[];
}

function parse(query: string): ParsedQuery | null {
  try {
    return JSON.parse(query) as ParsedQuery;
  } catch {
    return null;
  }
}

/** Applies the `equal` queries; the code under test filters the rest itself. */
function matches(row: Row, queries: string[]): boolean {
  return queries.every((query) => {
    const parsed = parse(query);
    if (parsed?.method !== "equal" || !parsed.attribute) {
      return true;
    }
    return (parsed.values ?? []).includes(row[parsed.attribute]);
  });
}

export interface Write {
  data: Record<string, unknown>;
  rowId: string;
  table: string;
}

/** An in-memory `db` with the calls the check makes, recording every write. */
export function memoryDb(tables: Record<string, Row[]>) {
  const writes: Write[] = [];
  const created: Write[] = [];
  const find = (table: string, rowId: string): Row => {
    const row = tables[table]?.find((r) => r.$id === rowId);
    if (!row) {
      throw Object.assign(new Error(`${table}/${rowId} not found`), {
        code: 404,
      });
    }
    return row;
  };
  const db = {
    createRow: (
      _database: string,
      table: string,
      rowId: string,
      data: Record<string, unknown>
    ) => {
      created.push({ data, rowId, table });
      return Promise.resolve({ $id: rowId, ...data });
    },
    getRow: (_database: string, table: string, rowId: string) =>
      Promise.resolve(structuredClone(find(table, rowId))),
    listRows: (_database: string, table: string, queries: string[] = []) => {
      const rows = (tables[table] ?? []).filter((row) => matches(row, queries));
      return Promise.resolve({
        rows: structuredClone(rows),
        total: rows.length,
      });
    },
    updateRow: (
      _database: string,
      table: string,
      rowId: string,
      data: Record<string, unknown>
    ) => {
      writes.push({ data, rowId, table });
      const row = tables[table]?.find((r) => r.$id === rowId);
      if (row) {
        Object.assign(row, data);
      }
      return Promise.resolve({ $id: rowId, ...data });
    },
  };
  return {
    created,
    db,
    /** The events written, in order. */
    events: () =>
      created
        .filter((write) => write.table === "expense_events")
        .map((write) => write.data),
    /** Every patch written to one receipt, merged. */
    patchOf: (rowId: string) =>
      Object.assign(
        {},
        ...writes
          .filter(
            (write) =>
              write.table === "expense_attachments" && write.rowId === rowId
          )
          .map((write) => write.data)
      ) as Record<string, unknown>,
    tables,
    writes,
  };
}

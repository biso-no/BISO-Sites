import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

interface Column {
  elements?: string[];
  key: string;
  required: boolean;
}

interface Index {
  columns: string[];
  key: string;
  type: string;
}

interface Table {
  $id: string;
  $permissions: string[];
  columns: Column[];
  databaseId: string;
  indexes: Index[];
  rowSecurity: boolean;
}

const config = JSON.parse(
  readFileSync(join(import.meta.dirname, "appwrite.config.json"), "utf8")
) as { tables: Table[] };

const table = (id: string): Table => {
  const found = config.tables.find((t) => t.$id === id);
  if (!found) {
    throw new Error(`Missing table ${id}`);
  }
  return found;
};

describe("event_rsvps schema", () => {
  test("event_rsvps is server-written with row security", () => {
    const t = table("event_rsvps");
    expect(t.rowSecurity).toBe(true);
    expect(t.$permissions).toEqual([]);
    expect(t.databaseId).toBe("app");
  });

  test("event_rsvps has the three answer columns", () => {
    const t = table("event_rsvps");
    expect(t.columns.map((c) => c.key)).toEqual([
      "event_id",
      "user_id",
      "status",
    ]);
    const status = t.columns.find((c) => c.key === "status");
    expect(status?.elements).toEqual(["going", "maybe", "not_going"]);
    expect(t.columns.every((c) => c.required)).toBe(true);
  });

  test("one answer per student per event", () => {
    const { indexes } = table("event_rsvps");
    const has = (type: string, columns: string[]) =>
      indexes.some(
        (i) =>
          i.type === type &&
          JSON.stringify(i.columns) === JSON.stringify(columns)
      );
    expect(has("unique", ["event_id", "user_id"])).toBe(true);
    expect(has("key", ["event_id", "status"])).toBe(true);
    expect(has("key", ["user_id"])).toBe(true);
  });
});

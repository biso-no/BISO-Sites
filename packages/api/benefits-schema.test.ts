import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

interface Column {
  default?: unknown;
  elements?: string[];
  format?: string;
  key: string;
  max?: number;
  min?: number;
  required: boolean;
  size?: number;
  type: string;
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

const column = (tableId: string, key: string): Column => {
  const found = table(tableId).columns.find((c) => c.key === key);
  if (!found) {
    throw new Error(`Missing column ${tableId}.${key}`);
  }
  return found;
};

const index = (tableId: string, key: string): Index => {
  const found = table(tableId).indexes.find((i) => i.key === key);
  if (!found) {
    throw new Error(`Missing index ${tableId}.${key}`);
  }
  return found;
};

describe("benefits studio schema", () => {
  test("campus_benefits gains a section enum defaulting to member", () => {
    expect(column("campus_benefits", "section")).toMatchObject({
      type: "string",
      format: "enum",
      elements: ["member", "career", "social", "safety", "business"],
      required: false,
      default: "member",
    });
  });

  test("one-line benefits can omit description, category and kind", () => {
    for (const key of [
      "description_nb",
      "description_en",
      "category",
      "kind",
    ]) {
      expect(column("campus_benefits", key).required).toBe(false);
    }
    expect(column("campus_benefits", "redemption_type")).toMatchObject({
      required: false,
      default: "none",
    });
  });

  test("campus_benefits has a campus/section/status index", () => {
    expect(index("campus_benefits", "idx_campus_section_status")).toMatchObject(
      { type: "key", columns: ["campus_id", "section", "status"] }
    );
  });

  test("campus_benefits rows are readable only through row permissions", () => {
    expect(table("campus_benefits").$permissions).toEqual([]);
  });

  test("benefit_codes is service-only", () => {
    const t = table("benefit_codes");
    expect(t.$permissions).toEqual([]);
    expect(t.rowSecurity).toBe(true);
    expect(column("benefit_codes", "benefit_id")).toMatchObject({
      type: "string",
      size: 36,
      required: true,
    });
    expect(column("benefit_codes", "value")).toMatchObject({
      type: "string",
      size: 500,
      required: true,
    });
    expect(column("benefit_codes", "updated_by")).toMatchObject({
      type: "string",
      size: 36,
      required: false,
    });
    expect(index("benefit_codes", "idx_benefit")).toMatchObject({
      type: "unique",
      columns: ["benefit_id"],
    });
  });

  test("membership_texts is public copy", () => {
    const t = table("membership_texts");
    expect(t.$permissions).toEqual(['read("any")']);
    expect(t.rowSecurity).toBe(false);
    expect(column("membership_texts", "spot")).toMatchObject({
      format: "enum",
      required: true,
      elements: [
        "home_join",
        "plan_card",
        "portal_locked",
        "onboarding",
        "shop_callout",
        "business",
        "business_hotspot",
      ],
    });
    expect(column("membership_texts", "sort_order")).toMatchObject({
      type: "integer",
      required: false,
      default: 0,
      min: 0,
      max: 9999,
    });
    expect(column("membership_texts", "title_nb")).toMatchObject({
      type: "string",
      size: 200,
      required: true,
    });
    expect(column("membership_texts", "title_en")).toMatchObject({
      type: "string",
      size: 200,
      required: false,
    });
    for (const key of ["body_nb", "body_en"]) {
      expect(column("membership_texts", key)).toMatchObject({
        type: "string",
        size: 500,
        required: false,
      });
    }
    expect(index("membership_texts", "idx_spot_order")).toMatchObject({
      type: "key",
      columns: ["spot", "sort_order"],
    });
  });

  test("partners have a level/campus/sort index", () => {
    expect(index("partners", "idx_level_campus_sort")).toMatchObject({
      type: "key",
      columns: ["level", "campus_id", "sort_order"],
      orders: ["ASC", "ASC", "ASC"],
    });
  });

  test("partners can be ordered", () => {
    expect(column("partners", "sort_order")).toMatchObject({
      type: "integer",
      required: false,
      default: 0,
      min: 0,
      max: 9999,
    });
  });
});

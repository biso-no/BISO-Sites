import { describe, expect, it } from "vitest";
import {
  resolveCustomFieldAnswers,
  toProductCustomFields,
} from "./product-custom-fields";

const engraving = {
  id: "engraving",
  label: "Engraving text",
  required: false,
  type: "text" as const,
};
const size = {
  id: "size",
  label: "Shirt size",
  required: true,
  type: "select" as const,
};

describe("toProductCustomFields", () => {
  it("keys a field by field_key, which is what answers are stored under", () => {
    const [field] = toProductCustomFields([
      { $id: "row-1", field_key: "engraving", label: "Engraving text" },
    ]);
    expect(field.id).toBe("engraving");
  });

  it("falls back to the row id when an imported field has no key", () => {
    const [field] = toProductCustomFields([
      { $id: "row-1", label: "Engraving text" },
    ]);
    expect(field.id).toBe("row-1");
  });

  it("drops disabled and unlabelled rows, and orders by sort_order", () => {
    const fields = toProductCustomFields([
      { $id: "b", field_key: "b", label: "Second", sort_order: 2 },
      { $id: "off", field_key: "off", label: "Off", enabled: false },
      { $id: "blank", field_key: "blank", label: null },
      { $id: "a", field_key: "a", label: "First", sort_order: 1 },
    ]);
    expect(fields.map((field) => field.id)).toEqual(["a", "b"]);
  });

  it("falls back to text for an unrecognised type", () => {
    const [field] = toProductCustomFields([
      { $id: "row-1", field_key: "k", label: "L", type: "signature" },
    ]);
    expect(field.type).toBe("text");
  });
});

describe("resolveCustomFieldAnswers", () => {
  it("accepts an answer to a question the product asks", () => {
    const result = resolveCustomFieldAnswers([engraving], {
      engraving: "  Ada  ",
    });
    expect(result.accepted).toEqual({ engraving: "Ada" });
    expect(result.details).toEqual([
      { id: "engraving", label: "Engraving text", value: "Ada" },
    ]);
    expect(result.missing).toEqual([]);
  });

  it("drops a field the product never declared", () => {
    const result = resolveCustomFieldAnswers([engraving], {
      engraving: "Ada",
      smuggled: "not a real field",
    });
    expect(result.accepted).toEqual({ engraving: "Ada" });
  });

  it("labels from the product, never from the caller", () => {
    // The caller supplies no labels at all here; they are not an input.
    const result = resolveCustomFieldAnswers([engraving], {
      engraving: "Ada",
    });
    expect(result.details[0].label).toBe("Engraving text");
  });

  it("reports a required question left blank", () => {
    expect(resolveCustomFieldAnswers([size], {}).missing).toEqual([
      "Shirt size",
    ]);
    expect(resolveCustomFieldAnswers([size], { size: "   " }).missing).toEqual([
      "Shirt size",
    ]);
  });

  it("does not report an optional question left blank", () => {
    const result = resolveCustomFieldAnswers([engraving], {});
    expect(result.missing).toEqual([]);
    expect(result.accepted).toEqual({});
  });

  it("handles a product that asks nothing", () => {
    expect(resolveCustomFieldAnswers([], { anything: "at all" })).toEqual({
      accepted: {},
      details: [],
      missing: [],
    });
  });
});

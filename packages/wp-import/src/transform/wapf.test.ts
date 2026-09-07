import { describe, expect, test } from "bun:test";
import {
  parseWapfAnswers,
  parseWapfFieldGroup,
  type WpMetaEntry,
} from "./wapf";

const meta = (key: string, value: unknown): WpMetaEntry => ({ key, value });

describe("parseWapfAnswers", () => {
  test("reads the id/label/value triple checkout already writes", () => {
    // Real payload, order 66888 line 15627 (Bokskap - Campus Trondheim).
    const answers = parseWapfAnswers([
      meta("membership", "BISO member"),
      meta("_wapf_meta", {
        fields: [
          {
            id: "66abb59b52d75",
            label: "Skapnummer",
            value: "058",
            values: [{ label: "058", price: 0, price_type: "none" }],
          },
        ],
        settings: { Skapnummer: [false] },
      }),
    ]);

    expect(answers).toEqual([
      { id: "66abb59b52d75", label: "Skapnummer", value: "058" },
    ]);
  });

  test("ignores variation attributes that sit alongside the answers", () => {
    // `membership` / `duration` are WooCommerce variation attributes, not WAPF
    // fields. They arrive as sibling visible meta and must not be mistaken for
    // custom field answers.
    const answers = parseWapfAnswers([
      meta("member-status", "BISO member"),
      meta("duration", "Semester"),
      meta("Locker number", "151"),
      meta("_reduced_stock", "1"),
    ]);

    expect(answers).toEqual([]);
  });

  test("strips the pricing-hint markup WAPF bakes into a priced answer", () => {
    // Real payload, order 26505: the value carries nested spans and numeric
    // entities. Stored raw it would render as markup in the admin CSV export.
    const answers = parseWapfAnswers([
      meta("_wapf_meta", {
        fields: [
          {
            id: "64f8766f2e090",
            label: "Vil du gi en 10er til SAIH?",
            value:
              'ja <span class="wapf-pricing-hint">(<span class="wapf-addon-price">+&#107;&#114;&nbsp;10</span>)</span>',
            values: [
              { label: "ja", price: 10, price_type: "fixed", slug: "3swjd" },
            ],
          },
        ],
      }),
    ]);

    expect(answers).toEqual([
      {
        id: "64f8766f2e090",
        label: "Vil du gi en 10er til SAIH?",
        value: "ja (+kr 10)",
      },
    ]);
  });

  test("decodes entities in a joined multi-select answer", () => {
    // Real payload, order 3474. WAPF pre-joins a multi-select into one string;
    // it is never an array, so the value passes through as text.
    const answers = parseWapfAnswers([
      meta("_wapf_meta", {
        fields: [
          {
            id: "61dd85005a1e4",
            label: "Valg",
            value: "Fotball &amp; Futsal, Volleyball",
            values: [
              { label: "Fotball &amp; Futsal", price: 0, price_type: "none" },
              { label: "Volleyball", price: 0, price_type: "none" },
            ],
          },
        ],
      }),
    ]);

    expect(answers[0]?.value).toBe("Fotball & Futsal, Volleyball");
  });

  test("returns an empty list when the line item has no meta at all", () => {
    expect(parseWapfAnswers(undefined)).toEqual([]);
    expect(parseWapfAnswers([])).toEqual([]);
  });

  test("survives a serialized-but-unparsed _wapf_meta string", () => {
    // Defensive: a snapshot taken through a proxy that did not unserialize.
    expect(parseWapfAnswers([meta("_wapf_meta", "a:1:{s:6:...}")])).toEqual([]);
  });

  test("drops a field with a blank label or value rather than storing noise", () => {
    const answers = parseWapfAnswers([
      meta("_wapf_meta", {
        fields: [
          { id: "a", label: "  ", value: "x" },
          { id: "b", label: "Keep", value: "  " },
          { id: "c", label: "Good", value: "yes" },
        ],
      }),
    ]);

    expect(answers).toEqual([{ id: "c", label: "Good", value: "yes" }]);
  });

  test("caps the answers at the value column size", () => {
    const long = "x".repeat(3000);
    const answers = parseWapfAnswers([
      meta("_wapf_meta", {
        fields: [
          { id: "a", label: "First", value: long },
          { id: "b", label: "Second", value: long },
        ],
      }),
    ]);

    // Both fields together exceed 4096, so the second is dropped whole — a
    // truncated JSON string would fail JSON.parse in order-parsing.ts and the
    // whole line's answers would vanish instead of just the overflow.
    expect(answers).toHaveLength(1);
    expect(JSON.stringify(answers).length).toBeLessThanOrEqual(4096);
  });
});

describe("parseWapfFieldGroup", () => {
  test("maps a required text field, the commonest case by far", () => {
    // Real definition, product 6833.
    const fields = parseWapfFieldGroup([
      meta("_wapf_fieldgroup", {
        id: "p_6833",
        fields: [
          {
            id: "66abb59b52d75",
            label: "Skapnummer",
            description: "Finn et tilgjengelig bokskap",
            type: "text",
            required: true,
            options: { group: "field" },
          },
        ],
      }),
    ]);

    expect(fields).toEqual([
      {
        fieldKey: "66abb59b52d75",
        helpText: "Finn et tilgjengelig bokskap",
        label: "Skapnummer",
        options: [],
        placeholder: null,
        required: true,
        sortOrder: 0,
        type: "text",
      },
    ]);
  });

  test("maps select choices to their labels and keeps email distinct", () => {
    const fields = parseWapfFieldGroup([
      meta("_wapf_fieldgroup", {
        fields: [
          {
            id: "63c5516ecbfea",
            label: "Menu",
            type: "select",
            required: true,
            options: {
              choices: [
                { slug: "zrqan", label: "Meat" },
                { slug: "kpyum", label: "Vegetarian" },
                { slug: "66y6q", label: "Vegan" },
              ],
            },
          },
          {
            id: "65646cdfebb3a",
            label: "E-post",
            type: "email",
            required: true,
            options: { choices: [], placeholder: "eksempel@mail.no" },
          },
        ],
      }),
    ]);

    expect(fields[0]?.type).toBe("select");
    expect(fields[0]?.options).toEqual(["Meat", "Vegetarian", "Vegan"]);
    expect(fields[1]?.type).toBe("email");
    expect(fields[1]?.placeholder).toBe("eksempel@mail.no");
    expect(fields[1]?.sortOrder).toBe(1);
  });

  test("folds checkboxes into select, the closest shape the studio renders", () => {
    // Real definition, product 6815 — the only checkboxes field in the archive.
    const fields = parseWapfFieldGroup([
      meta("_wapf_fieldgroup", {
        fields: [
          {
            id: "66b3a2b52454d",
            label: "Have you logged in the BI Student app?",
            type: "checkboxes",
            required: true,
            options: {
              choices: [
                { slug: "9a69q", label: "Yes" },
                { slug: "vhdqx", label: "No" },
              ],
            },
          },
        ],
      }),
    ]);

    expect(fields[0]?.type).toBe("select");
    expect(fields[0]?.options).toEqual(["Yes", "No"]);
  });

  test("dedupes the field group WPML returns twice", () => {
    // /wc/v3/products repeats `_wapf_fieldgroup` for WPML-duplicated products;
    // without dedupe every field would be imported twice.
    const group = {
      fields: [{ id: "a", label: "Name", type: "text", required: true }],
    };
    const fields = parseWapfFieldGroup([
      meta("_wapf_fieldgroup", group),
      meta("_wapf_fieldgroup", group),
    ]);

    expect(fields).toHaveLength(1);
  });

  test("drops an unlabelled field instead of importing a nameless input", () => {
    // Product 36249 carries four fields whose labels were left blank.
    const fields = parseWapfFieldGroup([
      meta("_wapf_fieldgroup", {
        fields: [
          { id: "a", label: "", type: "text", required: true },
          { id: "b", label: "Fine", type: "text", required: false },
        ],
      }),
    ]);

    expect(fields).toEqual([
      {
        fieldKey: "b",
        helpText: null,
        label: "Fine",
        options: [],
        placeholder: null,
        required: false,
        sortOrder: 0,
        type: "text",
      },
    ]);
  });

  test("returns an empty list for a product with no field group", () => {
    expect(parseWapfFieldGroup(undefined)).toEqual([]);
    expect(parseWapfFieldGroup([meta("_other", { fields: [] })])).toEqual([]);
  });

  test("trims the trailing spaces WordPress admins leave in labels", () => {
    const fields = parseWapfFieldGroup([
      meta("_wapf_fieldgroup", {
        fields: [{ id: "a", label: "Størrelse ", type: "text" }],
      }),
    ]);

    expect(fields[0]?.label).toBe("Størrelse");
  });
});

import { describe, expect, test } from "bun:test";
import {
  columnsForAi,
  detectColumns,
  withAiSuggestions,
} from "./import-columns";

const tickster = [
  ["Kjøperliste", "", "", "", ""],
  ["", "", "", "", ""],
  ["Navn", "Etternavn", "E-post", "Betalingsmåte", "Billettkategori"],
  [
    "Ola",
    "Nordmann",
    "ola@example.com",
    "Vipps",
    "1 x Bergen - BISO - 4-Person",
  ],
  ["", "", "", "", ""],
  ["Kari", "Hansen", "kari@example.com", "Kort", "1 x Oslo - BISO - 2-Person"],
];

describe("detectColumns", () => {
  test("finds the header, maps known names and samples the rows below", () => {
    const { columns, foundByAliases, unknown } = detectColumns(tickster);
    expect(columns.headerRow).toBe(2);
    expect(columns.mapping).toEqual([
      "first_name",
      "last_name",
      "email",
      "ignore",
      "ticket_category",
    ]);
    expect(columns.rowCount).toBe(2);
    expect(columns.sample.map((row) => row[0])).toEqual(["Ola", "Kari"]);
    expect(columns.detected).toEqual({
      campus: true,
      group: false,
      roomSizes: true,
    });
    expect(foundByAliases).toBe(true);
    expect(unknown).toEqual([3]);
  });

  test("an empty file has no header row", () => {
    expect(detectColumns([["", ""]]).columns).toMatchObject({
      headerRow: -1,
      rowCount: 0,
    });
  });
});

describe("columnsForAi", () => {
  test("sends only header names and value shapes of unknown columns", () => {
    const rows = tickster;
    expect(columnsForAi(rows, detectColumns(rows))).toEqual([
      {
        header: "Betalingsmåte",
        index: 3,
        shape: "one to three capitalized words",
      },
    ]);
  });

  test("sends nothing when the header row wasn't found by known names", () => {
    const rows = [
      ["Ola Nordmann", "ola@example.com", "91234567"],
      ["Kari Hansen", "kari@example.com", "92345678"],
    ];
    expect(columnsForAi(rows, detectColumns(rows))).toEqual([]);
  });

  test("never sends a header that looks like an email or a phone number", () => {
    const rows = [
      ["Navn", "Etternavn", "kari@example.com", "Mob 912 34 567", "Notat"],
      ["Ola", "Nordmann", "x", "y", "z"],
    ];
    expect(
      columnsForAi(rows, detectColumns(rows)).map((column) => column.header)
    ).toEqual(["Notat"]);
  });
});

describe("withAiSuggestions", () => {
  test("an AI 'ignore' leaves the column for the admin to pick", () => {
    const detected = detectColumns(tickster);
    expect(
      withAiSuggestions(tickster, detected, { 3: "ignore" }).mapping[3]
    ).toBe("ignore");
    expect(withAiSuggestions(tickster, detected, { 3: "group" })).toMatchObject(
      {
        detected: { group: true },
        mapping: [
          "first_name",
          "last_name",
          "email",
          "group",
          "ticket_category",
        ],
      }
    );
  });

  test("never overrides a column the known names recognised", () => {
    const detected = detectColumns(tickster);
    expect(
      withAiSuggestions(tickster, detected, { 2: "phone" }).mapping[2]
    ).toBe("email");
  });
});

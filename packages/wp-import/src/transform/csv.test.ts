import { describe, expect, test } from "bun:test";
import { parseCsv, toCsv } from "./csv";

describe("parseCsv", () => {
  test("parses a header row and data rows into objects", () => {
    const text = "wp_name,resolved_id\nKarrieredagene,803\n";

    expect(parseCsv(text)).toEqual([
      { resolved_id: "803", wp_name: "Karrieredagene" },
    ]);
  });

  test("respects quoted fields containing commas", () => {
    const text = 'wp_name,suggested_name\nNU,"BRG NU, Bergen"\n';

    expect(parseCsv(text)[0]?.suggested_name).toBe("BRG NU, Bergen");
  });

  test("unescapes doubled quotes inside quoted fields", () => {
    const text = 'a\n"He said ""hi"""\n';

    expect(parseCsv(text)[0]?.a).toBe('He said "hi"');
  });

  test("returns an empty array for an empty file", () => {
    expect(parseCsv("")).toEqual([]);
  });
});

describe("toCsv", () => {
  test("writes a header and quotes fields that need it", () => {
    const csv = toCsv([{ name: "BRG NU, Bergen", id: "313" }], ["id", "name"]);

    expect(csv).toBe('id,name\n313,"BRG NU, Bergen"\n');
  });

  test("round-trips through parseCsv", () => {
    const rows = [{ a: 'x"y', b: "z,w" }];

    expect(parseCsv(toCsv(rows, ["a", "b"]))).toEqual(rows);
  });
});

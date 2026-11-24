import { beforeAll, describe, expect, mock, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

mock.module("server-only", () => ({}));

type ParseImportFile = typeof import("./parse-file.server").parseImportFile;
let parseImportFile: ParseImportFile;

beforeAll(async () => {
  ({ parseImportFile } = await import("./parse-file.server"));
});

describe("parseImportFile", () => {
  test("parses semicolon CSV with quoted fields", async () => {
    expect(
      await parseImportFile({ kind: "csv", text: 'a;b\n1;"x;y"' })
    ).toEqual([
      ["a", "b"],
      ["1", "x;y"],
    ]);
  });

  test("parses comma CSV, escaped quotes and CRLF", async () => {
    expect(
      await parseImportFile({ kind: "csv", text: 'a,b\r\n"say ""hi""",2\r\n' })
    ).toEqual([
      ["a", "b"],
      ['say "hi"', "2"],
    ]);
  });

  test("splits pasted text on tabs", async () => {
    expect(
      await parseImportFile({ kind: "paste", text: "a\tb\n1\t2" })
    ).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  test("reads the Tickster purchasers workbook", async () => {
    const buf = readFileSync(
      join(import.meta.dir, "__fixtures__", "tickster-purchasers.xlsx")
    );
    const data = buf.buffer.slice(
      buf.byteOffset,
      buf.byteOffset + buf.byteLength
    ) as ArrayBuffer;
    const rows = await parseImportFile({ kind: "xlsx", data });
    expect(rows).toHaveLength(6);
    expect(rows[0]?.[0]).toBe("Kjøperliste");
    expect(rows[2]?.slice(0, 4)).toEqual([
      "Navn",
      "Etternavn",
      "E-post",
      "Mobilnr",
    ]);
    expect(rows[3]?.[3]).toBe("91234567");
  });
});

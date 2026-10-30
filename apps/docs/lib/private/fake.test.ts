import { describe, expect, it } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFakeSource } from "./fake";
import { PrivateSourceUnavailable } from "./types";

describe("createFakeSource", () => {
  it("reads values from its file", async () => {
    const file = join(mkdtempSync(join(tmpdir(), "fake-")), "v.json");
    writeFileSync(file, JSON.stringify({ A: "1" }));
    expect(await createFakeSource(file).get(["A", "B"])).toEqual({
      A: "1",
      B: undefined,
    });
  });

  it("is unavailable when the file is missing", async () => {
    await expect(
      createFakeSource("/nonexistent/x.json").get(["A"])
    ).rejects.toBeInstanceOf(PrivateSourceUnavailable);
    await expect(createFakeSource().get(["A"])).rejects.toBeInstanceOf(
      PrivateSourceUnavailable
    );
  });
});

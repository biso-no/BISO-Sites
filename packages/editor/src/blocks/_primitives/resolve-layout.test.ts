import { describe, expect, test } from "bun:test";
import type { BlockLayout } from "./layout-types";
import { resolveBackgrounds } from "./resolve-layout";

const block = (layout?: BlockLayout) => ({ layout });

describe("resolveBackgrounds", () => {
  test("alternates default and muted for untouched blocks", () => {
    expect(resolveBackgrounds([block(), block(), block(), block()])).toEqual([
      "default",
      "muted",
      "default",
      "muted",
    ]);
  });

  test("starts on default so the first untouched block is never tinted", () => {
    expect(resolveBackgrounds([block()])).toEqual(["default"]);
  });

  test("honours explicit backgrounds", () => {
    expect(
      resolveBackgrounds([
        block({ background: "inverted" }),
        block({ background: "brand" }),
      ])
    ).toEqual(["inverted", "brand"]);
  });

  test("prevents an automatic background from repeating an explicit one", () => {
    expect(
      resolveBackgrounds([block({ background: "muted" }), block(), block()])
    ).toEqual(["muted", "default", "muted"]);
  });

  test("treats explicit auto exactly like an absent layout", () => {
    expect(
      resolveBackgrounds([block({ background: "auto" }), block()])
    ).toEqual(["default", "muted"]);
  });

  test("allows consecutive explicit backgrounds", () => {
    expect(
      resolveBackgrounds([
        block({ background: "brand" }),
        block({ background: "brand" }),
      ])
    ).toEqual(["brand", "brand"]);
  });

  test("returns an empty array for an empty page", () => {
    expect(resolveBackgrounds([])).toEqual([]);
  });
});

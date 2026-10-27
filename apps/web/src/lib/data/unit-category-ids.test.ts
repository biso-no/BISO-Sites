import { UNIT_CATEGORY_IDS } from "@repo/editor/page-feeds";
import { UNIT_CATEGORIES } from "@repo/shared/utils/unit-categories";
import { expect, test } from "vitest";

test("the editor's unit category list equals the shared one", () => {
  expect([...UNIT_CATEGORY_IDS]).toEqual([...UNIT_CATEGORIES]);
});

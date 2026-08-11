import { expect, test } from "bun:test";
import { getNewsAllowedDepartmentIds } from "./news-studio-access";

test("fails closed when a department user resolves no departments", () => {
  expect(getNewsAllowedDepartmentIds(true, [])).toEqual([]);
  expect(getNewsAllowedDepartmentIds(false, [])).toBeUndefined();
});

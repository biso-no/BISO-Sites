import { expect, test } from "vitest";
import { requireDepartment } from "./feed";

test("requireDepartment passes an id and drops junk before any cache key", () => {
  const dept = (qs: string) => requireDepartment(new URLSearchParams(qs));
  expect(dept("dept=6501abc")).toBe("6501abc");
  expect(dept("dept=")).toBeNull();
  expect(dept("dept=a%20b")).toBeNull();
  expect(dept(`dept=${"x".repeat(40)}`)).toBeNull();
});

import { expect, test } from "bun:test";
import { parseExpiryDate, parseStartDate } from "./membership-sync";

test("fall starts 1 July, spring 1 January", () => {
  expect(parseStartDate("BISO Membership fall 2026")).toBe("2026-07-01");
  expect(parseStartDate("BISO Membership spring 2027")).toBe("2027-01-01");
});

test("multi-term plans run from the first season's start to the last season's end", () => {
  const name = "BISO Membership fall 2025 - spring 2028";
  expect(parseStartDate(name)).toBe("2025-07-01");
  expect(parseExpiryDate(name)).toBe("2028-06-30");
  const oneYear = "BISO Membership spring 2026 - fall 2026";
  expect(parseStartDate(oneYear)).toBe("2026-01-01");
  expect(parseExpiryDate(oneYear)).toBe("2026-12-31");
});

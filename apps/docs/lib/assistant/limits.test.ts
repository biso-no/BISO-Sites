import { afterEach, expect, test } from "bun:test";
import { checkLimits } from "./limits";

const DAY = Date.UTC(2026, 9, 28, 12, 0, 0);
const original = process.env.DOCS_ASSISTANT_DAILY_LIMIT;

afterEach(() => {
  if (original === undefined) {
    process.env.DOCS_ASSISTANT_DAILY_LIMIT = undefined;
    Reflect.deleteProperty(process.env, "DOCS_ASSISTANT_DAILY_LIMIT");
  } else {
    process.env.DOCS_ASSISTANT_DAILY_LIMIT = original;
  }
});

test("the 9th question from one visitor in 10 minutes is refused", () => {
  for (let i = 0; i < 8; i++) {
    expect(checkLimits("v-a", DAY + i * 1000)).toBe("ok");
  }
  expect(checkLimits("v-a", DAY + 9000)).toBe("visitor");
  expect(checkLimits("v-b", DAY + 9000)).toBe("ok");
});

test("the visitor window reopens after 10 minutes", () => {
  const t = DAY + 86_400_000 * 10;
  for (let i = 0; i < 8; i++) {
    checkLimits("v-c", t);
  }
  expect(checkLimits("v-c", t + 1000)).toBe("visitor");
  expect(checkLimits("v-c", t + 10 * 60_000 + 1)).toBe("ok");
});

test("the daily limit trips and resets the next UTC day", () => {
  process.env.DOCS_ASSISTANT_DAILY_LIMIT = "3";
  const t = DAY + 86_400_000 * 20;
  expect(checkLimits("d-1", t)).toBe("ok");
  expect(checkLimits("d-2", t)).toBe("ok");
  expect(checkLimits("d-3", t)).toBe("ok");
  expect(checkLimits("d-4", t)).toBe("daily");
  expect(checkLimits("d-4", t + 86_400_000)).toBe("ok");
});

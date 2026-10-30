import { afterEach, expect, test } from "bun:test";
import { checkLimits, trackedVisitors } from "./limits";

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
  const t = DAY - 86_400_000 * 10;
  for (let i = 0; i < 8; i++) {
    checkLimits("v-c", t);
  }
  expect(checkLimits("v-c", t + 1000)).toBe("visitor");
  expect(checkLimits("v-c", t + 10 * 60_000 + 1)).toBe("ok");
});

test("the daily limit trips and resets the next UTC day", () => {
  process.env.DOCS_ASSISTANT_DAILY_LIMIT = "3";
  const t = DAY - 86_400_000 * 20;
  expect(checkLimits("d-1", t)).toBe("ok");
  expect(checkLimits("d-2", t)).toBe("ok");
  expect(checkLimits("d-3", t)).toBe("ok");
  expect(checkLimits("d-4", t)).toBe("daily");
  expect(checkLimits("d-4", t + 86_400_000)).toBe("ok");
});

test("with no setting the daily limit is 50", () => {
  const t = DAY - 86_400_000 * 60;
  for (let i = 0; i < 50; i++) {
    expect(checkLimits(`n-${i}`, t)).toBe("ok");
  }
  expect(checkLimits("n-50", t)).toBe("daily");
});

test("an empty, blank or non-numeric daily limit means the default", () => {
  for (const [offset, value] of ["", "   ", "lots"].entries()) {
    process.env.DOCS_ASSISTANT_DAILY_LIMIT = value;
    const t = DAY - 86_400_000 * (70 + offset);
    for (let i = 0; i < 50; i++) {
      expect(checkLimits(`b-${offset}-${i}`, t)).toBe("ok");
    }
    expect(checkLimits(`b-${offset}-50`, t)).toBe("daily");
  }
});

test("old visitor keys are pruned once the map is large", () => {
  process.env.DOCS_ASSISTANT_DAILY_LIMIT = "1000000";
  const t = DAY - 86_400_000 * 30;
  for (let i = 0; i < 1500; i++) {
    checkLimits(`p-${i}`, t);
  }
  const before = trackedVisitors();
  expect(before).toBeGreaterThanOrEqual(1500);
  const later = t + 11 * 60_000;
  checkLimits("p-new", later);
  expect(trackedVisitors()).toBeLessThan(10);
});

test("past the hard cap new keys are refused and nothing grows", () => {
  process.env.DOCS_ASSISTANT_DAILY_LIMIT = "1000000";
  const t = DAY - 86_400_000 * 40;
  let refused = 0;
  for (let i = 0; i < 10_500; i++) {
    if (checkLimits(`h-${i}`, t + (i % 500)) === "visitor") {
      refused += 1;
    }
  }
  expect(refused).toBeGreaterThan(0);
  expect(trackedVisitors()).toBeLessThanOrEqual(10_000);
  expect(checkLimits("h-0", t + 600)).toBe("ok");
});

test("a daily refusal stores no visitor key", () => {
  process.env.DOCS_ASSISTANT_DAILY_LIMIT = "0";
  const t = DAY - 86_400_000 * 50;
  const before = trackedVisitors();
  expect(checkLimits("never-stored", t)).toBe("daily");
  expect(trackedVisitors()).toBe(before);
});

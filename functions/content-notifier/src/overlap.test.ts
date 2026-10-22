import { expect, test } from "bun:test";
import {
  type ExecutionSummary,
  isAnotherDispatchRunning,
  STALE_EXECUTION_MS,
} from "./overlap";

const NOW = new Date("2026-10-21T10:00:00.000Z");

function execution(overrides: Partial<ExecutionSummary>): ExecutionSummary {
  return {
    $createdAt: new Date(NOW.getTime() - 10_000).toISOString(),
    $id: "other",
    status: "processing",
    trigger: "schedule",
    ...overrides,
  };
}

test("no executions means nothing else is running", () => {
  expect(isAnotherDispatchRunning([], "me", NOW)).toBe(false);
});

test("only the current execution is not another run", () => {
  expect(isAnotherDispatchRunning([execution({ $id: "me" })], "me", NOW)).toBe(
    false
  );
});

test("another running schedule or http execution blocks", () => {
  expect(isAnotherDispatchRunning([execution({})], "me", NOW)).toBe(true);
  expect(
    isAnotherDispatchRunning([execution({ trigger: "http" })], "me", NOW)
  ).toBe(true);
  expect(
    isAnotherDispatchRunning([execution({ status: "waiting" })], "me", NOW)
  ).toBe(true);
});

test("event executions never block dispatch", () => {
  expect(
    isAnotherDispatchRunning([execution({ trigger: "event" })], "me", NOW)
  ).toBe(false);
});

test("finished executions never block", () => {
  for (const status of ["completed", "failed", "scheduled"]) {
    expect(isAnotherDispatchRunning([execution({ status })], "me", NOW)).toBe(
      false
    );
  }
});

test("executions older than the stale window never block", () => {
  const old = new Date(NOW.getTime() - STALE_EXECUTION_MS - 1).toISOString();
  expect(
    isAnotherDispatchRunning([execution({ $createdAt: old })], "me", NOW)
  ).toBe(false);
});

test("without a known own id, more than one running dispatch means busy", () => {
  expect(
    isAnotherDispatchRunning([execution({ $id: "a" })], undefined, NOW)
  ).toBe(false);
  expect(
    isAnotherDispatchRunning(
      [execution({ $id: "a" }), execution({ $id: "b" })],
      undefined,
      NOW
    )
  ).toBe(true);
});

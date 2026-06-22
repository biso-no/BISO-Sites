import { describe, expect, test } from "bun:test";
import type { M365UserListItem } from "@repo/shared/types/user-management";
import { findInactiveAccounts, isInactive } from "./inactivity";

const NOW = Date.parse("2026-06-10T00:00:00Z");
const MONTHS = 6;

function u(over: Partial<M365UserListItem>): M365UserListItem {
  return {
    accountEnabled: true,
    createdDateTime: null,
    department: null,
    displayName: "x",
    id: "x",
    jobTitle: null,
    lastSignInDateTime: null,
    mail: null,
    officeLocation: null,
    userPrincipalName: "x@biso.no",
    ...over,
  };
}

describe("isInactive", () => {
  test("flags a last sign-in older than the threshold", () => {
    expect(
      isInactive(u({ lastSignInDateTime: "2025-09-01T00:00:00Z" }), NOW, MONTHS)
    ).toBe(true);
  });

  test("does not flag a recent sign-in", () => {
    expect(
      isInactive(u({ lastSignInDateTime: "2026-05-01T00:00:00Z" }), NOW, MONTHS)
    ).toBe(false);
  });

  test("never signed in + old account => inactive", () => {
    expect(
      isInactive(
        u({
          lastSignInDateTime: null,
          createdDateTime: "2024-01-01T00:00:00Z",
        }),
        NOW,
        MONTHS
      )
    ).toBe(true);
  });

  test("never signed in + new account => not flagged", () => {
    expect(
      isInactive(
        u({
          lastSignInDateTime: null,
          createdDateTime: "2026-05-20T00:00:00Z",
        }),
        NOW,
        MONTHS
      )
    ).toBe(false);
  });

  test("no sign-in and no creation date => not flagged", () => {
    expect(isInactive(u({}), NOW, MONTHS)).toBe(false);
  });

  test("recent NON-interactive sign-in keeps an account active despite stale interactive", () => {
    expect(
      isInactive(
        u({
          lastSignInDateTime: "2025-01-01T00:00:00Z", // stale interactive
          lastNonInteractiveSignInDateTime: "2026-05-20T00:00:00Z", // recent client
        }),
        NOW,
        MONTHS
      )
    ).toBe(false);
  });

  test("recent last-successful sign-in keeps an account active", () => {
    expect(
      isInactive(
        u({
          lastSignInDateTime: null,
          lastSuccessfulSignInDateTime: "2026-06-01T00:00:00Z",
        }),
        NOW,
        MONTHS
      )
    ).toBe(false);
  });

  test("already-disabled account is never flagged, even if stale", () => {
    expect(
      isInactive(
        u({
          accountEnabled: false,
          lastSignInDateTime: "2024-01-01T00:00:00Z",
        }),
        NOW,
        MONTHS
      )
    ).toBe(false);
  });
});

describe("findInactiveAccounts", () => {
  test("returns only inactive accounts, sorted oldest activity first", () => {
    const users = [
      u({ id: "recent", lastSignInDateTime: "2026-05-01T00:00:00Z" }),
      u({ id: "old", lastSignInDateTime: "2025-01-01T00:00:00Z" }),
      u({ id: "older", lastSignInDateTime: "2024-06-01T00:00:00Z" }),
    ];
    const result = findInactiveAccounts(users, NOW, MONTHS);
    expect(result.map((r) => r.id)).toEqual(["older", "old"]);
  });
});

import { describe, expect, test } from "bun:test";
import { Query } from "@repo/api";
import type { UserAuthContext } from "@/lib/authorization";
import { buildAssistantOrderSearchQueries } from "./assistant-order-search";

function makeCtx(overrides: Partial<UserAuthContext> = {}): UserAuthContext {
  return {
    campusNames: [],
    campusTeamIds: [],
    departmentNames: [],
    departmentTeamIds: [],
    email: null,
    managedCampuses: [],
    managedCampusIds: [],
    name: null,
    resolvedCampusIds: [],
    resolvedDepartmentIds: [],
    roles: [],
    userId: "u1",
    ...overrides,
  };
}

describe("buildAssistantOrderSearchQueries", () => {
  test("pushes buyer and order id search into Appwrite before the result limit", () => {
    expect(
      buildAssistantOrderSearchQueries(makeCtx({ roles: ["globaladmin"] }), {
        limit: 10,
        query: " order_123 ",
        status: "paid",
      })
    ).toEqual([
      Query.orderDesc("$createdAt"),
      Query.equal("status", "paid"),
      Query.or([
        Query.contains("buyer_name", "order_123"),
        Query.contains("buyer_email", "order_123"),
        Query.equal("$id", "order_123"),
      ]),
      Query.limit(10),
    ]);
  });

  test("preserves campus scoping for campus admins", () => {
    expect(
      buildAssistantOrderSearchQueries(
        makeCtx({ managedCampusIds: ["1"], roles: ["campusadmin"] }),
        { limit: 5, status: "all" }
      )
    ).toEqual([
      Query.orderDesc("$createdAt"),
      Query.equal("campus_id", ["1"]),
      Query.limit(5),
    ]);
  });
});

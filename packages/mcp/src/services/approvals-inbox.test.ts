/**
 * Whose approvals the inbox shows.
 *
 * `createApprovalRequest` in `apps/admin` writes three read grants on every
 * row: the approver team, the Operations Unit, and
 * `Permission.read(Role.user(requester))` — but `update` only for the first
 * two. Row security alone therefore shows a requester their own pending rows,
 * which `biso_list_pending_approvals` would present as awaiting their decision.
 */

import { describe, expect, test } from "bun:test";
import { OPERATIONS_UNIT_TEAM_ID } from "../identity/campus";
import {
  CAMPUS_ADMIN,
  createFakeBackend,
  DEPARTMENT_MEMBER,
  GLOBAL_ADMIN,
  makePrincipal,
} from "../testing/index";
import { createApprovalService } from "./approvals";
import { createOperationsService } from "./operations";

function tables() {
  return {
    approval_requests: [
      {
        $id: "mine",
        $createdAt: "2026-01-02T00:00:00.000Z",
        status: "pending",
        action: "news.publish",
        resource_type: "news",
        resource_id: "n-1",
        campus_id: "1",
        department_id: "dept-a",
        // Filed BY this department member, decided by campus management.
        approver_team_id: "sg-app-dept-ledelsenoslo",
        requester_id: "dept-user",
        requester_email: "dept@biso.no",
        payload: "{}",
      },
      {
        $id: "theirs",
        $createdAt: "2026-01-01T00:00:00.000Z",
        status: "pending",
        action: "news.publish",
        resource_type: "news",
        resource_id: "n-2",
        campus_id: "1",
        department_id: "dept-b",
        approver_team_id: "sg-app-dept-hr",
        requester_id: "someone-else",
        requester_email: "other@biso.no",
        payload: "{}",
      },
    ],
  };
}

function service() {
  return createApprovalService(createFakeBackend({ tables: tables() }));
}

function counts() {
  return createOperationsService(
    createFakeBackend({ tables: { ...tables(), form_submissions: [] } }),
    {}
  );
}

const PAGE = { limit: 20, offset: 0 };

describe("the pending inbox lists only what the caller can decide", () => {
  test("a requester does not see their own request as theirs to decide", async () => {
    const found = await service().listPending(
      DEPARTMENT_MEMBER("dept-a", "1"),
      PAGE
    );

    expect(found.rows).toHaveLength(0);
  });

  test("the named approver team sees it", async () => {
    // A campus admin holds `sg-app-dept-ledelsenoslo`.
    const approver = CAMPUS_ADMIN("Oslo", "1");
    const found = await service().listPending(approver, PAGE);

    expect(found.rows.map((row) => row.id)).toEqual(["mine"]);
  });

  test("the Operations Unit override still sees everything", async () => {
    const found = await service().listPending(GLOBAL_ADMIN(), PAGE);

    expect(found.rows.map((row) => row.id).sort()).toEqual(["mine", "theirs"]);
  });
});

/**
 * The count beside the inbox has to agree with the inbox.
 *
 * `listPending` filters on the decider's grant; this count did not, and read
 * row visibility alone. `approval_requests` has no table-level permissions, so
 * visibility *is* row security — and row security grants the requester read on
 * their own rows. The fake returns every row that matches the query, which is
 * the right model for that: what production would show the requester is
 * exactly what an unfiltered query returns here.
 */
describe("the inbox count agrees with the inbox", () => {
  test("a campus admin's own request, routed elsewhere, is not counted", async () => {
    // `mine` is decided by campus management (this caller's team); `theirs`
    // is routed to HR. A campus admin can read both, and can decide one.
    const found = await counts().inboxCounts(CAMPUS_ADMIN("Oslo", "1"));

    expect(found.approvals).toBe(1);
  });

  test("the Operations Unit override still counts everything", async () => {
    const found = await counts().inboxCounts(GLOBAL_ADMIN());

    expect(found.approvals).toBe(2);
  });

  test("an Operations Unit member who is not an admin still gets a count", async () => {
    // `deriveRoles` grants `globaladmin` only for National **and** Operations
    // Unit, so an Operations Unit member without the National campus team is
    // neither a global nor a campus admin. `approverTeamsFor` treats them as
    // the all-requests override and `listPending` shows them every row — while
    // the count returned 0 early, so the inbox and its badge disagreed about
    // the same rows.
    const opsOnly = makePrincipal({
      userId: "ops-1",
      roles: [],
      departmentNames: ["Operations Unit"],
      departmentTeamIds: [OPERATIONS_UNIT_TEAM_ID],
      resolvedDepartmentIds: ["dept-ops"],
      profile: "staff",
    });

    expect(await counts().inboxCounts(opsOnly)).toMatchObject({
      approvals: 2,
    });
    expect((await service().listPending(opsOnly, PAGE)).rows).toHaveLength(2);
  });

  test("someone with no approver team and no admin role still gets zero", async () => {
    // The negative control: widening who is counted must not count everyone.
    const nobody = makePrincipal({
      userId: "nobody-1",
      roles: [],
      profile: "staff",
    });

    expect((await counts().inboxCounts(nobody)).approvals).toBe(0);
  });
});

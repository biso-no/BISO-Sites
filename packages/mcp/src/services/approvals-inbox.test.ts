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
import {
  CAMPUS_ADMIN,
  createFakeBackend,
  DEPARTMENT_MEMBER,
  GLOBAL_ADMIN,
} from "../testing/index";
import { createApprovalService } from "./approvals";

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

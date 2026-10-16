import { afterAll, afterEach, beforeAll, expect, mock, test } from "bun:test";
import { act, createElement } from "react";
import type { Root } from "react-dom/client";
import { installReactDom, type TestElement } from "@/test/react-dom-harness";
import type { ApprovalRequest } from "../../../_actions/approvals";

// Server actions and the toast library are external to what this test asserts;
// it never triggers a decision, only a re-render with a new server page.
mock.module("../../../_actions/approvals", () => ({
  approveRequest: mock(async () => ({ success: true })),
  rejectRequest: mock(async () => ({ success: true })),
}));
mock.module("sonner", () => ({
  toast: { error: () => undefined, success: () => undefined },
}));

const { ApprovalsReviewClient } = await import("./approvals-review-client");

const installedDom = installReactDom();
let createRoot: typeof import("react-dom/client")["createRoot"];
let root: Root | null = null;
let container: TestElement;

beforeAll(async () => {
  ({ createRoot } = await import("react-dom/client"));
});

afterEach(async () => {
  if (root) {
    await act(async () => root?.unmount());
  }
  root = null;
  installedDom.document.body.textContent = "";
});

afterAll(() => installedDom.restore());

const labels = {
  action: "Action",
  approve: "Approve",
  approveError: "Approve failed",
  approveSuccess: "Approved",
  reason: "Reason",
  reasonPlaceholder: "Why?",
  reject: "Reject",
  rejectError: "Reject failed",
  rejectSuccess: "Rejected",
  requester: "Requester",
  resourceType: "Type",
};

function makeRequest(id: string, email: string): ApprovalRequest {
  return {
    $createdAt: "2026-01-01T00:00:00.000Z",
    $databaseId: "app",
    $id: id,
    $permissions: [],
    $sequence: "1",
    $tableId: "approval_requests",
    $updatedAt: "2026-01-01T00:00:00.000Z",
    action: "publish",
    approver_team_id: "team-1",
    campus_id: null,
    decided_at: null,
    decided_by: null,
    department_id: null,
    payload: "{}",
    reason: null,
    requester_email: email,
    requester_id: "user-1",
    resource_id: null,
    resource_type: "page",
    status: "pending",
  };
}

async function mount(element: ReturnType<typeof createElement>) {
  container = installedDom.document.createElement("div");
  installedDom.document.body.appendChild(container);
  root = createRoot(container as unknown as Element);
  await act(() => {
    root?.render(element);
  });
}

// The list is server paginated now, so page 2 arrives as a new `requests` prop
// on the same mounted component — React keeps it across a same-route query
// change. Copying the prop into state once left page 2 showing page 1's rows,
// with the later approvals unreachable short of a hard reload.
test("renders the server's rows when a new page arrives as a prop", async () => {
  const pageOne = [makeRequest("a1", "first@biso.no")];
  const pageTwo = [makeRequest("b1", "second@biso.no")];

  await mount(
    createElement(ApprovalsReviewClient, { labels, requests: pageOne })
  );
  expect(container.textContent).toContain("first@biso.no");

  await act(() => {
    root?.render(
      createElement(ApprovalsReviewClient, { labels, requests: pageTwo })
    );
  });

  expect(container.textContent).toContain("second@biso.no");
  expect(container.textContent).not.toContain("first@biso.no");
});

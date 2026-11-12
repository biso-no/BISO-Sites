import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

import {
  ApprovalBody,
  type ApprovalContext,
  afterDecisionRefused,
} from "./approval-client";

const CONTEXT: ApprovalContext = {
  adminUrl: "https://admin.biso.no/expenses/expense-1",
  campusLabel: "Oslo",
  currency: "NOK",
  departmentLabel: "Marketing",
  description: "Travel",
  expired: false,
  missingAccount: false,
  receipts: [],
  reimbursementNumber: "10042",
  status: "pending",
  stepLabel: "Campus financial controller",
  total: 200,
};

const render = (context: ApprovalContext): string =>
  renderToStaticMarkup(
    <ApprovalBody
      context={context}
      decide={() => undefined}
      error={null}
      loading={false}
      noteId="note"
      outcome={null}
      reason=""
      setReason={() => undefined}
      submitting={false}
      token="raw-token"
    />
  );

const BUTTON = /<button/g;

describe("ApprovalBody", () => {
  it("offers Approve and Reject when every receipt has an account", () => {
    const html = render(CONTEXT);
    expect(html.match(BUTTON)).toHaveLength(2);
    expect(html).toContain(">approve<");
    expect(html).not.toContain("accountMissing");
  });

  it("replaces Approve with a note and an admin link when a receipt has no account", () => {
    const html = render({ ...CONTEXT, missingAccount: true });
    expect(html.match(BUTTON)).toHaveLength(1);
    expect(html).not.toContain(">approve<");
    expect(html).toContain(">reject<");
    expect(html).toContain("accountMissing");
    expect(html).toContain('href="https://admin.biso.no/expenses/expense-1"');
  });
});

describe("afterDecisionRefused", () => {
  it("switches the page into the missing-account state on account_missing", () => {
    const refused = afterDecisionRefused(CONTEXT, "account_missing");
    expect(refused.accountMissing).toBe(true);
    expect(refused.context?.missingAccount).toBe(true);
    const html = render(refused.context as ApprovalContext);
    expect(html.match(BUTTON)).toHaveLength(1);
    expect(html).not.toContain(">approve<");
    expect(html).toContain("accountMissing");
    expect(html).toContain('href="https://admin.biso.no/expenses/expense-1"');
  });

  it("leaves the context alone for any other refusal", () => {
    expect(afterDecisionRefused(CONTEXT, "link_expired")).toEqual({
      accountMissing: false,
      context: CONTEXT,
    });
  });
});

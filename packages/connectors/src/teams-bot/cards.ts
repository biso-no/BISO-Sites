/**
 * Adaptive Card + email builders for expense approval requests.
 *
 * The Teams card uses the Universal Action Model (`Action.Execute`) so Approve /
 * Reject are handled by the bot messaging endpoint. The Outlook email carries the
 * same actions as token-gated links to the web approval page (so shared mailboxes
 * that can't receive a Teams DM are still actionable).
 */

export interface ApprovalCardData {
  /** `expense_approvals` row id. */
  approvalId: string;
  campusName: string;
  currency: string;
  departmentName: string;
  description: string;
  reimbursementNumber: string;
  /** e.g. "Step 1 of 2 — Department financial manager". */
  stepLabel: string;
  submitterName: string;
  /** Raw (unhashed) approval token, used by the bot + web links. */
  token: string;
  total: number;
  /** Token-gated web page to view receipts (and approve/reject via email). */
  viewUrl: string;
}

function formatAmount(total: number, currency: string): string {
  return `${total.toLocaleString("nb-NO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

function factSet(data: ApprovalCardData) {
  return [
    { title: "Submitter", value: data.submitterName },
    {
      title: "Department",
      value: `${data.departmentName} — ${data.campusName}`,
    },
    { title: "Amount", value: formatAmount(data.total, data.currency) },
    { title: "Reference", value: data.reimbursementNumber },
  ];
}

/** Universal-Action Adaptive Card with Approve / Reject (Action.Execute). */
export function buildApprovalCard(
  data: ApprovalCardData
): Record<string, unknown> {
  return {
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    type: "AdaptiveCard",
    version: "1.4",
    body: [
      {
        type: "TextBlock",
        text: "Reimbursement approval",
        weight: "Bolder",
        size: "Medium",
      },
      {
        type: "TextBlock",
        text: data.stepLabel,
        isSubtle: true,
        spacing: "None",
      },
      { type: "FactSet", facts: factSet(data) },
      {
        type: "TextBlock",
        text: data.description,
        wrap: true,
        spacing: "Medium",
      },
    ],
    actions: [
      {
        type: "Action.Execute",
        title: "Approve",
        verb: "approve",
        data: { approvalId: data.approvalId, token: data.token },
        style: "positive",
      },
      {
        type: "Action.Execute",
        title: "Reject",
        verb: "reject",
        data: { approvalId: data.approvalId, token: data.token },
        style: "destructive",
      },
      { type: "Action.OpenUrl", title: "View receipts", url: data.viewUrl },
    ],
  };
}

/** Card shown after a decision (replaces the actionable card). */
export function buildDecisionResultCard(params: {
  decision: "approved" | "rejected";
  decidedBy: string;
  reimbursementNumber: string;
}): Record<string, unknown> {
  const verb = params.decision === "approved" ? "Approved" : "Rejected";
  return {
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    type: "AdaptiveCard",
    version: "1.4",
    body: [
      {
        type: "TextBlock",
        text: `Reimbursement ${params.reimbursementNumber} ${verb.toLowerCase()}`,
        weight: "Bolder",
        wrap: true,
      },
      {
        type: "TextBlock",
        text: `${verb} by ${params.decidedBy}.`,
        isSubtle: true,
        wrap: true,
        spacing: "None",
      },
    ],
  };
}

/** Plain HTML email body with Approve / Reject / View links to the web page. */
export function buildApprovalEmailHtml(
  data: ApprovalCardData & { approveUrl: string; rejectUrl: string }
): string {
  const button = (url: string, label: string, color: string) =>
    `<a href="${url}" style="display:inline-block;padding:10px 18px;margin-right:8px;border-radius:6px;background:${color};color:#fff;text-decoration:none;font-weight:600">${label}</a>`;

  return `
    <div style="font-family:Arial,sans-serif;max-width:560px">
      <h2 style="margin:0 0 4px">Reimbursement approval</h2>
      <p style="color:#555;margin:0 0 16px">${data.stepLabel}</p>
      <table style="border-collapse:collapse;margin-bottom:16px">
        <tr><td style="padding:2px 12px 2px 0;color:#555">Submitter</td><td>${data.submitterName}</td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#555">Department</td><td>${data.departmentName} — ${data.campusName}</td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#555">Amount</td><td>${formatAmount(data.total, data.currency)}</td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#555">Reference</td><td>${data.reimbursementNumber}</td></tr>
      </table>
      <p style="margin:0 0 16px">${data.description}</p>
      <p style="margin:0 0 16px">
        ${button(data.approveUrl, "Approve", "#0a7d33")}
        ${button(data.rejectUrl, "Reject", "#b3261e")}
        ${button(data.viewUrl, "View receipts", "#0b5fff")}
      </p>
      <p style="color:#888;font-size:12px">If the buttons don't work, open: ${data.viewUrl}</p>
    </div>`;
}

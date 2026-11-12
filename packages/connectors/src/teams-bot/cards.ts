/**
 * Adaptive Card + email builders for expense approval requests.
 *
 * The Teams card uses the Universal Action Model (`Action.Execute`) so Approve /
 * Reject are handled by the bot messaging endpoint. The Outlook email carries the
 * same actions as token-gated links to the web approval page (so shared mailboxes
 * that can't receive a Teams DM are still actionable).
 */

export interface ApprovalCardReceipt {
  /** Account label such as "7140 Reise", or null when none is set. */
  account: string | null;
  amount: number;
  date: string;
  /** Vendor or description. */
  text: string;
  type: string;
}

export interface ApprovalCardHistoryLine {
  at: string;
  text: string;
}

/** Teams rejects cards above roughly 28 KB; stay well below. */
export const CARD_MAX_BYTES = 24_000;

const MAX_RECEIPT_ROWS = 15;
const MAX_HISTORY_LINES = 6;

export interface ApprovalCardData {
  /** Admin page for this expense (set the account, review in full). */
  adminUrl: string;
  /** `expense_approvals` row id. */
  approvalId: string;
  campusName: string;
  currency: string;
  /** e.g. "Submitter says they are the campus controller". */
  declaration: string | null;
  departmentName: string;
  description: string;
  /** e.g. "The campus president could not be found; the national approver decides instead". */
  fallbackNote: string | null;
  /** Already human-readable warning lines. */
  hints: string[];
  /** Newest first, already human-readable. */
  history: ApprovalCardHistoryLine[];
  /** True when a receipt has no account; Approve is replaced by an admin link. */
  missingAccount: boolean;
  receipts: ApprovalCardReceipt[];
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

/** Escape text before interpolating it into the HTML email body. */
function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatAmount(total: number, currency: string): string {
  return `${total.toLocaleString("nb-NO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

const MAX_RECEIPT_TEXT = 120;
const MAX_RECEIPT_LABEL = 60;
const MAX_LINE = 300;
const MAX_FACT_VALUE = 200;
const MAX_STEP_LABEL = 120;
const MAX_EMAIL_RECEIPTS = 30;

const encoder = new TextEncoder();

function byteLength(card: unknown): number {
  return encoder.encode(JSON.stringify(card)).length;
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function factSet(data: ApprovalCardData) {
  return [
    { title: "Submitter", value: truncate(data.submitterName, MAX_FACT_VALUE) },
    {
      title: "Department",
      value: truncate(
        `${data.departmentName} — ${data.campusName}`,
        MAX_FACT_VALUE
      ),
    },
    { title: "Amount", value: formatAmount(data.total, data.currency) },
    {
      title: "Reference",
      value: truncate(data.reimbursementNumber, MAX_FACT_VALUE),
    },
  ];
}

interface CardLimits {
  description: number;
  hints: number;
  history: number;
  receipts: number;
}

const FULL_LIMITS: CardLimits = {
  description: Number.POSITIVE_INFINITY,
  history: MAX_HISTORY_LINES,
  hints: Number.POSITIVE_INFINITY,
  receipts: MAX_RECEIPT_ROWS,
};

/** Shrink steps tried in order until the card fits `CARD_MAX_BYTES`. */
const SHRINK_STEPS: Partial<CardLimits>[] = [
  { history: 3 },
  { history: 0 },
  { receipts: 5 },
  { description: 500 },
  { hints: 5 },
];

const RECEIPT_COLUMNS = [
  { key: "date", width: "70px" },
  { key: "text", width: "stretch" },
  { key: "type", width: "70px" },
  { key: "account", width: "80px" },
  { key: "amount", width: "75px" },
] as const;

function cell(text: string, options: Record<string, unknown> = {}) {
  return { type: "TextBlock", text, wrap: true, size: "Small", ...options };
}

function cellOptions(header: boolean, key: string): Record<string, unknown> {
  if (header) {
    return { weight: "Bolder", isSubtle: true };
  }
  return key === "amount" ? { horizontalAlignment: "Right" } : {};
}

function receiptRow(values: string[], header: boolean) {
  return {
    type: "ColumnSet",
    spacing: header ? "Medium" : "Small",
    columns: RECEIPT_COLUMNS.map((column, index) => ({
      type: "Column",
      width: column.width,
      items: [cell(values[index] ?? "", cellOptions(header, column.key))],
    })),
  };
}

function cardBody(data: ApprovalCardData, limits: CardLimits) {
  const body: Record<string, unknown>[] = [
    {
      type: "TextBlock",
      text: "Reimbursement approval",
      weight: "Bolder",
      size: "Medium",
    },
    {
      type: "TextBlock",
      text: truncate(data.stepLabel, MAX_STEP_LABEL),
      isSubtle: true,
      spacing: "None",
      wrap: true,
    },
    { type: "FactSet", facts: factSet(data) },
  ];

  for (const note of [data.declaration, data.fallbackNote]) {
    if (note) {
      body.push({
        type: "TextBlock",
        text: truncate(note, MAX_LINE),
        color: "attention",
        wrap: true,
        spacing: "Small",
      });
    }
  }

  for (const hint of data.hints.slice(0, limits.hints)) {
    body.push({
      type: "TextBlock",
      text: truncate(hint, MAX_LINE),
      color: "warning",
      wrap: true,
      spacing: "Small",
    });
  }

  if (data.receipts.length > 0) {
    body.push(receiptRow(["Date", "Text", "Type", "Account", "Amount"], true));
    for (const receipt of data.receipts.slice(0, limits.receipts)) {
      body.push(
        receiptRow(
          [
            truncate(receipt.date, MAX_RECEIPT_LABEL),
            truncate(receipt.text, MAX_RECEIPT_TEXT),
            truncate(receipt.type, MAX_RECEIPT_LABEL),
            truncate(receipt.account ?? "—", MAX_RECEIPT_LABEL),
            formatAmount(receipt.amount, data.currency),
          ],
          false
        )
      );
    }
    const hidden = data.receipts.length - limits.receipts;
    if (hidden > 0) {
      body.push(
        cell(`and ${hidden} more`, { isSubtle: true, spacing: "Small" })
      );
    }
  }

  body.push({
    type: "TextBlock",
    text: truncate(data.description, limits.description),
    wrap: true,
    spacing: "Medium",
  });

  const history = data.history.slice(0, limits.history);
  if (history.length > 0) {
    body.push(
      {
        type: "TextBlock",
        text: "Recent history",
        weight: "Bolder",
        spacing: "Medium",
      },
      ...history.map((line) =>
        cell(truncate(`${line.at} — ${line.text}`, MAX_LINE), {
          isSubtle: true,
          spacing: "None",
        })
      )
    );
  }
  return body;
}

function cardActions(data: ApprovalCardData) {
  const decisionData = { approvalId: data.approvalId, token: data.token };
  const approve = data.missingAccount
    ? {
        type: "Action.OpenUrl",
        title: "Set the account in admin",
        url: data.adminUrl,
      }
    : {
        type: "Action.Execute",
        title: "Approve",
        verb: "approve",
        data: decisionData,
        style: "positive",
      };
  return [
    approve,
    {
      type: "Action.Execute",
      title: "Reject",
      verb: "reject",
      data: decisionData,
      style: "destructive",
    },
    { type: "Action.OpenUrl", title: "Open in admin", url: data.adminUrl },
    { type: "Action.OpenUrl", title: "View receipts", url: data.viewUrl },
  ];
}

/** Last resort when even the shrunk card is too large. */
function minimalBody(data: ApprovalCardData) {
  const count = data.receipts.length;
  return [
    {
      type: "TextBlock",
      text: "Reimbursement approval",
      weight: "Bolder",
      size: "Medium",
    },
    {
      type: "TextBlock",
      text: truncate(data.stepLabel, MAX_STEP_LABEL),
      isSubtle: true,
      spacing: "None",
      wrap: true,
    },
    { type: "FactSet", facts: factSet(data) },
    {
      type: "TextBlock",
      text: `${count} receipts — open in admin for details`,
      wrap: true,
      spacing: "Medium",
    },
  ];
}

/**
 * Universal-Action Adaptive Card with Approve / Reject (Action.Execute).
 * Shrinks its body (never its actions) to stay under `CARD_MAX_BYTES`.
 */
export function buildApprovalCard(
  data: ApprovalCardData,
  maxBytes: number = CARD_MAX_BYTES
): Record<string, unknown> {
  const actions = cardActions(data);
  const make = (limits: CardLimits) => ({
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    type: "AdaptiveCard",
    version: "1.4",
    body: cardBody(data, limits),
    actions,
  });

  let limits = FULL_LIMITS;
  let card = make(limits);
  for (const step of SHRINK_STEPS) {
    if (byteLength(card) <= maxBytes) {
      break;
    }
    limits = { ...limits, ...step };
    card = make(limits);
  }
  if (byteLength(card) <= maxBytes) {
    return card;
  }
  return {
    ...card,
    body: minimalBody(data),
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
    `<a href="${escapeHtml(url)}" style="display:inline-block;padding:10px 18px;margin:0 8px 8px 0;border-radius:6px;background:${color};color:#fff;text-decoration:none;font-weight:600">${escapeHtml(label)}</a>`;
  const note = (text: string | null, color: string) =>
    text
      ? `<p style="margin:0 0 8px;color:${color}">${escapeHtml(text)}</p>`
      : "";

  const cellStyle = "padding:4px 8px;border-bottom:1px solid #eee";
  const receiptRows = data.receipts
    .slice(0, MAX_EMAIL_RECEIPTS)
    .map(
      (r) =>
        `<tr><td style="${cellStyle}">${escapeHtml(r.date)}</td><td style="${cellStyle}">${escapeHtml(r.text)}</td><td style="${cellStyle}">${escapeHtml(r.type)}</td><td style="${cellStyle}">${escapeHtml(r.account ?? "—")}</td><td style="${cellStyle};text-align:right">${escapeHtml(formatAmount(r.amount, data.currency))}</td></tr>`
    )
    .join("");
  const hiddenReceipts = data.receipts.length - MAX_EMAIL_RECEIPTS;
  const moreReceipts =
    hiddenReceipts > 0
      ? `<p style="margin:0 0 16px;font-size:13px">and ${hiddenReceipts} more — <a href="${escapeHtml(data.adminUrl)}">see all in admin</a></p>`
      : "";
  const receiptsTable =
    data.receipts.length > 0
      ? `<table style="border-collapse:collapse;margin-bottom:16px;width:100%;font-size:13px">
        <tr style="color:#555;text-align:left"><th style="${cellStyle}">Date</th><th style="${cellStyle}">Text</th><th style="${cellStyle}">Type</th><th style="${cellStyle}">Account</th><th style="${cellStyle};text-align:right">Amount</th></tr>
        ${receiptRows}
      </table>${moreReceipts}`
      : "";

  const history = data.history.slice(0, MAX_HISTORY_LINES);
  const historyBlock =
    history.length > 0
      ? `<h3 style="margin:0 0 4px;font-size:14px">Recent history</h3>
      <ul style="margin:0 0 16px;padding-left:18px;color:#555;font-size:13px">${history
        .map(
          (line) => `<li>${escapeHtml(line.at)} — ${escapeHtml(line.text)}</li>`
        )
        .join("")}</ul>`
      : "";

  const approveButton = data.missingAccount
    ? button(data.adminUrl, "Set the account in admin", "#0b5fff")
    : button(data.approveUrl, "Approve", "#0a7d33");

  return `
    <div style="font-family:Arial,sans-serif;max-width:640px">
      <h2 style="margin:0 0 4px">Reimbursement approval</h2>
      <p style="color:#555;margin:0 0 16px">${escapeHtml(data.stepLabel)}</p>
      <table style="border-collapse:collapse;margin-bottom:16px">
        <tr><td style="padding:2px 12px 2px 0;color:#555">Submitter</td><td>${escapeHtml(data.submitterName)}</td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#555">Department</td><td>${escapeHtml(data.departmentName)} — ${escapeHtml(data.campusName)}</td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#555">Amount</td><td>${escapeHtml(formatAmount(data.total, data.currency))}</td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#555">Reference</td><td>${escapeHtml(data.reimbursementNumber)}</td></tr>
      </table>
      ${note(data.declaration, "#b3261e")}
      ${note(data.fallbackNote, "#b3261e")}
      ${data.hints.map((hint) => note(hint, "#b26a00")).join("")}
      ${receiptsTable}
      <p style="margin:0 0 16px">${escapeHtml(data.description)}</p>
      ${historyBlock}
      <p style="margin:0 0 16px">
        ${approveButton}
        ${button(data.rejectUrl, "Reject", "#b3261e")}
        ${button(data.adminUrl, "Open in admin", "#555")}
        ${button(data.viewUrl, "View receipts", "#0b5fff")}
      </p>
      <p style="color:#888;font-size:12px">If the buttons don't work, open: ${escapeHtml(data.viewUrl)}</p>
    </div>`;
}

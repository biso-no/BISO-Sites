import { describe, expect, test } from "bun:test";
import {
  type ApprovalCardData,
  type ApprovalCardReceipt,
  buildApprovalCard,
  buildApprovalEmailHtml,
  CARD_MAX_BYTES,
} from "./cards";

function receipt(index: number, text = `Vendor ${index}`): ApprovalCardReceipt {
  return {
    date: "2026-11-01",
    text,
    type: "Travel",
    account: "7140 Reise",
    amount: 100 + index,
  };
}

function baseData(overrides: Partial<ApprovalCardData> = {}): ApprovalCardData {
  return {
    approvalId: "appr1",
    token: "tok",
    campusName: "Oslo",
    currency: "NOK",
    departmentName: "Marketing",
    description: "Trip to the conference",
    reimbursementNumber: "R-1",
    stepLabel: "Step 1 of 2 — Controller",
    submitterName: "Ada",
    total: 500,
    viewUrl: "https://web.example/fs/approve/tok",
    adminUrl: "https://admin.example/expenses/e1",
    receipts: [receipt(1)],
    hints: [],
    history: [],
    declaration: null,
    fallbackNote: null,
    missingAccount: false,
    ...overrides,
  };
}

const VENDOR_TEXT = /^Vendor \d+$/;

type Item = Record<string, unknown>;

function texts(card: Record<string, unknown>): string[] {
  const out: string[] = [];
  const walk = (node: unknown) => {
    if (Array.isArray(node)) {
      for (const n of node) {
        walk(n);
      }
    } else if (node && typeof node === "object") {
      const item = node as Item;
      if (typeof item.text === "string") {
        out.push(item.text);
      }
      for (const value of Object.values(item)) {
        walk(value);
      }
    }
  };
  walk(card.body);
  return out;
}

function bytes(card: unknown): number {
  return new TextEncoder().encode(JSON.stringify(card)).length;
}

const ACTION_TITLES = ["Approve", "Reject", "Open in admin", "View receipts"];

function actions(card: Record<string, unknown>): Item[] {
  return card.actions as Item[];
}

describe("buildApprovalCard", () => {
  test("renders the receipts table with type and account", () => {
    const card = buildApprovalCard(baseData());
    const all = texts(card);
    expect(all).toContain("Vendor 1");
    expect(all).toContain("Travel");
    expect(all).toContain("7140 Reise");
    expect(all).toContain("2026-11-01");
    expect(all.some((t) => t.includes("101,00"))).toBe(true);
  });

  test('adds "and N more" after 15 receipts', () => {
    const receipts = Array.from({ length: 18 }, (_, i) => receipt(i));
    const all = texts(buildApprovalCard(baseData({ receipts })));
    expect(all).toContain("Vendor 14");
    expect(all).not.toContain("Vendor 15");
    expect(all).toContain("and 3 more");
  });

  test("replaces Approve when a receipt has no account", () => {
    const card = buildApprovalCard(baseData({ missingAccount: true }));
    const list = actions(card);
    expect(list.some((a) => a.verb === "approve")).toBe(false);
    const open = list.find((a) => a.title === "Set the account in admin");
    expect(open?.type).toBe("Action.OpenUrl");
    expect(open?.url).toBe("https://admin.example/expenses/e1");
    expect(list.some((a) => a.verb === "reject")).toBe(true);
  });

  test("keeps Approve with its data when the account is set", () => {
    const list = actions(buildApprovalCard(baseData()));
    const approve = list.find((a) => a.verb === "approve");
    expect(approve?.data).toEqual({ approvalId: "appr1", token: "tok" });
    expect(list.some((a) => a.title === "Open in admin")).toBe(true);
    expect(list.some((a) => a.title === "View receipts")).toBe(true);
  });

  test("shows declaration, fallback and hints", () => {
    const card = buildApprovalCard(
      baseData({
        declaration: "Submitter says they are the campus controller",
        fallbackNote: "The campus president could not be found",
        hints: ["Amount is unusually high"],
      })
    );
    const all = texts(card);
    expect(all).toContain("Submitter says they are the campus controller");
    expect(all).toContain("The campus president could not be found");
    expect(all).toContain("Amount is unusually high");
    const json = JSON.stringify(card);
    expect(json).toContain('"color":"attention"');
    expect(json).toContain('"color":"warning"');
  });

  test("history shows at most 6 lines", () => {
    const history = Array.from({ length: 10 }, (_, i) => ({
      at: `2026-11-0${(i % 9) + 1}`,
      text: `event ${i}`,
    }));
    const all = texts(buildApprovalCard(baseData({ history })));
    expect(all.filter((t) => t.includes("event ")).length).toBe(6);
    expect(all.some((t) => t.includes("event 5"))).toBe(true);
    expect(all.some((t) => t.includes("event 6"))).toBe(false);
  });

  const hugeCardData = () =>
    baseData({
      receipts: Array.from({ length: 40 }, (_, i) =>
        receipt(i, "x".repeat(300))
      ),
      history: Array.from({ length: 30 }, (_, i) => ({
        at: "2026-11-01",
        text: `history ${i} ${"h".repeat(200)}`,
      })),
      description: "d".repeat(3000),
      hints: Array.from(
        { length: 12 },
        (_, i) => `hint ${i} ${"y".repeat(400)}`
      ),
    });

  test("keeps a 40-receipt card under the size limit with its actions", () => {
    const card = buildApprovalCard(hugeCardData());
    expect(bytes(card)).toBeLessThanOrEqual(CARD_MAX_BYTES);
    const all = texts(card);
    expect(all).toContain("and 25 more");
    expect(
      all.filter((t) => t.includes("history ")).length
    ).toBeLessThanOrEqual(6);
    expect(actions(card).map((a) => a.title)).toEqual(ACTION_TITLES);
  });

  test("shrinks history, then receipt rows, when the limit is tight", () => {
    const card = buildApprovalCard(hugeCardData(), 9000);
    expect(bytes(card)).toBeLessThanOrEqual(9000);
    const all = texts(card);
    expect(all.some((t) => t.includes("history "))).toBe(false);
    expect(all).toContain("and 35 more");
    expect(all.filter((t) => t.startsWith("x")).length).toBeLessThanOrEqual(5);
    expect(actions(card).map((a) => a.title)).toEqual(ACTION_TITLES);
  });

  test("keeps a large card that fits whole, with 6 history lines and 15 rows", () => {
    const receipts = Array.from({ length: 15 }, (_, i) => receipt(i));
    const history = Array.from({ length: 6 }, (_, i) => ({
      at: "2026-11-01",
      text: `history ${i}`,
    }));
    const card = buildApprovalCard(baseData({ receipts, history }));
    const all = texts(card);
    expect(all.filter((t) => t.startsWith("history ")).length).toBe(0);
    expect(all.filter((t) => t.includes("history ")).length).toBe(6);
    expect(all.filter((t) => VENDOR_TEXT.test(t)).length).toBe(15);
  });

  test("caps one huge receipt, hint and declaration", () => {
    const huge = "z".repeat(30_000);
    const card = buildApprovalCard(
      baseData({
        receipts: [receipt(1, huge)],
        hints: [huge],
        declaration: huge,
      })
    );
    expect(bytes(card)).toBeLessThanOrEqual(CARD_MAX_BYTES);
    expect(texts(card).every((t) => t.length <= 300)).toBe(true);
    expect(texts(card).some((t) => t.endsWith("…"))).toBe(true);
    expect(actions(card).map((a) => a.title)).toEqual(ACTION_TITLES);
  });

  test("measures bytes, not characters, for æøå text", () => {
    const receipts = Array.from({ length: 15 }, (_, i) =>
      receipt(i, "æøåÆØÅ".repeat(20))
    );
    const history = Array.from({ length: 6 }, () => ({
      at: "i dag",
      text: "æøå".repeat(100),
    }));
    const card = buildApprovalCard(
      baseData({
        receipts,
        history,
        description: "æøå".repeat(1000),
        hints: Array.from({ length: 5 }, () => "æøå".repeat(100)),
      }),
      9000
    );
    expect(bytes(card)).toBeLessThanOrEqual(9000);
    expect(actions(card).map((a) => a.title)).toEqual(ACTION_TITLES);
  });

  test("returns the minimal card with all actions when nothing else fits", () => {
    const receipts = Array.from({ length: 40 }, (_, i) => receipt(i));
    const card = buildApprovalCard(baseData({ receipts }), 500);
    const all = texts(card);
    expect(all).toContain("40 receipts — open in admin for details");
    expect(all).not.toContain("Vendor 0");
    expect(actions(card).map((a) => a.title)).toEqual(ACTION_TITLES);
    expect(JSON.stringify(card)).toContain("FactSet");
  });
});

describe("buildApprovalEmailHtml", () => {
  const links = {
    approveUrl: "https://web.example/a?intent=approve",
    rejectUrl: "https://web.example/a?intent=reject",
  };

  test("replaces Approve when a receipt has no account", () => {
    const html = buildApprovalEmailHtml({
      ...baseData({ missingAccount: true }),
      ...links,
    });
    expect(html).not.toContain(links.approveUrl);
    expect(html).toContain("Set the account in admin");
    expect(html).toContain("https://admin.example/expenses/e1");
    expect(html).toContain(links.rejectUrl);
  });

  test("links Approve and Open in admin when the account is set", () => {
    const html = buildApprovalEmailHtml({ ...baseData(), ...links });
    expect(html).toContain(links.approveUrl);
    expect(html).toContain("Open in admin");
  });

  test("lists at most 30 receipts and links the rest to admin", () => {
    const receipts = Array.from({ length: 35 }, (_, i) => receipt(i));
    const html = buildApprovalEmailHtml({
      ...baseData({ receipts }),
      ...links,
    });
    expect(html).toContain("Vendor 29");
    expect(html).not.toContain("Vendor 30<");
    expect(html).toContain("and 5 more");
    expect(html).toContain(
      'href="https://admin.example/expenses/e1">see all in admin'
    );
  });

  test("escapes every interpolated value in the email", () => {
    const evil = `<script>alert("x")</script>`;
    const html = buildApprovalEmailHtml({
      ...baseData({
        stepLabel: evil,
        submitterName: evil,
        departmentName: evil,
        campusName: evil,
        description: evil,
        reimbursementNumber: evil,
        declaration: evil,
        fallbackNote: evil,
        hints: [evil],
        history: [{ at: evil, text: evil }],
        receipts: [
          { date: evil, text: evil, type: evil, account: evil, amount: 1 },
        ],
        adminUrl: `https://a.example/?q="><b>`,
        viewUrl: `https://v.example/?q="><b>`,
      }),
      approveUrl: `https://x.example/?q="><b>`,
      rejectUrl: `https://y.example/?q="><b>`,
    });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain('"><b>');
    expect(html).toContain("&lt;script&gt;");
  });
});

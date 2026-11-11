import { beforeEach, describe, expect, it, vi } from "vitest";

const account = vi.hoisted(() => ({ get: vi.fn() }));
const flags = vi.hoisted(() => ({
  expenses_module: false,
  expenses_ocr: false,
}));
const mocks = vi.hoisted(() => ({
  classifyReceipt: vi.fn(),
  convertAmountToNok: vi.fn(),
  createRow: vi.fn(),
  extractReceipt: vi.fn(),
  findPossibleDuplicate: vi.fn(),
  loadActiveCostTypes: vi.fn(),
  selectExamples: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  createAuthenticatedClient: vi.fn(async () => ({ account })),
}));

vi.mock("@repo/shared/utils/feature-flags-server", () => ({
  getFeatureFlagStates: vi.fn(async () => flags),
}));

vi.mock("@repo/api/server", () => ({
  createAdminClient: vi.fn(async () => ({
    db: { createRow: mocks.createRow },
  })),
}));
vi.mock("@/lib/expense-types", () => ({
  loadActiveCostTypes: mocks.loadActiveCostTypes,
}));
vi.mock("@/lib/expense-examples", () => ({
  selectExamples: mocks.selectExamples,
}));
vi.mock("@/lib/expense-duplicates", () => ({
  findPossibleDuplicate: mocks.findPossibleDuplicate,
}));
vi.mock("@/lib/receipt-scan", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/receipt-scan")>()),
  classifyReceipt: mocks.classifyReceipt,
  convertAmountToNok: mocks.convertAmountToNok,
  extractReceipt: mocks.extractReceipt,
}));

vi.mock("@repo/ai/models", () => ({
  MODEL_IDS: { balanced: "balanced-id", fast: "fast-id" },
}));
vi.mock("ai", () => ({ generateObject: vi.fn() }));

import { POST } from "./route";

const ORIGIN = "http://localhost:3000";

function request() {
  return new Request("https://api.example/api/expenses/ocr", {
    headers: { origin: ORIGIN },
    method: "POST",
  }) as never;
}

describe("expenses/ocr auth", () => {
  beforeEach(() => {
    account.get.mockReset();
  });

  it("answers a CORS-enabled JSON 401 when the session is rejected", async () => {
    account.get.mockRejectedValue(
      Object.assign(new Error("missing scope"), { code: 401 })
    );

    const response = await POST(request());

    expect(response.status).toBe(401);
    expect(response.headers.get("Access-Control-Allow-Methods")).toBeTruthy();
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("answers 500 when the auth check fails for a non-auth reason", async () => {
    account.get.mockRejectedValue(new TypeError("fetch failed"));

    const response = await POST(request());

    expect(response.status).toBe(500);
  });

  it("proceeds past auth for a valid session", async () => {
    account.get.mockResolvedValue({ $id: "user-1" });

    const response = await POST(request());

    // Flags are off in this test, so the next gate answers 403.
    expect(response.status).toBe(403);
  });
});

const receipt = {
  address: null,
  amount: 120,
  category: "meal",
  city: "Oslo",
  country: "Norway",
  currency: "NOK",
  date: "2026-11-01",
  description: "Pizza",
  documentType: "receipt",
  purchaseContext: "Dinner",
  receiptIssues: ["missing_date"],
  vendor: "Dominos",
};

function uploadRequest() {
  const form = new FormData();
  form.append("file", new File(["bytes"], "r.png", { type: "image/png" }));
  return new Request("https://api.example/api/expenses/ocr", {
    body: form,
    headers: { origin: ORIGIN },
    method: "POST",
  }) as never;
}

async function scanData() {
  const response = await POST(uploadRequest());
  expect(response.status).toBe(200);
  return ((await response.json()) as { data: Record<string, unknown> }).data;
}

describe("expenses/ocr scan", () => {
  beforeEach(() => {
    flags.expenses_module = true;
    flags.expenses_ocr = true;
    for (const mock of Object.values(mocks)) {
      mock.mockReset();
    }
    account.get.mockResolvedValue({ $id: "user-1" });
    mocks.extractReceipt.mockResolvedValue(receipt);
    mocks.convertAmountToNok.mockResolvedValue({
      amountInNok: null,
      exchangeRate: null,
    });
    mocks.loadActiveCostTypes.mockResolvedValue([
      { label: "Food", slug: "meeting-food" },
    ]);
    mocks.selectExamples.mockResolvedValue([]);
    mocks.classifyReceipt.mockResolvedValue({
      confidence: 0.9,
      costType: "meeting-food",
      reason: "pizza",
    });
    mocks.createRow.mockResolvedValue({});
    mocks.findPossibleDuplicate.mockResolvedValue(null);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("answers costType, confidence, receiptIssues, ocrAmount and possibleDuplicate", async () => {
    mocks.convertAmountToNok.mockResolvedValue({
      amountInNok: 1300,
      exchangeRate: 10.83,
    });
    mocks.findPossibleDuplicate.mockResolvedValue({
      expenseId: "e1",
      match: "file",
      reimbursementNumber: "10042",
    });

    const data = await scanData();

    expect(data).toMatchObject({
      costType: "meeting-food",
      costTypeConfidence: 0.9,
      ocrAmount: 1300,
      possibleDuplicate: true,
      receiptIssues: ["missing_date"],
    });
    expect(mocks.findPossibleDuplicate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ amount: 1300, date: "2026-11-01" })
    );
    expect(mocks.createRow).toHaveBeenCalledTimes(1);
  });

  it("keeps the legacy category field", async () => {
    const data = await scanData();

    expect(data).toMatchObject({
      amount: 120,
      amountInNok: null,
      category: "meal",
      ocrAmount: 120,
      vendor: "Dominos",
    });
  });

  it("still answers when the scan cannot be stored", async () => {
    mocks.createRow.mockRejectedValue(new Error("db down"));

    const data = await scanData();

    expect(data.costType).toBe("meeting-food");
  });

  it("answers costType null when classification throws", async () => {
    mocks.classifyReceipt.mockRejectedValue(new Error("model down"));

    const data = await scanData();

    expect(data).toMatchObject({ costType: null, costTypeConfidence: 0 });
  });

  it("keeps the duplicate flag when classification throws unexpectedly", async () => {
    mocks.loadActiveCostTypes.mockRejectedValue(new Error("x"));
    mocks.findPossibleDuplicate.mockResolvedValue({
      expenseId: "e1",
      match: "file",
      reimbursementNumber: "10042",
    });

    const data = await scanData();

    expect(data).toMatchObject({ costType: null, possibleDuplicate: true });
  });

  it("keeps the classification when the duplicate lookup throws", async () => {
    mocks.findPossibleDuplicate.mockRejectedValue(new Error("x"));

    const data = await scanData();

    expect(data).toMatchObject({
      costType: "meeting-food",
      possibleDuplicate: false,
    });
  });

  it("skips classification when no type is active", async () => {
    mocks.loadActiveCostTypes.mockResolvedValue([]);

    const data = await scanData();

    expect(data.costType).toBeNull();
    expect(mocks.classifyReceipt).not.toHaveBeenCalled();
  });

  it("skips classification and the duplicate check for a bank statement", async () => {
    mocks.extractReceipt.mockResolvedValue({
      ...receipt,
      documentType: "bank-statement",
    });

    const data = await scanData();

    expect(data).toMatchObject({
      costType: null,
      costTypeConfidence: 0,
      possibleDuplicate: false,
    });
    expect(mocks.classifyReceipt).not.toHaveBeenCalled();
    expect(mocks.findPossibleDuplicate).not.toHaveBeenCalled();
    expect(mocks.createRow).toHaveBeenCalledTimes(1);
  });
});

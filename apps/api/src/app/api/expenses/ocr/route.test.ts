import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  findScan: vi.fn(),
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
  findScan: mocks.findScan,
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

function uploadRequest(purpose?: string) {
  const form = new FormData();
  form.append("file", new File(["bytes"], "r.png", { type: "image/png" }));
  const query = purpose ? `?purpose=${purpose}` : "";
  return new Request(`https://api.example/api/expenses/ocr${query}`, {
    body: form,
    headers: { origin: ORIGIN },
    method: "POST",
  }) as never;
}

async function scanData(purpose?: string) {
  const response = await POST(uploadRequest(purpose));
  expect(response.status).toBe(200);
  return ((await response.json()) as { data: Record<string, unknown> }).data;
}

/** The scan the route stored, as `saveScan` wrote it. */
function storedScan() {
  const row = mocks.createRow.mock.calls[0]?.[3] as { result: string };
  return JSON.parse(row.result) as { classification: unknown };
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
    mocks.findScan.mockResolvedValue(null);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

  it("loads the types while the file is read and caps the classification", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    let finishRead: (value: unknown) => void = () => undefined;
    mocks.extractReceipt.mockReturnValue(
      new Promise((resolve) => {
        finishRead = resolve;
      })
    );

    const response = POST(uploadRequest());
    await vi.waitFor(() => {
      expect(mocks.extractReceipt).toHaveBeenCalled();
      expect(mocks.loadActiveCostTypes).toHaveBeenCalled();
    });
    finishRead(receipt);
    expect((await response).status).toBe(200);

    expect(mocks.classifyReceipt).toHaveBeenCalledWith(
      expect.objectContaining({ abortSignal: expect.any(AbortSignal) })
    );
    expect(timeout).toHaveBeenCalledWith(8000);
  });

  it("answers no type, and stores none, when the time limit stops the classification", async () => {
    vi.spyOn(AbortSignal, "timeout").mockImplementation(() =>
      AbortSignal.abort()
    );
    mocks.classifyReceipt.mockResolvedValue({
      confidence: 0,
      costType: null,
      reason: null,
    });

    const data = await scanData();

    expect(data).toMatchObject({ costType: null, costTypeConfidence: 0 });
    // Stored untyped, so the submission can still classify the receipt.
    expect(storedScan().classification).toBeNull();
  });

  it("answers from a stored receipt scan with a type, without the model", async () => {
    mocks.findScan.mockResolvedValue({
      amountInNok: null,
      classification: { confidence: 0.85, costType: "social", reason: "x" },
      exchangeRate: null,
      receipt: { ...receipt, amount: 99, vendor: "Peppes" },
    });
    mocks.findPossibleDuplicate.mockResolvedValue({
      expenseId: "e1",
      match: "file",
      reimbursementNumber: "10042",
    });

    for (const purpose of [undefined, "receipt"]) {
      const data = await scanData(purpose);

      expect(data).toMatchObject({
        amount: 99,
        costType: "social",
        costTypeConfidence: 0.85,
        ocrAmount: 99,
        possibleDuplicate: true,
        receiptIssues: ["missing_date"],
        vendor: "Peppes",
      });
    }
    expect(mocks.extractReceipt).not.toHaveBeenCalled();
    expect(mocks.convertAmountToNok).not.toHaveBeenCalled();
    expect(mocks.loadActiveCostTypes).not.toHaveBeenCalled();
    expect(mocks.classifyReceipt).not.toHaveBeenCalled();
    expect(mocks.createRow).not.toHaveBeenCalled();
    expect(mocks.findPossibleDuplicate).toHaveBeenCalledWith(
      expect.anything(),
      { amount: 99, date: "2026-11-01", fileHash: expect.any(String) }
    );
  });

  it("reads the file again when the stored scan has no type or is no receipt", async () => {
    const stored = {
      amountInNok: null,
      classification: null,
      exchangeRate: null,
      receipt,
    };
    mocks.findScan.mockResolvedValueOnce(stored).mockResolvedValueOnce({
      ...stored,
      classification: { confidence: 0.9, costType: "social", reason: "x" },
      receipt: { ...receipt, documentType: "bank-statement" },
    });

    await scanData();
    await scanData();
    // A bank statement upload never looks for a stored scan.
    await scanData("bank-statement");

    expect(mocks.findScan).toHaveBeenCalledTimes(2);
    expect(mocks.extractReceipt).toHaveBeenCalledTimes(3);
  });

  it("answers no NOK amount for a foreign receipt it could not convert", async () => {
    mocks.extractReceipt.mockResolvedValue({
      ...receipt,
      amount: 40,
      currency: "EUR",
    });

    const data = await scanData();

    expect(data).toMatchObject({
      amount: 40,
      amountInNok: null,
      ocrAmount: null,
    });
    expect(mocks.findPossibleDuplicate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ amount: null })
    );
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

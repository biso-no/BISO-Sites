import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const account = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("@/lib/auth", () => ({
  createAuthenticatedClient: vi.fn(async () => ({ account })),
}));

const flags = vi.hoisted(() => ({
  expenses_module: false,
  expenses_ocr: false,
}));
vi.mock("@repo/shared/utils/feature-flags-server", () => ({
  getFeatureFlagStates: vi.fn(async () => ({ ...flags })),
}));

vi.mock("@repo/ai/models", () => ({ fastModel: "f" }));
const generateObject = vi.hoisted(() => vi.fn());
vi.mock("ai", () => ({ generateObject }));

import { POST } from "./route";

const ORIGIN = "http://localhost:3000";

function request() {
  return new Request("https://api.example/api/expenses/summary", {
    headers: { origin: ORIGIN },
    method: "POST",
  }) as never;
}

describe("expenses/summary auth", () => {
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

describe("expenses/summary result", () => {
  beforeEach(() => {
    account.get.mockResolvedValue({ $id: "user-1" });
    flags.expenses_module = true;
    flags.expenses_ocr = true;
    generateObject.mockReset();
  });

  afterEach(() => {
    flags.expenses_module = false;
    flags.expenses_ocr = false;
  });

  function summaryRequest(body: unknown) {
    return new Request("https://api.example/api/expenses/summary", {
      body: JSON.stringify(body),
      headers: { origin: ORIGIN },
      method: "POST",
    }) as never;
  }

  it("summary returns an occasion suggestion", async () => {
    generateObject.mockResolvedValue({
      object: {
        occasionSuggestion: "Welcome week for new students",
        summary: "Food.",
      },
    });

    const response = await POST(summaryRequest({ descriptions: ["Pizza"] }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      occasionSuggestion: "Welcome week for new students",
      success: true,
      summary: "Food.",
    });
    const { schema } = generateObject.mock.calls[0]?.[0] as {
      schema: { safeParse: (v: unknown) => { success: boolean } };
    };
    // Required-nullable: a missing key is rejected, null is fine.
    expect(schema.safeParse({ summary: "x" }).success).toBe(false);
    expect(
      schema.safeParse({ occasionSuggestion: null, summary: "x" }).success
    ).toBe(true);
  });

  it("asks for the occasion suggestion in the student's language", async () => {
    generateObject.mockResolvedValue({
      object: { occasionSuggestion: "Fadderuke", summary: "Food." },
    });

    const response = await POST(
      summaryRequest({ locale: "no", receipts: [{ description: "Pizza" }] })
    );

    expect(response.status).toBe(200);
    const { messages } = generateObject.mock.calls[0]?.[0] as {
      messages: { content: string }[];
    };
    expect(messages[0]?.content).toContain("Norwegian (bokmål)");
  });
});

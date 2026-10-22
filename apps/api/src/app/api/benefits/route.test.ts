import { beforeEach, describe, expect, it, vi } from "vitest";

const listRows = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({
  createAuthenticatedClient: vi.fn(),
  extractJwtFromRequest: vi.fn(),
}));
vi.mock("@repo/api/server", () => ({
  createAdminClient: vi.fn(async () => ({ db: { listRows } })),
}));

import { clearPublicBenefitsCache } from "@/lib/benefits/public-benefits";
import { GET, OPTIONS } from "./route";

function row(
  id: string,
  campusId: string,
  extra: Record<string, unknown> = {}
) {
  return {
    $createdAt: "2026-01-01T00:00:00.000Z",
    $id: id,
    campus_id: campusId,
    redemption_type: "code",
    redemption_value: "SECRET-CODE-123",
    section: "member",
    sort_order: 0,
    status: "published",
    title_nb: `Fordel ${id}`,
    ...extra,
  };
}

function mockTables(rows: unknown[], partners: unknown[] = []) {
  listRows.mockImplementation((_db: string, table: string) =>
    Promise.resolve({
      rows: table === "campus_benefits" ? rows : partners,
    })
  );
}

function request(query = "", headers: Record<string, string> = {}) {
  return new Request(`https://api.biso.no/api/benefits${query}`, {
    headers,
  }) as never;
}

describe("GET /api/benefits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearPublicBenefitsCache();
    mockTables([row("nat", "5"), row("bergen", "2")]);
  });

  it("lists campus benefits before national ones, without any code", async () => {
    const response = await GET(request("?campus=2"));
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).not.toContain("redemption_value");
    expect(text).not.toContain("SECRET-CODE-123");
    const { benefits } = JSON.parse(text);
    expect(benefits.map((b: { id: string }) => b.id)).toEqual([
      "bergen",
      "nat",
    ]);
  });

  it("pins the list query: published only, public columns, never the code", async () => {
    await GET(request("?campus=2"));
    const benefitCall = listRows.mock.calls.find(
      (call) => call[1] === "campus_benefits"
    );
    const queries = (benefitCall?.[2] as string[]).join(" ");
    expect(queries).toContain("published");
    expect(queries).toContain("equal");
    expect(queries).toContain("select");
    expect(queries).toContain("title_nb");
    expect(queries).not.toContain("redemption_value");
  });

  it("hides drafts, expired rows and rows of ended partners, using the request-time clock", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-22T12:00:00.000Z"));
    try {
      mockTables(
        [
          row("ok", "5"),
          row("ok-until", "5", { publish_end: "2026-12-01T00:00:00.000Z" }),
          row("draft", "5", { status: "draft" }),
          row("expired", "5", { publish_end: "2026-06-01T00:00:00.000Z" }),
          row("inactive", "5", { partner_id: "p1" }),
          row("missing-partner", "5", { partner_id: "p2" }),
          row("with-partner", "5", { partner_id: "p3" }),
        ],
        [
          { $id: "p1", is_active: false, name: "Gone" },
          { $id: "p3", is_active: true, name: "Here" },
        ]
      );
      const { benefits } = await (await GET(request())).json();
      expect(benefits.map((b: { id: string }) => b.id).sort()).toEqual([
        "ok",
        "ok-until",
        "with-partner",
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns national only for an invalid or missing campus", async () => {
    for (const query of ["?campus=x", ""]) {
      const response = await GET(request(query));
      const { benefits } = await response.json();
      expect(benefits.map((b: { id: string }) => b.id)).toEqual(["nat"]);
    }
  });

  it("ignores a missing or invalid JWT", async () => {
    const response = await GET(
      request("?campus=2", { authorization: "Bearer garbage" })
    );
    expect(response.status).toBe(200);
  });

  it("sets no-store and CORS headers", async () => {
    const response = await GET(request("", { origin: "https://biso.no" }));
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "https://biso.no"
    );
  });

  it("answers 503 unavailable when the database fails", async () => {
    listRows.mockRejectedValue(new Error("boom"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await GET(request("?campus=2"));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "unavailable" });
    expect(JSON.stringify(spy.mock.calls)).not.toContain("boom");
    spy.mockRestore();
  });
});

describe("OPTIONS /api/benefits", () => {
  it("returns CORS headers", () => {
    const response = OPTIONS(
      new Request("https://api.biso.no/api/benefits", {
        headers: { origin: "https://biso.no" },
        method: "OPTIONS",
      }) as never
    );
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "https://biso.no"
    );
  });
});

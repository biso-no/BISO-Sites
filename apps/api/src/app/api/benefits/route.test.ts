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

function mockTables(rows: unknown[]) {
  listRows.mockImplementation(async (_db: string, table: string) => ({
    rows: table === "campus_benefits" ? rows : [],
  }));
}

function request(query = "", headers: Record<string, string> = {}) {
  return new Request(`https://api.biso.no/api/benefits${query}`, {
    headers,
  }) as never;
}

describe("GET /api/benefits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it("never selects the code column", async () => {
    await GET(request("?campus=2"));
    const queries = listRows.mock.calls
      .flatMap((call) => call[2] as string[])
      .join(" ");
    expect(queries).not.toContain("redemption_value");
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

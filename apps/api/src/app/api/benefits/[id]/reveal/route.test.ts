import { beforeEach, describe, expect, it, vi } from "vitest";

const resolveMemberPassForRequest = vi.hoisted(() => vi.fn());
const createAdminClient = vi.hoisted(() => vi.fn());
const db = vi.hoisted(() => ({
  createRow: vi.fn(),
  getRow: vi.fn(),
  listRows: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({
  createAuthenticatedClient: vi.fn(),
  extractJwtFromRequest: vi.fn(),
}));
vi.mock("@repo/api/server", () => ({ createAdminClient }));
vi.mock("@/lib/member-pass/resolve", () => ({ resolveMemberPassForRequest }));

import { OPTIONS, POST } from "./route";

const CODE = "SECRET-CODE-XYZ-987";
const ACTIVE = { holder: {}, state: "active" } as const;

let userSeq = 0;
function activeUser() {
  userSeq += 1;
  return { ...ACTIVE, userId: `user-${userSeq}` };
}

function notFound() {
  return Object.assign(new Error("not found"), { code: 404 });
}

function benefit(extra: Record<string, unknown> = {}) {
  return {
    campus_id: "5",
    partner_id: null,
    publish_end: null,
    publish_start: null,
    redemption_type: "code",
    section: "member",
    status: "published",
    ...extra,
  };
}

function seed({
  row = benefit(),
  code = { value: CODE } as { value: string } | null,
} = {}) {
  db.getRow.mockImplementation((_d: string, table: string) => {
    if (table === "campus_benefits" && row) {
      return Promise.resolve(row);
    }
    if (table === "benefit_codes" && code) {
      return Promise.resolve(code);
    }
    return Promise.reject(notFound());
  });
}

function call(id = "ben-1", headers: Record<string, string> = {}) {
  return POST(
    new Request(`https://api.biso.no/api/benefits/${id}/reveal`, {
      headers: { authorization: "Bearer jwt", ...headers },
      method: "POST",
    }) as never,
    { params: Promise.resolve({ id }) }
  );
}

describe("POST /api/benefits/[id]/reveal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createAdminClient.mockResolvedValue({ db });
    db.listRows.mockResolvedValue({ rows: [] });
    db.createRow.mockResolvedValue({});
    seed();
    resolveMemberPassForRequest.mockResolvedValue(activeUser());
  });

  it("reveals the code to an active member as exactly { value }", async () => {
    const response = await call("ben-1", { origin: "https://biso.no" });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ value: CODE });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "https://biso.no"
    );
  });

  it("answers 401 not_authenticated without touching the database", async () => {
    resolveMemberPassForRequest.mockResolvedValue({ state: "unauthenticated" });
    const response = await call();
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "not_authenticated" });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it.each([
    "not_member",
    "expired",
    "no_bi_identity",
  ])("answers 403 not_member for state %s without reading any row", async (state) => {
    resolveMemberPassForRequest.mockResolvedValue({ state });
    const response = await call();
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "not_member" });
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(db.getRow).not.toHaveBeenCalled();
  });

  it("answers 503 membership_unavailable on a membership outage, never not_member", async () => {
    resolveMemberPassForRequest.mockResolvedValue({ state: "unavailable" });
    const response = await call();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "membership_unavailable" });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("answers 404 not_found for an unknown benefit", async () => {
    seed({ row: null as never });
    const response = await call();
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "not_found" });
  });

  it("answers 404 not_found for a junk id without a database call", async () => {
    for (const id of ["a/b", "x".repeat(100), "..", "a b", "-lead"]) {
      const response = await call(id);
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: "not_found" });
    }
    expect(db.getRow).not.toHaveBeenCalled();
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("answers 409 no_code when the benefit has no code", async () => {
    seed({ code: null, row: benefit({ redemption_type: "onsite" }) });
    const response = await call();
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "no_code" });
  });

  it("answers 503 unavailable for an unexpected backend failure", async () => {
    db.getRow.mockRejectedValue(
      Object.assign(new Error("db down"), { code: 500 })
    );
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await call();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "unavailable" });
    spy.mockRestore();
  });

  it("rate limits an active user at 30 per minute", async () => {
    resolveMemberPassForRequest.mockResolvedValue({
      ...ACTIVE,
      userId: "rate-limited-user",
    });
    for (let i = 0; i < 30; i++) {
      expect((await call()).status).toBe(200);
    }
    const response = await call();
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ error: "rate_limited" });
  });

  it("never logs the code, even when a later step fails", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    db.listRows.mockRejectedValue(
      Object.assign(new Error(`failed near ${CODE}`), { code: 500 })
    );
    const response = await call();
    expect(response.status).toBe(503);
    const logged = JSON.stringify(
      spy.mock.calls.map((args) =>
        args.map((a) => (a instanceof Error ? { message: a.message } : a))
      )
    );
    expect(logged).not.toContain(CODE);
    expect(JSON.stringify(await response.clone().text())).not.toContain(CODE);
    spy.mockRestore();
  });
});

describe("OPTIONS /api/benefits/[id]/reveal", () => {
  it("returns CORS headers", () => {
    const response = OPTIONS(
      new Request("https://api.biso.no/api/benefits/x/reveal", {
        headers: { origin: "https://biso.no" },
        method: "OPTIONS",
      }) as never
    );
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "https://biso.no"
    );
  });
});

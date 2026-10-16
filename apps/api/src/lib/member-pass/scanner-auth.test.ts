import { beforeEach, describe, expect, it, vi } from "vitest";

const account = vi.hoisted(() => ({ get: vi.fn() }));
const listRows = vi.hoisted(() => vi.fn());
const createAuthenticatedClient = vi.hoisted(() =>
  vi.fn(async () => ({ account }))
);

vi.mock("server-only", () => ({}));
// Keep the real `extractJwtFromRequest` (a pure header check) so the "no
// Bearer header" guard is exercised for real; only `createAuthenticatedClient`
// is mocked. Same pattern as resolve.test.ts.
vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth")>()),
  createAuthenticatedClient,
}));
vi.mock("@repo/api/server", () => ({
  createAdminClient: vi.fn(async () => ({ db: { listRows } })),
}));

import { requireScanner } from "./scanner-auth";

const NOW = new Date("2026-09-17T12:00:00.000Z");

function request(
  headers: Record<string, string> = { authorization: "Bearer jwt" }
) {
  return new Request("https://api.biso.no/api/member-pass/scanner", {
    headers,
  }) as never;
}

function grantRow(overrides: Record<string, unknown> = {}) {
  return {
    $createdAt: "2026-09-01T00:00:00.000Z",
    $id: "grant-1",
    campus_id: "campus-1",
    email: "scanner@biso.no",
    expires_at: null,
    granted_by: "admin-1",
    invited_at: null,
    name: "Scanner",
    revoked_at: null,
    user_id: "user-1",
    ...overrides,
  };
}

describe("requireScanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    account.get.mockResolvedValue({ $id: "user-1" });
    listRows.mockResolvedValue({ rows: [grantRow()] });
  });

  it("rejects with no Authorization header, without falling back to a session cookie", async () => {
    const result = await requireScanner(request({}), NOW);

    expect(result).toEqual({
      error: "not_authenticated",
      ok: false,
      status: 401,
    });
    expect(createAuthenticatedClient).not.toHaveBeenCalled();
  });

  it("rejects a non-Bearer Authorization header", async () => {
    const result = await requireScanner(
      request({ authorization: "Basic dXNlcjpwYXNz" }),
      NOW
    );

    expect(result).toEqual({
      error: "not_authenticated",
      ok: false,
      status: 401,
    });
    expect(createAuthenticatedClient).not.toHaveBeenCalled();
  });

  it("rejects an invalid JWT", async () => {
    account.get.mockRejectedValue(new Error("bad jwt"));

    const result = await requireScanner(request(), NOW);

    expect(result).toEqual({
      error: "not_authenticated",
      ok: false,
      status: 401,
    });
    expect(listRows).not.toHaveBeenCalled();
  });

  it("rejects a signed-in user with no grant at all", async () => {
    listRows.mockResolvedValue({ rows: [] });

    const result = await requireScanner(request(), NOW);

    expect(result).toEqual({ error: "not_scanner", ok: false, status: 403 });
  });

  it("rejects an expired grant", async () => {
    listRows.mockResolvedValue({
      rows: [grantRow({ expires_at: "2026-09-01T00:00:00.000Z" })],
    });

    const result = await requireScanner(request(), NOW);

    expect(result).toEqual({ error: "not_scanner", ok: false, status: 403 });
  });

  it("rejects a revoked grant", async () => {
    listRows.mockResolvedValue({
      rows: [grantRow({ revoked_at: "2026-09-05T00:00:00.000Z" })],
    });

    const result = await requireScanner(request(), NOW);

    expect(result).toEqual({ error: "not_scanner", ok: false, status: 403 });
  });

  it("returns the user id and grant for an active scanner", async () => {
    const grant = grantRow();
    listRows.mockResolvedValue({ rows: [grant] });

    const result = await requireScanner(request(), NOW);

    expect(result).toEqual({ grant, ok: true, userId: "user-1" });
  });
});

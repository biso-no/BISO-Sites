import { beforeEach, describe, expect, mock, test } from "bun:test";
import { hashGuestToken } from "./guest-links";

const TOKEN = "guest-token";

const db = { listRows: mock() };

mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db })),
}));

const { resolveGuestLink } = await import("./guest-scan");

const liveLink = {
  $id: "link-1",
  expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  revoked_at: null,
  token_hash: hashGuestToken(TOKEN),
};

describe("resolveGuestLink", () => {
  beforeEach(() => {
    db.listRows.mockReset();
    db.listRows.mockResolvedValue({ rows: [liveLink], total: 1 });
  });

  test("looks the link up by the hash of its token", async () => {
    expect(await resolveGuestLink(TOKEN)).toMatchObject({ $id: "link-1" });
    expect(JSON.stringify(db.listRows.mock.calls[0]?.[2])).toContain(
      hashGuestToken(TOKEN)
    );
  });

  test("refuses revoked or expired links", async () => {
    for (const link of [
      { ...liveLink, revoked_at: new Date().toISOString() },
      { ...liveLink, expires_at: new Date(Date.now() - 1000).toISOString() },
    ]) {
      db.listRows.mockResolvedValue({ rows: [link], total: 1 });
      expect(await resolveGuestLink(TOKEN)).toBeNull();
    }
  });

  test("rejects an empty or too-long token without querying the database", async () => {
    expect(await resolveGuestLink("")).toBeNull();
    expect(await resolveGuestLink("a".repeat(129))).toBeNull();
    expect(db.listRows).not.toHaveBeenCalled();
  });
});

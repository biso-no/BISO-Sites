import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ listRows: vi.fn() }));
const posting = vi.hoisted(() => ({ postApprovedExpense: vi.fn() }));

vi.mock("@repo/api/server", () => ({
  createAdminClient: vi.fn(async () => ({ db })),
}));
vi.mock("@repo/shared/utils/feature-flags-server", () => ({
  isFeatureEnabled: vi.fn(async () => true),
}));
vi.mock("@/lib/expense-posting", () => posting);

import { Query } from "@repo/api";
import { POST } from "./route";

function request() {
  return new Request("https://api.example/api/expenses/post-pending", {
    headers: { "x-cron-secret": "cron-secret" },
    method: "POST",
  }) as never;
}

describe("expenses/post-pending", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "cron-secret";
    db.listRows.mockReset();
    posting.postApprovedExpense.mockReset();
  });

  it("lists the oldest approved expenses first", async () => {
    db.listRows.mockResolvedValue({ rows: [] });

    await POST(request());

    expect(db.listRows.mock.calls[0][2]).toEqual([
      Query.equal("status", "approved"),
      Query.orderAsc("$updatedAt"),
      Query.limit(10),
    ]);
  });

  it("reports fresh claims as skipped, not posted", async () => {
    db.listRows.mockResolvedValue({
      rows: [{ $id: "a" }, { $id: "b" }, { $id: "c" }],
    });
    posting.postApprovedExpense
      .mockResolvedValueOnce("skipped")
      .mockResolvedValueOnce("posted")
      .mockResolvedValueOnce("skipped");

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      considered: 3,
      posted: 1,
      skipped: 2,
      failed: 0,
    });
  });
});

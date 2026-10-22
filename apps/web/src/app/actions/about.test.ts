import { beforeEach, describe, expect, it, vi } from "vitest";

const sessionDb = vi.hoisted(() => ({
  listRows: vi.fn(),
}));

vi.mock("@repo/api/server", () => ({
  createSessionClient: vi.fn(async () => ({ db: sessionDb })),
}));

import { getPartners } from "./about";

describe("about actions", () => {
  beforeEach(() => {
    sessionDb.listRows.mockReset();
    vi.restoreAllMocks();
  });

  it("returns no partners when Appwrite partner lookup fails", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    sessionDb.listRows.mockRejectedValue(new Error("appwrite unavailable"));

    await expect(getPartners()).resolves.toEqual([]);
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to fetch partners:",
      expect.any(Error)
    );
  });

  it("orders partners by sort_order", async () => {
    sessionDb.listRows.mockResolvedValue({ rows: [] });
    await getPartners();
    const queries = sessionDb.listRows.mock.calls[0][2].join("|");
    expect(queries).toContain('"method":"orderAsc","attribute":"sort_order"');
  });
});

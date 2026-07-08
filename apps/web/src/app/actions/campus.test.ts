import { beforeEach, describe, expect, it, vi } from "vitest";

const sessionDb = vi.hoisted(() => ({
  listRows: vi.fn(),
}));

vi.mock("@repo/api/server", () => ({
  createSessionClient: vi.fn(async () => ({ db: sessionDb })),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: vi.fn(),
    set: vi.fn(),
  })),
}));

vi.mock("@/lib/cookie-prefs", () => ({
  CAMPUS_COOKIE: "campus",
  prefCookieOptions: vi.fn(() => ({})),
}));

import { getCampuses } from "./campus";

describe("campus actions", () => {
  beforeEach(() => {
    sessionDb.listRows.mockReset();
    vi.restoreAllMocks();
  });

  it("returns no campuses when Appwrite campus lookup fails", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    sessionDb.listRows.mockRejectedValue(new Error("appwrite unavailable"));

    await expect(getCampuses()).resolves.toEqual([]);
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to fetch campuses:",
      expect.any(Error)
    );
  });
});

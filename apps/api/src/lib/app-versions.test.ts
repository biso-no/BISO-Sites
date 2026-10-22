import { EMPTY_APP_VERSIONS } from "@repo/shared/utils/app-versions";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const listRows = vi.hoisted(() => vi.fn());

vi.mock("@repo/api/server", () => ({
  createAdminClient: async () => ({ db: { listRows } }),
}));

import { readAppVersions, resetAppVersionsCacheForTests } from "./app-versions";

function rows(...items: Record<string, unknown>[]) {
  return Promise.resolve({ total: items.length, rows: items });
}

const IOS_ROW = {
  $id: "ios",
  platform: "ios",
  minimum_version: "2.4.0",
  recommended_version: null,
};
const ANDROID_ROW = {
  $id: "android",
  platform: "android",
  minimum_version: "2.4.0",
  recommended_version: "2.4.1",
};

function tableNotFound(): Error {
  return Object.assign(
    new Error("Table with the requested ID could not be found."),
    { code: 404, type: "table_not_found" }
  );
}

describe("readAppVersions", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetAppVersionsCacheForTests();
    listRows.mockReset();
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {
      // Keep the expected failure logs out of the test output.
    });
  });

  afterEach(() => {
    consoleError.mockRestore();
    vi.useRealTimers();
  });

  it("reads every platform's row in one list call", async () => {
    listRows.mockReturnValue(rows(IOS_ROW, ANDROID_ROW));

    expect(await readAppVersions()).toEqual({
      ios: { minimum: "2.4.0", recommended: null },
      android: { minimum: "2.4.0", recommended: "2.4.1" },
    });
    expect(listRows).toHaveBeenCalledTimes(1);
    expect(listRows).toHaveBeenCalledWith(
      "app",
      "app_versions",
      expect.any(Array)
    );
  });

  it("answers nulls for a platform whose row is missing", async () => {
    listRows.mockReturnValue(rows(ANDROID_ROW));

    expect(await readAppVersions()).toEqual({
      ios: { minimum: null, recommended: null },
      android: { minimum: "2.4.0", recommended: "2.4.1" },
    });
  });

  it("serves a second call within the TTL from the cache", async () => {
    listRows.mockReturnValue(rows(IOS_ROW, ANDROID_ROW));

    await readAppVersions();
    expect(await readAppVersions()).toEqual({
      ios: { minimum: "2.4.0", recommended: null },
      android: { minimum: "2.4.0", recommended: "2.4.1" },
    });
    expect(listRows).toHaveBeenCalledTimes(1);
  });

  it("reads again once the TTL has passed", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    listRows.mockReturnValue(rows(IOS_ROW));

    await readAppVersions();
    vi.setSystemTime(Date.now() + 15_001);
    await readAppVersions();

    expect(listRows).toHaveBeenCalledTimes(2);
  });

  it("never throws when the table does not exist, and does not log it", async () => {
    listRows.mockRejectedValue(tableNotFound());

    expect(await readAppVersions()).toEqual(EMPTY_APP_VERSIONS);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("logs other read failures and answers no rules", async () => {
    const failure = new Error("Service unavailable");
    listRows.mockRejectedValue(failure);

    expect(await readAppVersions()).toEqual(EMPTY_APP_VERSIONS);
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining("[app-versions]"),
      failure
    );
  });

  it("does not cache a failure", async () => {
    listRows
      .mockRejectedValueOnce(new Error("Service unavailable"))
      .mockReturnValueOnce(rows(IOS_ROW));

    expect(await readAppVersions()).toEqual(EMPTY_APP_VERSIONS);
    expect((await readAppVersions()).ios).toEqual({
      minimum: "2.4.0",
      recommended: null,
    });
    expect(listRows).toHaveBeenCalledTimes(2);
  });

  it("answers no rules when the read is too slow, without caching that", async () => {
    vi.useFakeTimers();
    listRows
      .mockReturnValueOnce(
        new Promise(() => {
          // Never answers.
        })
      )
      .mockReturnValueOnce(rows(IOS_ROW));

    const slow = readAppVersions();
    await vi.advanceTimersByTimeAsync(2000);

    expect(await slow).toEqual(EMPTY_APP_VERSIONS);
    expect(vi.getTimerCount()).toBe(0);
    expect((await readAppVersions()).ios.minimum).toBe("2.4.0");
    expect(listRows).toHaveBeenCalledTimes(2);
  });

  it("clears its timer when the read answers in time", async () => {
    vi.useFakeTimers();
    listRows.mockReturnValue(rows(IOS_ROW));

    await readAppVersions();

    expect(vi.getTimerCount()).toBe(0);
  });
});

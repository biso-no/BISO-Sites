import { EMPTY_APP_VERSIONS } from "@repo/shared/utils/app-versions";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getRow = vi.hoisted(() => vi.fn());

vi.mock("@repo/api/server", () => ({
  createAdminClient: async () => ({ db: { getRow } }),
}));

import { readAppVersions } from "./app-versions";

describe("readAppVersions", () => {
  beforeEach(() => {
    getRow.mockReset();
  });

  it("reads each platform's row", async () => {
    getRow.mockImplementation((_db: string, _t: string, id: string) =>
      id === "ios"
        ? Promise.resolve({
            platform: "ios",
            minimum_version: "2.4.0",
            recommended_version: null,
          })
        : Promise.resolve({
            platform: "android",
            minimum_version: "2.4.0",
            recommended_version: "2.4.1",
          })
    );
    expect(await readAppVersions()).toEqual({
      ios: { minimum: "2.4.0", recommended: null },
      android: { minimum: "2.4.0", recommended: "2.4.1" },
    });
  });

  it("answers nulls for a platform whose row is missing", async () => {
    getRow.mockImplementation((_db: string, _t: string, id: string) =>
      id === "ios"
        ? Promise.reject(new Error("Row with the requested ID not found."))
        : Promise.resolve({
            platform: "android",
            minimum_version: "2.4.0",
            recommended_version: null,
          })
    );
    expect((await readAppVersions()).ios).toEqual({
      minimum: null,
      recommended: null,
    });
  });

  it("never throws when the table does not exist", async () => {
    getRow.mockRejectedValue(new Error("Table not found"));
    expect(await readAppVersions()).toEqual(EMPTY_APP_VERSIONS);
  });
});

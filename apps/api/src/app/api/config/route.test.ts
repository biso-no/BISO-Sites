import { EMPTY_APP_VERSIONS } from "@repo/shared/utils/app-versions";
import { beforeEach, describe, expect, it, vi } from "vitest";

const isFeatureEnabled = vi.hoisted(() => vi.fn());

vi.mock("@repo/shared/utils/feature-flags-server", () => ({
  isFeatureEnabled,
}));

const readAppVersions = vi.hoisted(() => vi.fn());

vi.mock("@/lib/app-versions", () => ({ readAppVersions }));

import { GET } from "./route";

describe("app config", () => {
  beforeEach(() => {
    isFeatureEnabled.mockReset();
    readAppVersions.mockReset();
    readAppVersions.mockResolvedValue(EMPTY_APP_VERSIONS);
  });

  it("reports reimbursements as available when the admin switch is on", async () => {
    isFeatureEnabled.mockResolvedValue(true);

    const response = await GET();
    const body = await response.json();

    expect(isFeatureEnabled).toHaveBeenCalledWith("expenses_module");
    expect(body.features).toEqual({
      departures: true,
      expenses: true,
      marketplace: true,
    });
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=0, s-maxage=15"
    );
  });

  it("reports reimbursements as unavailable when the admin switch is off", async () => {
    isFeatureEnabled.mockResolvedValue(false);

    const body = await (await GET()).json();

    expect(body.features.expenses).toBe(false);
  });

  it("includes the app version rules", async () => {
    isFeatureEnabled.mockResolvedValue(true);
    const versions = {
      ios: { minimum: "2.4.0", recommended: "2.5.0" },
      android: { minimum: null, recommended: "2.4.1" },
    };
    readAppVersions.mockResolvedValue(versions);

    const body = await (await GET()).json();

    expect(body.versions).toEqual(versions);
  });

  it("still answers 200 with features when no version rules exist", async () => {
    isFeatureEnabled.mockResolvedValue(true);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.features.expenses).toBe(true);
    expect(body.versions).toEqual(EMPTY_APP_VERSIONS);
  });
});

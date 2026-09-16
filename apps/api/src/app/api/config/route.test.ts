import { beforeEach, describe, expect, it, vi } from "vitest";

const isFeatureEnabled = vi.hoisted(() => vi.fn());

vi.mock("@repo/shared/utils/feature-flags-server", () => ({
  isFeatureEnabled,
}));

import { GET } from "./route";

describe("app config", () => {
  beforeEach(() => {
    isFeatureEnabled.mockReset();
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
});

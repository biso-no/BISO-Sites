import { beforeEach, describe, expect, it, vi } from "vitest";

const membership = vi.hoisted(() => ({
  getMembershipStatus: vi.fn(),
  refreshMembershipStatus: vi.fn(),
}));

vi.mock("@/lib/actions/membership", () => membership);

import { GET } from "./route";

const request = (query = "") =>
  new Request(`https://biso.no/api/membership${query}`);

describe("GET /api/membership", () => {
  beforeEach(() => {
    membership.getMembershipStatus.mockReset();
    membership.refreshMembershipStatus.mockReset();
  });

  it("answers 200 with a definitive status", async () => {
    membership.getMembershipStatus.mockResolvedValue({
      isMember: false,
      reason: "no_student_id",
    });

    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      isMember: false,
      reason: "no_student_id",
    });
  });

  it.each([
    "finago_error",
    "unexpected_error",
  ])("answers 503 when the lookup failed with %s", async (reason) => {
    membership.refreshMembershipStatus.mockResolvedValue({
      isMember: false,
      reason,
    });

    const response = await GET(request("?refresh=true"));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ isMember: false, reason });
  });
});

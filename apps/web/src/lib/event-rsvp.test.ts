import { beforeEach, describe, expect, it, vi } from "vitest";

const { getLoggedInUser, readEventRsvp } = vi.hoisted(() => ({
  getLoggedInUser: vi.fn(),
  readEventRsvp: vi.fn(),
}));

class ControlFlowError extends Error {}

vi.mock("server-only", () => ({}));
vi.mock("@repo/api/server", () => ({
  createAdminClient: vi.fn(async () => ({ db: {} })),
}));
vi.mock("@repo/shared/utils/event-rsvp", () => ({ readEventRsvp }));
vi.mock("@/lib/actions/user", () => ({ getLoggedInUser }));
vi.mock("next/navigation", () => ({
  unstable_rethrow: (error: unknown) => {
    if (error instanceof ControlFlowError) {
      throw error;
    }
  },
}));

import { readEventRsvpForViewer } from "./event-rsvp";

describe("readEventRsvpForViewer", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    getLoggedInUser.mockResolvedValue({ user: { $id: "u1" } });
  });

  it("resolves with a null summary when the read fails", async () => {
    readEventRsvp.mockRejectedValue(new Error("table missing"));
    await expect(readEventRsvpForViewer("e1")).resolves.toEqual({
      signedIn: true,
      summary: null,
    });
  });

  it("rethrows Next.js control-flow errors", async () => {
    getLoggedInUser.mockRejectedValue(new ControlFlowError("dynamic"));
    await expect(readEventRsvpForViewer("e1")).rejects.toBeInstanceOf(
      ControlFlowError
    );
  });
});

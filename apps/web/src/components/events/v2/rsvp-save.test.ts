import type { EventRsvpSummary } from "@repo/shared/utils/event-rsvp";
import { describe, expect, it } from "vitest";
import { settleRsvpSave } from "./rsvp-save";

const previous: EventRsvpSummary = {
  counts: { going: 1, maybe: 0 },
  mine: null,
  open: true,
};
const saved: EventRsvpSummary = { ...previous, mine: "going" };

describe("settleRsvpSave", () => {
  it("takes the server summary on success", async () => {
    const out = await settleRsvpSave(
      async () => ({ data: saved, success: true }),
      "e1",
      "going",
      previous
    );
    expect(out).toEqual({ failed: false, summary: saved });
  });

  it("reverts on a failed result", async () => {
    const out = await settleRsvpSave(
      async () => ({ success: false }),
      "e1",
      "going",
      previous
    );
    expect(out).toEqual({ failed: true, summary: previous });
  });

  it("reverts when the action rejects", async () => {
    const out = await settleRsvpSave(
      () => Promise.reject(new Error("network")),
      "e1",
      "going",
      previous
    );
    expect(out).toEqual({ failed: true, summary: previous });
  });
});

import { describe, expect, it } from "bun:test";
import { normalizeApplicationDeadline, osloEndOfDayIso } from "./oslo-date";

describe("osloEndOfDayIso", () => {
  it("uses CEST (+02:00) in summer", () => {
    expect(osloEndOfDayIso("2026-09-14")).toBe("2026-09-14T21:59:59.999Z");
  });

  it("uses CET (+01:00) in winter", () => {
    expect(osloEndOfDayIso("2026-01-10")).toBe("2026-01-10T22:59:59.999Z");
  });

  it("handles DST change days", () => {
    // DST ends 25 Oct 2026; by 23:59 local the offset is +01:00.
    expect(osloEndOfDayIso("2026-10-25")).toBe("2026-10-25T22:59:59.999Z");
    // DST starts 29 Mar 2026; by 23:59 local the offset is +02:00.
    expect(osloEndOfDayIso("2026-03-29")).toBe("2026-03-29T21:59:59.999Z");
  });
});

describe("normalizeApplicationDeadline", () => {
  it("returns null for empty values", () => {
    expect(normalizeApplicationDeadline(null)).toBeNull();
    expect(normalizeApplicationDeadline("")).toBeNull();
  });

  it("keeps a date-only deadline open for the whole Oslo day", () => {
    const deadline = normalizeApplicationDeadline("2026-09-14");
    expect(deadline).toBe("2026-09-14T21:59:59.999Z");
    // The editor's date input reads back the same calendar date.
    expect(deadline?.slice(0, 10)).toBe("2026-09-14");
  });

  it("migrates legacy midnight-UTC deadlines on save", () => {
    expect(normalizeApplicationDeadline("2026-09-14T00:00:00.000+00:00")).toBe(
      "2026-09-14T21:59:59.999Z"
    );
    expect(normalizeApplicationDeadline("2026-09-14T00:00:00.000Z")).toBe(
      "2026-09-14T21:59:59.999Z"
    );
  });

  it("keeps explicit timestamps", () => {
    expect(normalizeApplicationDeadline("2026-09-14T12:30:00.000Z")).toBe(
      "2026-09-14T12:30:00.000Z"
    );
  });
});

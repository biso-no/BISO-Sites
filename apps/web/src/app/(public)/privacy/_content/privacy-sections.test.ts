import { describe, expect, it } from "vitest";
import { PRIVACY_SECTIONS } from "./privacy-sections";

const section = (id: string) => PRIVACY_SECTIONS.find((s) => s.id === id);

describe("PRIVACY_SECTIONS", () => {
  it("explains error monitoring right after website tracking", () => {
    const ids = PRIVACY_SECTIONS.map((s) => s.id);
    expect(ids.indexOf("error-monitoring")).toBe(
      ids.indexOf("website-tracking") + 1
    );
    const text = section("error-monitoring")?.content ?? "";
    for (const part of ["Sentry", "Frankfurt", "90 days", "Privacy settings"]) {
      expect(text).toContain(part);
    }
  });

  it("lists the replay consent cookie and Sentry as storage", () => {
    expect(section("cookies")?.content).toContain("biso_replay_consent");
    expect(section("data-storage")?.content).toContain("Sentry");
  });
});

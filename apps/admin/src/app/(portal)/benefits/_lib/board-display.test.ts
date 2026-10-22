import { describe, expect, it } from "bun:test";
import {
  benefitHref,
  benefitTitle,
  boardHref,
  categoryLabel,
  isDimmedState,
  logoColor,
  logoInitials,
  newBenefitHref,
  sectionLabel,
} from "./board-display";

const HEX_COLOR = /^#[0-9a-f]{6}$/;

describe("labels", () => {
  it("uses the Norwegian catalog labels for the no locale", () => {
    expect(sectionLabel("career", "no")).toBe("Karrierefordeler");
    expect(sectionLabel("career", "en")).toBe("Career advantages");
  });

  it("maps legacy categories and hides a missing one", () => {
    expect(categoryLabel("health_fitness", "no")).toBe("Trening og helse");
    expect(categoryLabel("Health & Fitness", "en")).toBe("Health & fitness");
    expect(categoryLabel(null, "no")).toBeNull();
    expect(categoryLabel("  ", "no")).toBeNull();
  });
});

describe("benefitTitle", () => {
  it("prefers the UI language and falls back to the other", () => {
    const both = { title_en: "Gym", title_nb: "Trening" };
    expect(benefitTitle(both, "no")).toBe("Trening");
    expect(benefitTitle(both, "en")).toBe("Gym");
    expect(benefitTitle({ title_en: "Gym", title_nb: " " }, "no")).toBe("Gym");
    expect(benefitTitle({ title_en: "", title_nb: "Trening" }, "en")).toBe(
      "Trening"
    );
  });
});

describe("isDimmedState", () => {
  it("dims what students cannot see any more", () => {
    expect(isDimmedState("expired")).toBe(true);
    expect(isDimmedState("ended")).toBe(true);
    expect(isDimmedState("hidden")).toBe(true);
    expect(isDimmedState("visible")).toBe(false);
    expect(isDimmedState("draft")).toBe(false);
    expect(isDimmedState("scheduled")).toBe(false);
  });
});

describe("links", () => {
  it("opens an item on the tab it was clicked from", () => {
    expect(benefitHref("abc", "2")).toBe("/benefits/abc?campus=2");
  });

  it("goes back to the tab the panel was opened from", () => {
    expect(boardHref("5")).toBe("/benefits?campus=5");
  });

  it("starts a new item in the chosen section", () => {
    expect(newBenefitHref("2", "career")).toBe(
      "/benefits/new?campus=2&section=career"
    );
  });
});

describe("logo fallback", () => {
  it("uses two initials", () => {
    expect(logoInitials("Løft studios")).toBe("LS");
    expect(logoInitials("Dogtails")).toBe("DO");
    expect(logoInitials("  ")).toBe("");
  });

  it("skips words that start with a number", () => {
    expect(logoInitials("40 % på Fadderullan")).toBe("PF");
    expect(logoInitials("2026")).toBe("20");
  });

  it("keeps a stable colour per name", () => {
    expect(logoColor("Dogtails")).toBe(logoColor("Dogtails"));
    expect(logoColor("")).toMatch(HEX_COLOR);
  });

  it("spreads different names across the palette", () => {
    const names = [
      "Løft studios",
      "Dogtails",
      "Kaffebrenneriet",
      "Econa",
      "Vinmonopolet",
      "SATS",
    ];
    expect(new Set(names.map(logoColor)).size).toBeGreaterThan(2);
  });
});

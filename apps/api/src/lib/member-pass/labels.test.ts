import { termLabel } from "@repo/shared/member-pass/term-label";
import type { MemberPassHolder } from "@repo/shared/member-pass/types";
import { describe, expect, it } from "vitest";
import { memberPassLocale, memberPassTranslator } from "./labels";

const MISSING_MESSAGE_RE = /Missing wallet message/;

function holder(term: MemberPassHolder["term"]): MemberPassHolder {
  return {
    expiryDate: "2026-12-31",
    membershipName: "Semester",
    name: "Markus Heien",
    startDate: "2026-07-01",
    term,
  };
}

describe("memberPassLocale", () => {
  it("is English with no Accept-Language header", () => {
    expect(memberPassLocale(null)).toBe("en");
    expect(memberPassLocale(undefined)).toBe("en");
  });

  it("is Norwegian for no, nb and nn (any region, any case)", () => {
    expect(memberPassLocale("no")).toBe("no");
    expect(memberPassLocale("nb-NO")).toBe("no");
    expect(memberPassLocale("NN")).toBe("no");
    expect(memberPassLocale("nb;q=0.9,en;q=0.8")).toBe("no");
  });

  it("is English for every other primary tag", () => {
    expect(memberPassLocale("en-US,en;q=0.9")).toBe("en");
    expect(memberPassLocale("sv-SE")).toBe("en");
  });

  it("only looks at the first (highest-priority) tag", () => {
    expect(memberPassLocale("en-US,nb;q=0.9")).toBe("en");
    expect(memberPassLocale("nb-NO,en;q=0.9")).toBe("no");
  });
});

describe("memberPassTranslator", () => {
  it("reads plain and nested keys from the English bundle", () => {
    const t = memberPassTranslator("en-US");
    expect(t("member")).toBe("Member");
    expect(t("walletLabels.membership")).toBe("Membership");
    expect(t("walletLabels.validUntil")).toBe("Valid until");
  });

  it("reads the Norwegian bundle", () => {
    const t = memberPassTranslator("nb-NO");
    expect(t("member")).toBe("Medlem");
    expect(t("walletLabels.validUntil")).toBe("Gyldig til");
  });

  it("throws for an unknown message key", () => {
    const t = memberPassTranslator("en");
    expect(() => t("does.not.exist")).toThrow(MISSING_MESSAGE_RE);
  });

  it("formats a semester term via the ICU select in term.semester", () => {
    const t = memberPassTranslator("en");
    expect(
      termLabel(
        t,
        holder({
          duration: "semester",
          fromYear: 2026,
          season: "spring",
          toYear: 2026,
        })
      )
    ).toBe("Spring 2026");
    expect(
      termLabel(
        t,
        holder({
          duration: "semester",
          fromYear: 2026,
          season: "fall",
          toYear: 2026,
        })
      )
    ).toBe("Fall 2026");
  });

  it("formats a multi-year term via term.span", () => {
    const t = memberPassTranslator("en");
    expect(
      termLabel(
        t,
        holder({ duration: "year", fromYear: 2026, season: null, toYear: 2027 })
      )
    ).toBe("2026–2027");
  });

  it("formats term.semester in Norwegian", () => {
    const t = memberPassTranslator("nb");
    expect(
      termLabel(
        t,
        holder({
          duration: "semester",
          fromYear: 2026,
          season: "spring",
          toYear: 2026,
        })
      )
    ).toBe("Vår 2026");
  });
});

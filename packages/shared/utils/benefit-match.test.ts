import { describe, expect, it } from "vitest";
import {
  benefitTokens,
  compareBenefitTexts,
  isMergeMatch,
  isPossibleMatch,
  normalizeBenefitText,
  partnerKey,
  suggestPartnerName,
} from "./benefit-match";

describe("normalizeBenefitText", () => {
  it("removes space before percent and collapses whitespace", () => {
    expect(normalizeBenefitText("  40 %  rabatt ")).toBe("40% rabatt");
  });
});

describe("benefitTokens", () => {
  it("drops stopwords and splits on punctuation", () => {
    expect(benefitTokens("Intervju-coaching med BISO HR")).toEqual([
      "intervju",
      "coaching",
    ]);
  });
});

describe("compareBenefitTexts", () => {
  const merges: [string, string][] = [
    ["40 % rabatt på billett til Fadderullan", "40% rabatt på Fadderullan"],
    [
      "Rabatt på alle Rekom-utesteder i Norden og Storbritannia",
      "REKOM-rabatt",
    ],
    [
      "1-1-veiledning på CV, søknad og LinkedIn med Econa (begrenset antall plasser)",
      "Econa karriereveiledning",
    ],
    ["Intervju-coaching med BISO HR", "Intervju-coaching"],
    ["CV-portrettbilde med BISO Media", "CV-portrett"],
    ["25 % rabatt på Peppes Pizza Nydalen", "25 % hos Peppes Pizza Nydalen"],
    [
      "Medlemsavtaler med blant annet Bertoni, Egon Solsiden og BarbeQueZ",
      "Medlemstilbud hos Bertoni",
    ],
  ];
  for (const [a, b] of merges) {
    it(`merges: ${a} / ${b}`, () => {
      expect(isMergeMatch(compareBenefitTexts(a, b))).toBe(true);
    });
  }

  const possibles: [string, string][] = [
    [
      "Karrieredagene Bergen – to dager med inspirerende foredrag og messedag",
      "Karrieredagene",
    ],
    ["Gratis bedriftspresentasjoner på campus", "Bedriftspresentasjoner"],
    ["Arbeidslivsspesifikke kurs og workshops", "Arbeidslivsrettede kurs"],
  ];
  for (const [a, b] of possibles) {
    it(`possible only: ${a} / ${b}`, () => {
      const m = compareBenefitTexts(a, b);
      expect(isMergeMatch(m)).toBe(false);
      expect(isPossibleMatch(m)).toBe(true);
    });
  }

  it("reports dice 0.4 for the kurs pair", () => {
    const m = compareBenefitTexts(
      "Arbeidslivsspesifikke kurs og workshops",
      "Arbeidslivsrettede kurs"
    );
    expect(m.dice).toBeCloseTo(0.4);
    expect(m.containment).toBeCloseTo(0.5);
    expect(m.anchor).toBe(false);
  });

  it("reports containment 1 for the Karrieredagene pair", () => {
    const m = compareBenefitTexts(
      "Karrieredagene Bergen – to dager med inspirerende foredrag og messedag",
      "Karrieredagene"
    );
    expect(m.containment).toBe(1);
    expect(m.anchor).toBe(false);
  });

  const neithers: [string, string][] = [
    [
      "Bli med i undergrupper og utvalg",
      "Bli med på Winter Games på Storefjell med BI-studenter fra hele landet",
    ],
    ["Styrker studentstemmen din i politikken", "Winter Games"],
  ];
  for (const [a, b] of neithers) {
    it(`neither: ${a} / ${b}`, () => {
      const m = compareBenefitTexts(a, b);
      expect(isMergeMatch(m)).toBe(false);
      expect(isPossibleMatch(m)).toBe(false);
    });
  }

  it("is zero when a side has no tokens", () => {
    expect(compareBenefitTexts("", "Rabatt")).toEqual({
      anchor: false,
      containment: 0,
      dice: 0,
    });
  });
});

describe("suggestPartnerName", () => {
  const cases: [string, string | null][] = [
    ["25 % hos Peppes Pizza Nydalen", "Peppes Pizza Nydalen"],
    [
      "20 % rabatt på alle briller (ordinær pris) og gratis synsprøve hos Okkult",
      "Okkult",
    ],
    ["20% hos Løft studios ", "Løft studios"],
    [
      "15 % / 20 % rabatt (inne/takeaway) hos Nama Sushi, Big Horn Bergen, Le Pintxos & Brasserie og Boccone Ristorante",
      null,
    ],
    ["20 % rabatt på ordinære varer hos Bertoni Lagunen og Xhibition", null],
    ["Karrieredagene", null],
  ];
  for (const [input, expected] of cases) {
    it(`${input} -> ${expected}`, () => {
      expect(suggestPartnerName(input)).toBe(expected);
    });
  }
});

describe("partnerKey", () => {
  it("ignores case and surrounding space", () => {
    expect(partnerKey("BERTONI")).toBe(partnerKey(" Bertoni "));
  });
  it("strips a trailing AS", () => {
    expect(partnerKey("Løft Studios AS")).toBe("løft studios");
  });
  it("strips a trailing A/S", () => {
    expect(partnerKey("Foo A/S")).toBe("foo");
  });
});

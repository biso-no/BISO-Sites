import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { BenefitCategoryKey, BenefitSection } from "./benefit-catalog";
import { partnerKey } from "./benefit-match";
import {
  type CampusDataInput,
  type ExistingBenefitInput,
  type MigrationInput,
  type MigrationPlan,
  planBenefitMigration,
  renderMigrationReview,
  summarizeMigrationPlan,
  validateMigrationPlan,
} from "./benefit-migration";

const GENERATED_AT = "2026-10-21T12:00:00.000Z";
const LIST_KEYS = [
  "studentBenefits",
  "careerAdvantages",
  "socialNetwork",
  "safety",
  "businessBenefits",
];
const LINE_ID = /^mb-[0-9a-f]{20}$/;
const PARTNER_ID = /^bp-[0-9a-f]{20}$/;

const INTERVJU = "Intervju-coaching med BISO HR";
const FADDERULLAN = "40 % rabatt på billett til Fadderullan";
const REKOM = "Rabatt på alle Rekom-utesteder i Norden og Storbritannia";
const PEPPES = "25 % rabatt på Peppes Pizza Nydalen";
const VARSLING = "Trygg varslingskanal for alle studenter";

function campusRow(id: string, lists: Record<string, unknown[]>) {
  return { $id: id, ...lists } satisfies CampusDataInput;
}

function benefitRow(
  partial: Partial<ExistingBenefitInput> &
    Pick<ExistingBenefitInput, "$id" | "title_nb">
): ExistingBenefitInput {
  return {
    $createdAt: "2026-01-01T00:00:00.000Z",
    $permissions: ['read("any")'],
    campus_id: "1",
    category: null,
    description_nb: "Beskrivelse",
    kind: "offer",
    partner_id: null,
    partner_logo_url: null,
    partner_name: null,
    redemption_value: null,
    section: null,
    status: "published",
    title_en: null,
    ...partial,
  };
}

function plan(
  benefits: ExistingBenefitInput[],
  campusData: CampusDataInput[]
): MigrationPlan {
  return planBenefitMigration({
    benefits,
    campusData,
    generatedAt: GENERATED_AT,
  });
}

function productionFixture(): MigrationInput {
  return {
    benefits: [
      benefitRow({
        $id: "fadderullan",
        campus_id: "5",
        category: "Entertainment",
        title_nb: "40% rabatt på Fadderullan",
      }),
      benefitRow({
        $id: "intervju",
        campus_id: "5",
        kind: "perk",
        title_nb: "Intervju-coaching",
      }),
      benefitRow({
        $id: "karrieredagene",
        campus_id: "5",
        kind: "perk",
        title_nb: "Karrieredagene",
      }),
      benefitRow({
        $id: "peppes",
        category: "Career",
        title_nb: "25 % hos Peppes Pizza Nydalen",
      }),
      benefitRow({
        $id: "bertoni",
        campus_id: "3",
        partner_name: "Bertoni",
        title_nb: "Medlemstilbud hos Bertoni",
      }),
      benefitRow({
        $id: "loft",
        $permissions: ['read("team:biso-members")'],
        redemption_value: "LOFT20",
        title_nb: "20% hos Løft studios ",
      }),
      benefitRow({
        $id: "los-t",
        description_nb: "",
        status: "draft",
        title_nb: "los t",
      }),
    ],
    campusData: [
      campusRow("1", {
        careerAdvantages_en: [
          "Free company presentations on campus",
          "Interview coaching with BISO HR",
        ],
        careerAdvantages_nb: [
          "Gratis bedriftspresentasjoner på campus",
          INTERVJU,
        ],
        highlights_nb: ["Ikke en fordel"],
        safety_en: ["A safe whistleblowing channel for all students"],
        safety_nb: [VARSLING],
        studentBenefits: ["Gammel kolonne"],
        studentBenefits_en: [
          "40% off Fadderullan tickets",
          "Discounts at all Rekom venues",
          "25% off at Peppes Pizza Nydalen",
        ],
        studentBenefits_nb: [FADDERULLAN, REKOM, PEPPES, "  "],
      }),
      campusRow("2", {
        careerAdvantages_en: ["Interview coaching", "Career days Bergen"],
        careerAdvantages_nb: [
          INTERVJU,
          "Karrieredagene Bergen – to dager med inspirerende foredrag og messedag",
        ],
        safety_en: ["Safe whistleblowing channel"],
        safety_nb: [VARSLING],
        studentBenefits_en: ["40% off Fadderullan tickets"],
        studentBenefits_nb: [FADDERULLAN, REKOM, REKOM],
      }),
      campusRow("3", {
        careerAdvantages_en: ["Interview coaching"],
        careerAdvantages_nb: [INTERVJU],
        safety_en: ["Safe whistleblowing channel"],
        safety_nb: [VARSLING],
        socialNetwork_en: ["Join subgroups and committees"],
        socialNetwork_nb: ["Bli med i undergrupper og utvalg"],
        studentBenefits_en: [
          "40% off Fadderullan tickets",
          "Member deals with Bertoni, Egon Solsiden and BarbeQueZ",
        ],
        studentBenefits_nb: [
          FADDERULLAN,
          "Medlemsavtaler med blant annet Bertoni, Egon Solsiden og BarbeQueZ",
        ],
      }),
      campusRow("4", {
        businessBenefits_en: ["Visibility among 20,000 students"],
        businessBenefits_nb: ["Synlighet blant 20 000 studenter"],
        careerAdvantages_en: ["Interview coaching"],
        careerAdvantages_nb: [INTERVJU],
        safety_en: ["Safe whistleblowing channel"],
        safety_nb: [VARSLING],
        studentBenefits_en: ["40% off Fadderullan tickets", ""],
        studentBenefits_nb: [FADDERULLAN, ""],
      }),
    ],
    generatedAt: GENERATED_AT,
  };
}

function countNonBlankSourceEntries(campusData: CampusDataInput[]): number {
  let count = 0;
  for (const row of campusData) {
    for (const key of LIST_KEYS) {
      const list = row[`${key}_nb`];
      if (!Array.isArray(list)) {
        continue;
      }
      count += list.filter(
        (entry) => typeof entry === "string" && entry.trim() !== ""
      ).length;
    }
  }
  return count;
}

function sha1Prefix(value: string): string {
  return createHash("sha1").update(value).digest("hex").slice(0, 20);
}

describe("planBenefitMigration source lines", () => {
  it("accounts for every non-blank source line exactly once", () => {
    const input = productionFixture();
    const result = planBenefitMigration(input);
    const expected = countNonBlankSourceEntries(input.campusData);
    const fromLines = result.lines.reduce(
      (sum, line) => sum + line.sourceCampusIds.length,
      0
    );
    expect(expected).toBe(21);
    expect(summarizeMigrationPlan(result).sourceLines).toBe(expected);
    expect(fromLines).toBe(expected);
  });

  it("collapses a line found on all four campuses into one national line", () => {
    const result = plan(
      [],
      [
        campusRow("1", {
          careerAdvantages_en: ["Free CV check", "Interview coaching (Oslo)"],
          careerAdvantages_nb: ["Gratis CV-sjekk", INTERVJU],
        }),
        campusRow("2", {
          careerAdvantages_en: ["Interview coaching (Bergen)"],
          careerAdvantages_nb: [INTERVJU],
        }),
        campusRow("3", { careerAdvantages_nb: [INTERVJU] }),
        campusRow("4", { careerAdvantages_nb: [INTERVJU] }),
      ]
    );
    const matching = result.lines.filter((line) => line.titleNb === INTERVJU);
    expect(matching).toHaveLength(1);
    expect(matching[0]).toMatchObject({
      campusId: "5",
      section: "career",
      sortOrder: 0,
      sourceCampusIds: ["1", "2", "3", "4"],
      titleEn: "Interview coaching (Oslo)",
    });
  });

  it("keeps a line found on three campuses as three campus lines", () => {
    const result = plan(
      [],
      ["1", "2", "3"].map((id) =>
        campusRow(id, { careerAdvantages_nb: [INTERVJU] })
      )
    );
    expect(
      result.lines.map((line) => [line.campusId, line.sourceCampusIds])
    ).toEqual([
      ["1", ["1"]],
      ["2", ["2"]],
      ["3", ["3"]],
    ]);
  });

  it("falls back to the Norwegian text when English is missing", () => {
    const result = plan(
      [],
      [
        campusRow("1", {
          studentBenefits_en: ["Free coffee", "   "],
          studentBenefits_nb: [
            "Gratis kaffe i kantina",
            "Medlemspris på arrangementer",
            "Gratis garderobe",
          ],
        }),
      ]
    );
    const [first, blankEnglish, missingEnglish] = result.lines;
    expect(first?.titleEn).toBe("Free coffee");
    expect(first?.note).toBeNull();
    for (const line of [blankEnglish, missingEnglish]) {
      expect(line?.titleEn).toBe(line?.titleNb);
      expect(line?.note).toContain("Mangler engelsk tekst");
    }
    expect(missingEnglish?.sortOrder).toBe(2);
  });

  it("drops blank entries and skips a repeated line on one campus", () => {
    const result = plan(
      [],
      [
        campusRow("1", {
          studentBenefits_en: ["", "Free coffee", "Free coffee"],
          studentBenefits_nb: [
            "  ",
            "Gratis kaffe i kantina",
            "Gratis  kaffe i kantina ",
          ],
        }),
      ]
    );
    expect(result.lines.map((line) => line.action)).toEqual(["create", "skip"]);
    expect(result.lines[1]?.note).toBe("Duplikat");
    expect(summarizeMigrationPlan(result)).toMatchObject({
      created: 1,
      skipped: 1,
      sourceLines: 2,
    });
  });
});

describe("planBenefitMigration matching", () => {
  it("merges a collapsed line into a national perk and moves the perk to career", () => {
    const result = plan(
      [
        benefitRow({
          $id: "intervju",
          campus_id: "5",
          kind: "perk",
          title_nb: "Intervju-coaching",
        }),
      ],
      ["1", "2", "3", "4"].map((id) =>
        campusRow(id, { careerAdvantages_nb: ["Gratis CV-sjekk", INTERVJU] })
      )
    );
    const line = result.lines.find((l) => l.titleNb === INTERVJU);
    const update = result.rowUpdates.find((u) => u.rowId === "intervju");
    expect(line).toMatchObject({
      action: "merge",
      campusId: "5",
      mergeInto: ["intervju"],
      partnerKey: null,
      sortOrder: 1,
    });
    expect(update?.section).toBe("career");
    expect(update?.sortOrder).toBe(1);
  });

  it("merges into a row on the same campus and takes over its order", () => {
    const result = plan(
      [
        benefitRow({
          $id: "peppes",
          category: "Career",
          kind: "offer",
          title_nb: "25 % hos Peppes Pizza Nydalen",
        }),
      ],
      [
        campusRow("1", {
          studentBenefits_nb: [
            "Gratis kaffe i kantina",
            "Medlemspris på arrangementer",
            PEPPES,
          ],
        }),
      ]
    );
    const line = result.lines.find((l) => l.titleNb === PEPPES);
    expect(line).toMatchObject({
      action: "merge",
      mergeInto: ["peppes"],
      score: 1,
    });
    expect(result.rowUpdates).toEqual([
      {
        campusId: "1",
        category: "other",
        makePublic: false,
        partnerKey: partnerKey("Peppes Pizza Nydalen"),
        rowId: "peppes",
        section: "member",
        sortOrder: 2,
        title: "25 % hos Peppes Pizza Nydalen",
      },
    ]);
  });

  it("does not take over the order of a national row from a campus line", () => {
    const result = plan(
      [
        benefitRow({
          $id: "fadderullan",
          campus_id: "5",
          title_nb: "40% rabatt på Fadderullan",
        }),
      ],
      [campusRow("2", { studentBenefits_nb: ["Gratis kaffe", FADDERULLAN] })]
    );
    expect(result.lines[1]).toMatchObject({
      action: "merge",
      mergeInto: ["fadderullan"],
    });
    expect(result.rowUpdates[0]?.sortOrder).toBeNull();
  });

  it("creates a line whose offer exists on another campus and says so", () => {
    const result = plan(
      [benefitRow({ $id: "rekom", campus_id: "1", title_nb: "REKOM-rabatt" })],
      [campusRow("2", { studentBenefits_nb: [REKOM] })]
    );
    const [line] = result.lines;
    expect(line?.action).toBe("create");
    expect(line?.mergeInto).toEqual([]);
    expect(line?.score).toBeNull();
    expect(line?.note).toContain(
      "Samme tilbud finnes på Oslo – vurder å gjøre det nasjonalt"
    );
  });

  it("notes a possible match and scores it", () => {
    const result = plan(productionFixture().benefits, [
      campusRow("2", {
        careerAdvantages_en: ["Career days Bergen"],
        careerAdvantages_nb: [
          "Karrieredagene Bergen – to dager med inspirerende foredrag og messedag",
        ],
      }),
    ]);
    const [line] = result.lines;
    expect(line?.action).toBe("create");
    expect(line?.score).toBeCloseTo(1 / 3);
    expect(line?.note).toBe(
      "Ligner på «Karrieredagene» (Hele BISO, Karrierefordeler)"
    );
  });

  it("suggests a partner for a new member line", () => {
    const result = plan(
      [],
      [campusRow("1", { studentBenefits_nb: ["20 % hos Løft studios"] })]
    );
    expect(result.lines[0]?.partnerKey).toBe("løft studios");
    expect(result.partners).toEqual([
      {
        campusId: "1",
        id: `bp-${sha1Prefix("løft studios")}`,
        key: "løft studios",
        logoUrl: null,
        name: "Løft studios",
        suggested: true,
      },
    ]);
  });
});

describe("planBenefitMigration ids and partners", () => {
  it("gives the same ids for the same input", () => {
    const first = planBenefitMigration(productionFixture());
    const second = planBenefitMigration(productionFixture());
    expect(second.lines.map((line) => line.id)).toEqual(
      first.lines.map((line) => line.id)
    );
    expect(second.partners.map((p) => p.id)).toEqual(
      first.partners.map((p) => p.id)
    );
    for (const line of first.lines) {
      expect(line.id).toMatch(LINE_ID);
    }
    for (const partner of first.partners) {
      expect(partner.id).toMatch(PARTNER_ID);
    }
    const national = first.lines.find((line) => line.titleNb === VARSLING);
    expect(national?.id).toBe(
      `mb-${sha1Prefix("5|safety|trygg varslingskanal for alle studenter")}`
    );
  });

  it("merges partner name variants into one partner", () => {
    const result = plan(
      [
        benefitRow({
          $id: "bertoni-bergen",
          campus_id: "2",
          partner_logo_url: "",
          partner_name: "BERTONI",
          title_nb: "10 % rabatt",
        }),
        benefitRow({
          $id: "bertoni-trondheim",
          campus_id: "3",
          partner_logo_url: "https://example.com/bertoni.png",
          partner_name: "Bertoni",
          title_nb: "Medlemstilbud hos Bertoni",
        }),
      ],
      []
    );
    expect(result.partners).toEqual([
      {
        campusId: "5",
        id: `bp-${sha1Prefix("bertoni")}`,
        key: "bertoni",
        logoUrl: "https://example.com/bertoni.png",
        name: "Bertoni",
        suggested: false,
      },
    ]);
    expect(result.rowUpdates.map((u) => u.partnerKey)).toEqual([
      "bertoni",
      "bertoni",
    ]);
  });

  it("gives no partner key to a row that already has a partner", () => {
    const result = plan(
      [
        benefitRow({
          $id: "linked",
          partner_id: "bp-existing",
          partner_name: "Bertoni",
          title_nb: "Medlemstilbud hos Bertoni",
        }),
      ],
      []
    );
    expect(result.rowUpdates[0]?.partnerKey).toBeNull();
    expect(result.partners).toEqual([]);
  });
});

describe("planBenefitMigration codes, deletions and permissions", () => {
  it("moves codes and proposes deletions without printing codes", () => {
    const result = planBenefitMigration(productionFixture());
    expect(result.codes).toEqual([{ rowId: "loft", value: "LOFT20" }]);
    expect(result.deletions).toEqual([
      { approved: false, rowId: "los-t", title: "los t" },
    ]);
    const review = renderMigrationReview(result);
    expect(review).not.toContain("LOFT20");
    expect(review).toContain("Koder som flyttes: 1");
    expect(review).toContain("| los t | krever godkjenning |");
  });

  it("makes only restricted published rows public", () => {
    const result = plan(
      [
        benefitRow({
          $id: "members",
          $permissions: ['read("team:biso-members")'],
          title_nb: "A",
        }),
        benefitRow({ $id: "public", title_nb: "B" }),
        benefitRow({
          $id: "draft",
          $permissions: ['read("team:biso-members")'],
          status: "draft",
          title_nb: "C",
        }),
      ],
      []
    );
    expect(result.rowUpdates.map((u) => [u.rowId, u.makePublic])).toEqual([
      ["members", true],
      ["public", false],
      ["draft", false],
    ]);
  });

  it("re-sections perks and maps legacy categories", () => {
    const result = plan(
      [
        benefitRow({ $id: "cv", kind: "perk", title_nb: "CV-portrett" }),
        benefitRow({ $id: "verv", kind: "perk", title_nb: "Søk verv" }),
        benefitRow({ $id: "kept", section: "safety", title_nb: "Trygghet" }),
        benefitRow({ $id: "health", category: "Health", title_nb: "Trening" }),
        benefitRow({ $id: "valid", category: "travel", title_nb: "Reise" }),
      ],
      []
    );
    expect(
      result.rowUpdates.map((u) => [u.rowId, u.section, u.category])
    ).toEqual([
      ["cv", "career", null],
      ["verv", "social", null],
      ["kept", "safety", null],
      ["health", "member", "health_fitness"],
      ["valid", "member", "travel"],
    ]);
  });
});

describe("validateMigrationPlan", () => {
  it("accepts a planned migration", () => {
    expect(
      validateMigrationPlan(planBenefitMigration(productionFixture()))
    ).toEqual([]);
  });

  it("reports each hand-editing mistake", () => {
    const broken = structuredClone(planBenefitMigration(productionFixture()));
    broken.lines[0] = { ...broken.lines[0], action: "merge", mergeInto: [] };
    broken.lines[1] = { ...broken.lines[1], partnerKey: "nope" };
    broken.rowUpdates[0] = {
      ...broken.rowUpdates[0],
      section: "carrer" as BenefitSection,
    };
    expect(validateMigrationPlan(broken)).toHaveLength(3);
  });

  it("rejects an unknown version", () => {
    const result = planBenefitMigration(productionFixture());
    const problems = validateMigrationPlan({
      ...result,
      version: 2 as unknown as 1,
    });
    expect(problems).toHaveLength(1);
  });

  it("reports unknown rows, duplicate creates, bad values and empty titles", () => {
    const broken = structuredClone(planBenefitMigration(productionFixture()));
    const creates = broken.lines.filter((line) => line.action === "create");
    const merge = broken.lines.find((line) => line.action === "merge");
    if (!(merge && creates.length >= 3)) {
      throw new Error("fixture needs a merge and three create lines");
    }
    broken.lines.push({ ...creates[0] });
    creates[1].titleNb = "  ";
    creates[2].action = "creat" as "create";
    merge.mergeInto = [...merge.mergeInto, "missing-row"];
    broken.codes.push({ rowId: "missing-code-row", value: "SECRET" });
    broken.deletions.push({
      approved: true,
      rowId: "missing-deletion-row",
      title: "x",
    });
    broken.rowUpdates[0].category = "drinks" as BenefitCategoryKey;
    const problems = validateMigrationPlan(broken);
    expect(problems).toHaveLength(7);
    expect(problems.join("\n")).toContain("missing-row");
    expect(problems.join("\n")).toContain("missing-code-row");
    expect(problems.join("\n")).toContain("missing-deletion-row");
    expect(problems.join("\n")).not.toContain("SECRET");
  });
});

describe("renderMigrationReview", () => {
  it("lists lines per campus and section, existing rows and next steps", () => {
    const result = planBenefitMigration(productionFixture());
    const review = renderMigrationReview(result);
    expect(review).toContain(GENERATED_AT);
    expect(review).toContain("Kildelinjer: 21");
    expect(review).toContain("## Oslo");
    expect(review).toContain("## Hele BISO");
    expect(review).toContain("| Tekst | Handling | Detaljer |");
    expect(review).toContain(
      `| ${INTERVJU} | Slås sammen med «Intervju-coaching» |`
    );
    expect(review).toContain(`| ${REKOM} | Hoppes over | Duplikat |`);
    expect(review).toContain(
      "| 25 % hos Peppes Pizza Nydalen | Oslo | Medlemsfordeler | Annet | Peppes Pizza Nydalen |"
    );
    expect(review).toContain("| Løft studios (forslag) | Oslo |");
    expect(review.indexOf("## Oslo")).toBeLessThan(
      review.indexOf("## Hele BISO")
    );
    expect(review.trimEnd().endsWith("--plan <sti til plan.json>`.")).toBe(
      true
    );
  });
});

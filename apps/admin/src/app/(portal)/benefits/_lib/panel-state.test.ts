import { describe, expect, it } from "bun:test";
import type { BenefitEditData } from "../../_actions/benefits";
import {
  editableDescription,
  emptyPanelValues,
  isPanelDirty,
  panelFooterActions,
  panelKey,
  panelValuesFromBenefit,
  toBenefitFormValues,
  validatePanel,
  withPresetPartner,
} from "./panel-state";

function values(overrides: Partial<ReturnType<typeof emptyPanelValues>> = {}) {
  return {
    ...emptyPanelValues("member", "2"),
    titleNb: "Tittel",
    ...overrides,
  };
}

describe("panelFooterActions", () => {
  it("covers new, draft, archived and published", () => {
    expect(panelFooterActions("draft", true)).toEqual(["saveDraft", "publish"]);
    expect(panelFooterActions("draft", false)).toEqual([
      "saveDraft",
      "publish",
      "delete",
    ]);
    expect(panelFooterActions("archived", false)).toEqual([
      "saveDraft",
      "publish",
      "delete",
    ]);
    expect(panelFooterActions("published", false)).toEqual([
      "saveChanges",
      "hide",
      "delete",
    ]);
  });
});

describe("toBenefitFormValues", () => {
  it("keeps published on saveChanges", () => {
    expect(
      toBenefitFormValues(values({ status: "published" }), "saveChanges").status
    ).toBe("published");
  });

  it("maps hide, publish and saveDraft", () => {
    expect(toBenefitFormValues(values(), "hide").status).toBe("archived");
    expect(toBenefitFormValues(values(), "publish").status).toBe("published");
    expect(
      toBenefitFormValues(values({ status: "published" }), "saveDraft").status
    ).toBe("draft");
  });

  it("nulls dates when timing is always", () => {
    const out = toBenefitFormValues(
      values({ endDate: "2026-12-01", startDate: "2026-11-01" }),
      "publish"
    );
    expect(out.publish_start).toBeNull();
    expect(out.publish_end).toBeNull();
  });

  it("sends dates for range timing and nulls blanks", () => {
    const out = toBenefitFormValues(
      values({ endDate: "", startDate: "2026-11-01", timing: "range" }),
      "publish"
    );
    expect(out.publish_start).toBe("2026-11-01");
    expect(out.publish_end).toBeNull();
    expect(out.description_nb).toBeNull();
  });

  it("sends redemption_value only for code and link", () => {
    expect(
      toBenefitFormValues(
        values({ redemptionType: "onsite", redemptionValue: "x" }),
        "publish"
      ).redemption_value
    ).toBeNull();
    expect(
      toBenefitFormValues(
        values({ redemptionType: "code", redemptionValue: "ABC" }),
        "publish"
      ).redemption_value
    ).toBe("ABC");
  });
});

describe("validatePanel", () => {
  it("requires a title", () => {
    expect(validatePanel(values({ titleNb: "" }), "publish").titleNb).toBe(
      "titleRequired"
    );
  });

  it("requires a code or link", () => {
    expect(
      validatePanel(values({ redemptionType: "code" }), "publish")
        .redemptionValue
    ).toBe("codeRequired");
    expect(
      validatePanel(values({ redemptionType: "link" }), "publish")
        .redemptionValue
    ).toBe("linkRequired");
  });

  it("rejects non-https links", () => {
    expect(
      validatePanel(
        values({ redemptionType: "link", redemptionValue: "http://x.no" }),
        "publish"
      ).redemptionValue
    ).toBe("linkInvalid");
  });

  it("skips redemption checks outside member sections", () => {
    expect(
      validatePanel(
        { ...values({ redemptionType: "code" }), section: "career" },
        "publish"
      )
    ).toEqual({});
  });

  it("rejects an end before the start", () => {
    expect(
      validatePanel(
        values({
          endDate: "2026-10-01",
          startDate: "2026-11-01",
          timing: "range",
        }),
        "publish"
      ).endDate
    ).toBe("endBeforeStart");
  });

  it("skips validation for hide", () => {
    expect(validatePanel(values({ titleNb: "" }), "hide")).toEqual({});
  });
});

const base: BenefitEditData = {
  $createdAt: "2026-01-01T00:00:00Z",
  $id: "b1",
  campus_id: "2",
  category: null,
  description_en: null,
  description_nb: null,
  editable: true,
  image_url: null,
  is_featured: false,
  partner_id: null,
  publish_end: "2026-11-10T22:59:59Z",
  publish_start: null,
  redemption_type: "code",
  redemption_value: "ABC",
  section: "member",
  sort_order: 0,
  status: "published",
  terms_en: null,
  terms_nb: null,
  title_en: "",
  title_nb: "Tittel",
};

describe("panelValuesFromBenefit", () => {
  it("maps a ranged row with the Oslo end date", () => {
    const out = panelValuesFromBenefit(base);
    expect(out.timing).toBe("range");
    expect(out.endDate).toBe("2026-11-10");
    expect(out.redemptionValue).toBe("ABC");
  });

  it("maps a legacy type without a value to none and null section to member", () => {
    const out = panelValuesFromBenefit({
      ...base,
      redemption_type: "qr",
      redemption_value: null,
      section: null as unknown as string,
    });
    expect(out.redemptionType).toBe("none");
    expect(out.section).toBe("member");
  });

  it("maps a legacy category onto the shared list", () => {
    expect(
      panelValuesFromBenefit({ ...base, category: "health" }).category
    ).toBe("health_fitness");
    expect(
      panelValuesFromBenefit({ ...base, category: "" }).category
    ).toBeNull();
  });

  it("opens an old formatted description as plain text", () => {
    const out = panelValuesFromBenefit({
      ...base,
      description_nb:
        "<p>Rabatt på alt</p><p>Gjelder&nbsp;klipp &amp; kort</p>",
    });
    expect(out.descriptionNb).toBe("Rabatt på alt\n\nGjelder klipp & kort");
  });

  it("keeps a legacy redemption type's value as a code or a link", () => {
    // Mapping it to "none" made the next save delete the stored value.
    expect(
      panelValuesFromBenefit({
        ...base,
        redemption_type: "qr",
        redemption_value: "https://partner.no/biso",
      }).redemptionType
    ).toBe("link");
    expect(
      panelValuesFromBenefit({
        ...base,
        redemption_type: "qr",
        redemption_value: "BISO-QR-123",
      }).redemptionType
    ).toBe("code");
    expect(
      panelValuesFromBenefit({
        ...base,
        redemption_type: "qr",
        redemption_value: "  ",
      }).redemptionType
    ).toBe("none");
  });
});

const STORED_HTML =
  '<h3>Slik gjør du</h3><p>Vis medlemskortet i kassa.</p><ul><li>Hverdager</li><li>Helg</li></ul><figure data-media-kind="image" data-url="https://cdn.biso.no/a.png" data-caption="Lokalet"><img src="https://cdn.biso.no/a.png" alt="" /><figcaption>Lokalet</figcaption></figure><figure data-media-kind="image" data-url="https://cdn.biso.no/b.png"><img src="https://cdn.biso.no/b.png" alt="" /></figure>';

describe("editableDescription", () => {
  it("keeps plain text as it is", () => {
    expect(editableDescription("Rabatt <3 på alt\nogså i helgen")).toBe(
      "Rabatt <3 på alt\nogså i helgen"
    );
    expect(editableDescription("[Nyhet] 20 %")).toBe("[Nyhet] 20 %");
    expect(editableDescription(null)).toBe("");
  });

  it("reads headings, paragraphs, list items and captions as lines", () => {
    expect(editableDescription(STORED_HTML)).toBe(
      "Slik gjør du\n\nVis medlemskortet i kassa.\n\n• Hverdager\n• Helg\n\nLokalet"
    );
  });

  it("reads the old Plate editor's JSON", () => {
    expect(
      editableDescription(
        JSON.stringify([
          { children: [{ text: "Første" }], type: "p" },
          { children: [{ text: "Andre" }], type: "p" },
        ])
      )
    ).toBe("Første\n\nAndre");
  });

  it("treats markup with no words as empty", () => {
    expect(editableDescription("<p>&nbsp;</p>")).toBe("");
  });
});

describe("toBenefitFormValues and stored descriptions", () => {
  const opened = panelValuesFromBenefit({
    ...base,
    description_en: "<p>Show the card.</p>",
    description_nb: STORED_HTML,
  });

  it("sends an untouched description back exactly as stored", () => {
    const out = toBenefitFormValues(opened, "saveChanges");
    expect(out.description_nb).toBe(STORED_HTML);
    expect(out.description_en).toBe("<p>Show the card.</p>");
  });

  it("sends plain text for the language that was edited", () => {
    const out = toBenefitFormValues(
      { ...opened, descriptionNb: "Ny tekst\nlinje to" },
      "saveChanges"
    );
    expect(out.description_nb).toBe("Ny tekst\nlinje to");
    expect(out.description_en).toBe("<p>Show the card.</p>");
  });

  it("clears a description that was emptied", () => {
    expect(
      toBenefitFormValues({ ...opened, descriptionNb: "  " }, "saveChanges")
        .description_nb
    ).toBeNull();
  });
});

describe("withPresetPartner", () => {
  const partners = [{ id: "loft" }, { id: "dogtails" }];

  it("picks a partner the panel can offer", () => {
    expect(withPresetPartner(values(), "dogtails", partners).partnerId).toBe(
      "dogtails"
    );
  });

  it("ignores an unknown partner or a section without partners", () => {
    expect(
      withPresetPartner(values(), "elsewhere", partners).partnerId
    ).toBeNull();
    expect(
      withPresetPartner(values(), undefined, partners).partnerId
    ).toBeNull();
    expect(
      withPresetPartner({ ...values(), section: "career" }, "loft", partners)
        .partnerId
    ).toBeNull();
  });
});

describe("isPanelDirty", () => {
  it("is clean until a value changes", () => {
    const initial = values();
    expect(isPanelDirty({ ...initial }, initial)).toBe(false);
    expect(isPanelDirty({ ...initial, titleNb: "Ny" }, initial)).toBe(true);
    expect(isPanelDirty({ ...initial, isFeatured: true }, initial)).toBe(true);
  });
});

describe("panelKey", () => {
  const fresh = { campusId: "2", openId: "new" };

  it("keys an existing benefit by its id", () => {
    expect(panelKey({ ...fresh, openId: "b1", newSection: "career" })).toBe(
      "b1"
    );
  });

  it("gives each new-benefit URL its own key", () => {
    const keys = [
      panelKey(fresh),
      panelKey({ ...fresh, newSection: "career" }),
      panelKey({ ...fresh, newPartnerId: "loft" }),
      panelKey({ ...fresh, newPartnerId: "dogtails" }),
      panelKey({ ...fresh, campusId: "3" }),
    ];
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) {
      expect(key).not.toBe("new");
    }
  });

  it("keeps the key for the same URL, reading an unknown section as member", () => {
    expect(panelKey({ ...fresh, newSection: "career" })).toBe(
      panelKey({ ...fresh, newSection: "career" })
    );
    expect(panelKey({ ...fresh, newSection: "nonsense" })).toBe(
      panelKey({ ...fresh, newSection: "member" })
    );
  });
});

import { describe, expect, it } from "vitest";
import { benefitCategoryLabel, benefitDescriptionText } from "./benefit-text";

describe("benefitCategoryLabel", () => {
  it("labels a studio category in the visitor's language", () => {
    expect(benefitCategoryLabel("food_drink", "no")).toBe("Mat og drikke");
    expect(benefitCategoryLabel("food_drink", "en")).toBe("Food & drink");
    expect(benefitCategoryLabel("other", "no")).toBe("Annet");
  });

  it("shows a legacy category as stored", () => {
    expect(benefitCategoryLabel("Food & Drink", "no")).toBe("Food & Drink");
  });

  it("is empty when the row has no category", () => {
    expect(benefitCategoryLabel(null, "en")).toBe("");
    expect(benefitCategoryLabel(undefined, "no")).toBe("");
  });
});

describe("benefitDescriptionText", () => {
  it("flattens a migrated HTML description to its text", () => {
    expect(
      benefitDescriptionText(
        "<p>Som BISO-medlem får du redusert pris &amp; plass.</p><p>Gjelder hele uka.</p>"
      )
    ).toBe("Som BISO-medlem får du redusert pris & plass. Gjelder hele uka.");
  });

  it("flattens Plate JSON to its text", () => {
    expect(
      benefitDescriptionText(
        '[{"type":"p","children":[{"text":"Vis medlemskortet."}]}]'
      )
    ).toBe("Vis medlemskortet.");
  });

  it("keeps the line breaks of a studio plain-text description", () => {
    expect(benefitDescriptionText("  Vis kortet.\nKun hverdager.  ")).toBe(
      "Vis kortet.\nKun hverdager."
    );
  });

  it("is empty for an empty description", () => {
    expect(benefitDescriptionText("")).toBe("");
  });
});

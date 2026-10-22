import { describe, expect, test } from "bun:test";
import { describeBenefitSaveError } from "./benefit-save-error";

const FIELD_LABELS = {
  image_url: "Bilde",
  title_nb: "Hva er tilbudet?",
};

describe("describeBenefitSaveError", () => {
  test("names the field that failed and why", () => {
    expect(
      describeBenefitSaveError({ image_url: ["Invalid URL"] }, FIELD_LABELS)
    ).toBe("Bilde: Invalid URL");
  });

  test("lists every failing field", () => {
    expect(
      describeBenefitSaveError(
        {
          image_url: ["Invalid URL"],
          title_nb: ["Add a title in Norwegian or English"],
        },
        FIELD_LABELS
      )
    ).toBe(
      "Bilde: Invalid URL. Hva er tilbudet?: Add a title in Norwegian or English"
    );
  });

  test("falls back to the field key when it has no label", () => {
    expect(
      describeBenefitSaveError({ category: ["Invalid"] }, FIELD_LABELS)
    ).toBe("category: Invalid");
  });

  test("passes the server's reason through", () => {
    expect(describeBenefitSaveError("Partner not found", FIELD_LABELS)).toBe(
      "Partner not found"
    );
  });

  test("has nothing to add when there is no detail", () => {
    expect(describeBenefitSaveError({}, FIELD_LABELS)).toBeNull();
    expect(describeBenefitSaveError("", FIELD_LABELS)).toBeNull();
    expect(
      describeBenefitSaveError({ title_nb: undefined }, FIELD_LABELS)
    ).toBeNull();
  });
});

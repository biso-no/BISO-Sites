import { describe, expect, test } from "bun:test";
import {
  describeBenefitSaveError,
  settleBenefitSave,
} from "./benefit-save-error";

const FALLBACK = "Could not save benefit";
const FIELD_LABELS = { image_url: "Image", title_nb: "Title (Norwegian)" };

describe("describeBenefitSaveError", () => {
  test("names the field that failed validation and why", () => {
    expect(
      describeBenefitSaveError(
        { image_url: ["Invalid URL"] },
        FALLBACK,
        FIELD_LABELS
      )
    ).toBe("Could not save benefit: Image: Invalid URL");
  });

  test("lists every failing field", () => {
    expect(
      describeBenefitSaveError(
        {
          image_url: ["Invalid URL"],
          title_nb: ["Add a title in Norwegian or English"],
        },
        FALLBACK,
        FIELD_LABELS
      )
    ).toBe(
      "Could not save benefit: Image: Invalid URL. Title (Norwegian): Add a title in Norwegian or English"
    );
  });

  test("falls back to the field key when it has no label", () => {
    expect(
      describeBenefitSaveError(
        { category: ["Category is required"] },
        FALLBACK,
        FIELD_LABELS
      )
    ).toBe("Could not save benefit: category: Category is required");
  });

  test("passes the server's reason through", () => {
    expect(
      describeBenefitSaveError(
        "You do not have access to this campus",
        FALLBACK,
        FIELD_LABELS
      )
    ).toBe("Could not save benefit: You do not have access to this campus");
  });

  test("uses the generic message when there is no detail", () => {
    expect(describeBenefitSaveError({}, FALLBACK, FIELD_LABELS)).toBe(FALLBACK);
    expect(describeBenefitSaveError("", FALLBACK, FIELD_LABELS)).toBe(FALLBACK);
    expect(
      describeBenefitSaveError({ title_nb: undefined }, FALLBACK, FIELD_LABELS)
    ).toBe(FALLBACK);
  });
});

describe("settleBenefitSave", () => {
  test("passes a completed save through untouched", async () => {
    expect(
      await settleBenefitSave(() => Promise.resolve({ data: "benefit-1" }))
    ).toEqual({ data: "benefit-1" });
  });

  test("turns a save that never completed into an error the editor is told about", async () => {
    // A server action that throws (expired session, lost connection) rejects
    // the call instead of returning `{ error }`, and nothing was shown at all.
    const result = await settleBenefitSave(() =>
      Promise.reject(new Error("fetch failed"))
    );

    expect(result).toEqual({
      error:
        "The request did not complete. Check your connection and try again.",
    });
  });
});

import { describe, expect, test } from "bun:test";
import { loadMessages } from "@repo/i18n/messages";
import {
  type BenefitErrorKey,
  benefitErrorKeys,
  describeBenefitSaveError,
} from "./benefit-save-error";

const LEGACY =
  "This benefit uses an old redemption type. Open it in the editor and choose how students redeem it.";

const no = await loadMessages("no");
const en = await loadMessages("en");

function bundleText(
  messages: Record<string, unknown>,
  key: BenefitErrorKey
): unknown {
  let node: unknown = messages;
  for (const part of ["adminPortal", "benefits", ...key.split(".")]) {
    node = (node as Record<string, unknown> | undefined)?.[part];
  }
  return node;
}

const norwegian = (key: BenefitErrorKey): string => {
  const text = bundleText(no, key);
  if (typeof text !== "string") {
    throw new Error(`Missing message: ${key}`);
  }
  return text;
};

describe("benefitErrorKeys", () => {
  const serverReasons: [string, BenefitErrorKey][] = [
    ["Unauthorized: no write access to this campus", "errors.noCampusAccess"],
    ["Partner not found", "errors.partnerNotFound"],
    ["Logo not found", "errors.logoNotFound"],
    [LEGACY, "errors.legacyRedemption"],
    ["Benefit not found", "errors.benefitNotFound"],
    ["Reorder list is out of date", "board.reorderFailed"],
    ["Add the partner's name", "errors.partnerNameRequired"],
    ["The website must start with https://", "errors.partnerWebsiteInvalid"],
    ["The logo must be an https:// address", "errors.partnerLogoInvalid"],
  ];
  for (const [reason, key] of serverReasons) {
    test(`"${reason}" reads as ${key}`, () => {
      expect(benefitErrorKeys(reason)).toEqual([key]);
    });
  }

  const fieldErrors: [string, string, BenefitErrorKey][] = [
    ["title_nb", "Add a title in Norwegian or English", "errors.titleRequired"],
    ["redemption_value", "Add the code", "errors.codeRequired"],
    ["redemption_value", "Add the link", "errors.linkRequired"],
    [
      "redemption_value",
      "The link must start with https://",
      "errors.linkInvalid",
    ],
    ["image_url", "Invalid URL", "errors.imageInvalid"],
    [
      "publish_end",
      "The end date must be on or after the start date",
      "errors.endBeforeStart",
    ],
  ];
  for (const [field, message, key] of fieldErrors) {
    test(`${field} "${message}" reads as ${key}`, () => {
      expect(benefitErrorKeys({ [field]: [message] })).toEqual([key]);
    });
  }

  test("lists each failing field once", () => {
    expect(
      benefitErrorKeys({
        image_url: ["Invalid URL", "Too big"],
        publish_end: ["The end date must be on or after the start date"],
        title_nb: ["Add a title in Norwegian or English"],
      })
    ).toEqual([
      "errors.imageInvalid",
      "errors.endBeforeStart",
      "errors.titleRequired",
    ]);
  });

  test("leaves out reasons it does not know", () => {
    expect(benefitErrorKeys("Failed to save benefit")).toEqual([]);
    expect(benefitErrorKeys("AppwriteException: Server Error")).toEqual([]);
    expect(
      benefitErrorKeys({
        description_nb: ["Too big: expected string to have <=2000 characters"],
        title_nb: ["Too big: expected string to have <=200 characters"],
      })
    ).toEqual([]);
    expect(benefitErrorKeys("")).toEqual([]);
    expect(benefitErrorKeys({ title_nb: undefined })).toEqual([]);
  });
});

describe("describeBenefitSaveError", () => {
  test("names a known reason in Norwegian", () => {
    expect(describeBenefitSaveError("Partner not found", norwegian)).toBe(
      "Fant ikke partneren. Velg partneren på nytt."
    );
    expect(
      describeBenefitSaveError(
        "Unauthorized: no write access to this campus",
        norwegian
      )
    ).toBe("Du har ikke tilgang til å endre fordeler for denne campusen.");
    expect(describeBenefitSaveError(LEGACY, norwegian)).toBe(
      "Velg hvordan studentene får rabatten, og lagre på nytt."
    );
    expect(describeBenefitSaveError("Benefit not found", norwegian)).toBe(
      "Fant ikke fordelen. Den kan være slettet."
    );
    expect(describeBenefitSaveError("Logo not found", norwegian)).toBe(
      "Fant ikke logoen. Den kan være fjernet."
    );
    expect(
      describeBenefitSaveError("Reorder list is out of date", norwegian)
    ).toBe("Kunne ikke lagre rekkefølgen. Prøv igjen.");
  });

  test("joins every failing field's message", () => {
    expect(
      describeBenefitSaveError(
        {
          image_url: ["Invalid URL"],
          title_nb: ["Add a title in Norwegian or English"],
        },
        norwegian
      )
    ).toBe("Bildet må være en https-adresse. Skriv hva tilbudet er.");
  });

  test("partner reasons read in Norwegian", () => {
    expect(describeBenefitSaveError("Add the partner's name", norwegian)).toBe(
      "Skriv inn navnet på partneren."
    );
    expect(
      describeBenefitSaveError(
        "The website must start with https://",
        norwegian
      )
    ).toBe("Nettsiden må starte med https://");
    expect(
      describeBenefitSaveError(
        "The logo must be an https:// address",
        norwegian
      )
    ).toBe("Logoen må være en https-adresse.");
  });

  test("has nothing to add for an unknown reason", () => {
    expect(
      describeBenefitSaveError("Failed to save benefit", norwegian)
    ).toBeNull();
    expect(
      describeBenefitSaveError({ category: ["Invalid option"] }, norwegian)
    ).toBeNull();
    expect(describeBenefitSaveError({}, norwegian)).toBeNull();
  });

  test("every key has a Norwegian and an English message", () => {
    const keys: BenefitErrorKey[] = [
      "board.reorderFailed",
      "errors.benefitNotFound",
      "errors.codeRequired",
      "errors.endBeforeStart",
      "errors.imageInvalid",
      "errors.legacyRedemption",
      "errors.linkInvalid",
      "errors.linkRequired",
      "errors.logoNotFound",
      "errors.noCampusAccess",
      "errors.partnerLogoInvalid",
      "errors.partnerNameRequired",
      "errors.partnerNotFound",
      "errors.partnerWebsiteInvalid",
      "errors.titleRequired",
    ];
    for (const key of keys) {
      expect(typeof bundleText(no, key)).toBe("string");
      expect(typeof bundleText(en, key)).toBe("string");
    }
    expect(bundleText(en, "errors.noCampusAccess")).toBe(
      "You don't have access to change benefits for this campus."
    );
    expect(bundleText(en, "errors.imageInvalid")).toBe(
      "The image must be an https address."
    );
    expect(bundleText(en, "errors.logoNotFound")).toBe(
      "We couldn't find this logo. It may have been removed."
    );
  });
});

import { describe, expect, test } from "bun:test";
import type { PartnerWithDeals } from "../../../_actions/benefit-partners";
import {
  isPartnerFormDirty,
  normalizeWebsite,
  partnerFormValues,
  toPartnerInput,
  validatePartnerForm,
  websiteHost,
} from "./partner-form";

const stored: PartnerWithDeals = {
  campus_id: "2",
  deals: [],
  description_en: "Coffee",
  description_nb: "Kaffe",
  editable: true,
  id: "p1",
  is_active: true,
  logo_url: "https://cdn.example/logo.png",
  name: "Kaffebar",
  website_url: "https://kaffebar.no",
};

describe("partnerFormValues", () => {
  test("a stored partner fills every field", () => {
    expect(partnerFormValues(stored, "1")).toEqual({
      campusId: "2",
      descriptionEn: "Coffee",
      descriptionNb: "Kaffe",
      logoUrl: "https://cdn.example/logo.png",
      name: "Kaffebar",
      website: "https://kaffebar.no",
    });
  });

  test("a new partner starts empty on the given campus", () => {
    expect(partnerFormValues(null, "3")).toEqual({
      campusId: "3",
      descriptionEn: "",
      descriptionNb: "",
      logoUrl: null,
      name: "",
      website: "",
    });
  });
});

describe("isPartnerFormDirty", () => {
  test("is false until something changes", () => {
    const initial = partnerFormValues(stored, "1");
    expect(isPartnerFormDirty(initial, initial)).toBe(false);
    expect(isPartnerFormDirty({ ...initial, name: "Kaffe" }, initial)).toBe(
      true
    );
    expect(isPartnerFormDirty({ ...initial, logoUrl: null }, initial)).toBe(
      true
    );
  });
});

describe("normalizeWebsite", () => {
  test("adds https:// to a bare address", () => {
    expect(normalizeWebsite(" kaffebar.no ")).toBe("https://kaffebar.no");
  });

  test("keeps an address that names its protocol", () => {
    expect(normalizeWebsite("https://kaffebar.no")).toBe("https://kaffebar.no");
    expect(normalizeWebsite("http://kaffebar.no")).toBe("http://kaffebar.no");
  });

  test("leaves a blank field blank", () => {
    expect(normalizeWebsite("   ")).toBe("");
  });
});

describe("validatePartnerForm", () => {
  const values = partnerFormValues(stored, "1");

  test("a complete form has no errors", () => {
    expect(validatePartnerForm(values)).toEqual({});
  });

  test("asks for a name", () => {
    expect(validatePartnerForm({ ...values, name: "  " })).toEqual({
      name: "partnerNameRequired",
    });
  });

  test("refuses a website that is not https", () => {
    expect(
      validatePartnerForm({ ...values, website: "http://kaffebar.no" })
    ).toEqual({ website: "partnerWebsiteInvalid" });
    expect(validatePartnerForm({ ...values, website: "kaffebar.no" })).toEqual(
      {}
    );
    expect(validatePartnerForm({ ...values, website: "" })).toEqual({});
  });
});

describe("toPartnerInput", () => {
  test("trims, adds https and sends blanks as cleared", () => {
    expect(
      toPartnerInput({
        campusId: "5",
        descriptionEn: "  ",
        descriptionNb: " Kaffe ",
        logoUrl: null,
        name: " Kaffebar ",
        website: "kaffebar.no",
      })
    ).toEqual({
      campus_id: "5",
      description_en: null,
      description_nb: "Kaffe",
      logo_url: null,
      name: "Kaffebar",
      website_url: "https://kaffebar.no",
    });
  });
});

describe("websiteHost", () => {
  test("shows the host without www", () => {
    expect(websiteHost("https://www.loftstudios.no/om-oss")).toBe(
      "loftstudios.no"
    );
  });

  test("is null without a usable address", () => {
    expect(websiteHost(null)).toBeNull();
    expect(websiteHost("not a url")).toBeNull();
  });
});

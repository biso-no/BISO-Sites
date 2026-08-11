import { describe, expect, test } from "bun:test";
import {
  announcementSchema,
  benefitSchema,
  documentMetadataSchema,
  eventSchema,
  jobSchema,
  productSchema,
} from "./schemas";

const eventBase = {
  campus_id: "campus-oslo",
  slug: "student-event",
  status: "draft" as const,
};

const jobBase = {
  campus_id: "campus-oslo",
  slug: "board-position",
  status: "draft" as const,
};

describe("source-aware bilingual content schemas", () => {
  test("accepts a Norwegian-only or English-only event", () => {
    expect(
      eventSchema.safeParse({
        ...eventBase,
        description_en: "",
        description_no: "Norsk beskrivelse",
        title_en: "",
        title_no: "Norsk arrangement",
      }).success
    ).toBeTrue();
    expect(
      eventSchema.safeParse({
        ...eventBase,
        description_en: "English description",
        description_no: "",
        title_en: "English event",
        title_no: "",
      }).success
    ).toBeTrue();
  });

  test("accepts a Norwegian-only or English-only vacancy", () => {
    expect(
      jobSchema.safeParse({
        ...jobBase,
        description_en: "",
        description_no: "Norsk beskrivelse",
        title_en: "",
        title_no: "Norsk stilling",
      }).success
    ).toBeTrue();
    expect(
      jobSchema.safeParse({
        ...jobBase,
        description_en: "English description",
        description_no: "",
        title_en: "English role",
        title_no: "",
      }).success
    ).toBeTrue();
  });

  test("accepts one complete locale for benefits", () => {
    const base = {
      campus_id: "campus-oslo",
      category: "discount",
      kind: "offer" as const,
      redemption_type: "none" as const,
      status: "draft" as const,
    };

    expect(
      benefitSchema.safeParse({
        ...base,
        description_en: "",
        description_nb: "Norsk beskrivelse",
        title_en: "",
        title_nb: "Norsk fordel",
      }).success
    ).toBeTrue();
    expect(
      benefitSchema.safeParse({
        ...base,
        description_en: "English description",
        description_nb: "",
        title_en: "English benefit",
        title_nb: "",
      }).success
    ).toBeTrue();
  });

  test("benefits carry an optional department ownership id", () => {
    const base = {
      campus_id: "campus-oslo",
      category: "discount",
      description_en: "",
      description_nb: "Norsk beskrivelse",
      kind: "offer" as const,
      redemption_type: "none" as const,
      status: "draft" as const,
      title_en: "",
      title_nb: "Norsk fordel",
    };

    expect(
      benefitSchema.parse({ ...base, department_id: "dept-1" }).department_id
    ).toBe("dept-1");
    expect(benefitSchema.parse(base).department_id).toBeUndefined();
    expect(
      benefitSchema.parse({ ...base, department_id: null }).department_id
    ).toBeNull();
  });

  test("documents carry an optional department ownership id", () => {
    const base = {
      category: "campus-bylaws" as const,
      language: "no" as const,
      scope: "campus" as const,
      status: "draft" as const,
      title: "Vedtekter",
    };

    expect(
      documentMetadataSchema.parse({ ...base, department_id: "dept-1" })
        .department_id
    ).toBe("dept-1");
    expect(documentMetadataSchema.parse(base).department_id).toBeUndefined();
  });

  test("announcements carry an optional department ownership id", () => {
    const base = {
      title_en: "English title",
    };

    expect(
      announcementSchema.parse({ ...base, department_id: "dept-1" })
        .department_id
    ).toBe("dept-1");
    expect(announcementSchema.parse(base).department_id).toBeUndefined();
  });

  test("accepts one named locale for products", () => {
    const base = {
      campus_id: "campus-oslo",
      regular_price: 100,
      slug: "student-product",
      status: "draft" as const,
    };

    expect(
      productSchema.safeParse({ ...base, name: "Norsk", name_en: "" }).success
    ).toBeTrue();
    expect(
      productSchema.safeParse({ ...base, name: "", name_en: "English" }).success
    ).toBeTrue();
  });

  test("accepts one titled locale for announcements", () => {
    expect(
      announcementSchema.safeParse({
        body_en: "",
        body_no: "Norsk melding",
        title_en: "",
        title_no: "Norsk tittel",
      }).success
    ).toBeTrue();
    expect(
      announcementSchema.safeParse({
        body_en: "English message",
        body_no: "",
        title_en: "English title",
        title_no: "",
      }).success
    ).toBeTrue();
  });

  test("rejects content with no usable locale", () => {
    expect(
      eventSchema.safeParse({
        ...eventBase,
        description_en: "",
        description_no: "",
        title_en: "",
        title_no: "",
      }).success
    ).toBeFalse();
    expect(
      jobSchema.safeParse({
        ...jobBase,
        description_en: "",
        description_no: "",
        title_en: "",
        title_no: "",
      }).success
    ).toBeFalse();
    expect(
      productSchema.safeParse({
        campus_id: "campus-oslo",
        name: "",
        name_en: "",
        regular_price: 0,
        slug: "empty-product",
        status: "draft",
      }).success
    ).toBeFalse();
    expect(
      announcementSchema.safeParse({ title_en: "", title_no: "" }).success
    ).toBeFalse();
  });
});

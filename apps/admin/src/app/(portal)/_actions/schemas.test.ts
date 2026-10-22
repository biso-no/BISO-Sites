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

const benefitBase = {
  campus_id: "1",
  status: "draft" as const,
  title_en: "",
  title_nb: "Norsk fordel",
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

  test("accepts a member benefit with a title only", () => {
    const parsed = benefitSchema.safeParse(benefitBase);
    expect(parsed.success).toBeTrue();
    expect(parsed.data?.redemption_type).toBe("none");
    expect(parsed.data?.section).toBe("member");
  });

  test("rejects a benefit with no title in either language", () => {
    const parsed = benefitSchema.safeParse({
      ...benefitBase,
      title_nb: "  ",
    });
    expect(parsed.success).toBeFalse();
    expect(parsed.error?.issues[0]?.path).toEqual(["title_nb"]);
  });

  test("requires the code for a code benefit", () => {
    const parsed = benefitSchema.safeParse({
      ...benefitBase,
      redemption_type: "code",
      redemption_value: " ",
    });
    expect(parsed.success).toBeFalse();
    expect(parsed.error?.issues[0]?.message).toBe("Add the code");
  });

  test("link benefits need an https link", () => {
    const link = { ...benefitBase, redemption_type: "link" };
    expect(
      benefitSchema.safeParse({ ...link, redemption_value: "http://x.no" })
        .success
    ).toBeFalse();
    expect(
      benefitSchema.safeParse({ ...link, redemption_value: "https://x.no" })
        .success
    ).toBeTrue();
    expect(
      benefitSchema.safeParse({ ...link, redemption_value: "" }).error
        ?.issues[0]?.message
    ).toBe("Add the link");
  });

  test("rejects an end date before the start date", () => {
    const parsed = benefitSchema.safeParse({
      ...benefitBase,
      publish_end: "2026-08-01",
      publish_start: "2026-08-10",
    });
    expect(parsed.success).toBeFalse();
    expect(parsed.error?.issues[0]?.path).toEqual(["publish_end"]);
  });

  test("rejects qr redemption and unknown campuses", () => {
    expect(
      benefitSchema.safeParse({ ...benefitBase, redemption_type: "qr" }).success
    ).toBeFalse();
    expect(
      benefitSchema.safeParse({ ...benefitBase, campus_id: "6" }).success
    ).toBeFalse();
  });

  test("accepts a career line with only a Norwegian title", () => {
    expect(
      benefitSchema.safeParse({
        campus_id: "1",
        section: "career",
        status: "draft",
        title_en: "",
        title_nb: "Karrieredag",
      }).success
    ).toBeTrue();
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

describe("productSchema image normalization", () => {
  const base = {
    campus_id: "campus-oslo",
    name: "Genser",
    regular_price: 100,
    slug: "genser",
    status: "draft" as const,
  };

  const MEDIA_URL =
    "https://appwrite.biso.no/v1/storage/buckets/media/files/6a8564de0036f521c3a4/view?project=biso";

  test("expands a bare imported file ID into a media URL", () => {
    const parsed = productSchema.parse({
      ...base,
      image: "6a8564de0036f521c3a4",
    });

    expect(parsed.image).toBe(MEDIA_URL);
  });

  test("leaves an already-resolved URL untouched", () => {
    expect(productSchema.parse({ ...base, image: MEDIA_URL }).image).toBe(
      MEDIA_URL
    );
  });

  test("treats an empty image as absent", () => {
    expect(productSchema.parse({ ...base, image: "" }).image).toBeNull();
    expect(productSchema.parse(base).image).toBeUndefined();
  });

  test("normalizes every entry of the images gallery", () => {
    const parsed = productSchema.parse({
      ...base,
      images: ["6a8564de0036f521c3a4", MEDIA_URL],
    });

    expect(parsed.images).toEqual([MEDIA_URL, MEDIA_URL]);
  });

  test("still rejects a value that is neither a file ID nor a URL", () => {
    expect(
      productSchema.safeParse({ ...base, image: "not a url or id" }).success
    ).toBeFalse();
  });
});

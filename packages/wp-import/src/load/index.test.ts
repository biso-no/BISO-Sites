import { describe, expect, test } from "bun:test";
import { buildJobUpsert, buildTranslationRows } from "./index";

const job = {
  departmentConfidence: 1,
  departmentName: "Bergensbaneløpet",
  descriptionHtml: "<p>Tekst</p>",
  row: { campus_id: "1", slug: "pr-manager", status: "published" },
  rowId: "wpjob63903",
  shortDescription: "Tekst",
  sourceLocale: "no" as const,
  title: "PR Manager",
};

describe("buildTranslationRows", () => {
  test("creates a row for each locale with the source stored verbatim", () => {
    const rows = buildTranslationRows({
      contentId: "wpjob63903",
      contentType: "job",
      permissions: ['read("any")'],
      source: {
        description: "<p>Tekst</p>",
        locale: "no",
        shortDescription: "Tekst",
        title: "PR Manager",
      },
      target: {
        description: "<p>Text</p>",
        locale: "en",
        shortDescription: "Text",
        title: "PR Manager EN",
      },
    });

    expect(rows).toHaveLength(2);
    expect(rows[0]?.locale).toBe("no");
    expect(rows[0]?.title).toBe("PR Manager");
    expect(rows[1]?.locale).toBe("en");
  });

  test("stamps content_type and content_id on every row", () => {
    const rows = buildTranslationRows({
      contentId: "wpjob1",
      contentType: "job",
      permissions: [],
      source: {
        description: "<p>a</p>",
        locale: "no",
        shortDescription: null,
        title: "a",
      },
      target: null,
    });

    expect(rows[0]?.content_id).toBe("wpjob1");
    expect(rows[0]?.content_type).toBe("job");
  });

  test("omits the target row when translation was skipped", () => {
    const rows = buildTranslationRows({
      contentId: "wpjob1",
      contentType: "job",
      permissions: [],
      source: {
        description: "<p>a</p>",
        locale: "no",
        shortDescription: null,
        title: "a",
      },
      target: null,
    });

    expect(rows).toHaveLength(1);
  });
});

describe("buildJobUpsert", () => {
  test("includes every required column plus nested translations", () => {
    const payload = buildJobUpsert(job, [
      {
        $permissions: [],
        content_id: "wpjob63903",
        content_type: "job",
        description: "<p>Tekst</p>",
        locale: "no",
        short_description: null,
        title: "PR Manager",
      },
    ]);

    expect(payload.slug).toBe("pr-manager");
    expect(payload.status).toBe("published");
    expect(payload.campus_id).toBe("1");
    expect(Array.isArray(payload.translations)).toBe(true);
  });

  test("attaches permissions derived from status", () => {
    const payload = buildJobUpsert(job, []);

    expect(payload.$permissions).toContain('read("any")');
  });

  test("a closed job gets no public read permission", () => {
    const payload = buildJobUpsert(
      { ...job, row: { ...job.row, status: "closed" } },
      []
    );

    expect(payload.$permissions).not.toContain('read("any")');
  });
});

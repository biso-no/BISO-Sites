/**
 * What the generic content getter hands back.
 *
 * `content.get` lets a *published* row through without a campus check — right
 * for reading published content, wrong for the whole row. Two rules share the
 * job, and they are not interchangeable:
 *
 * - `SENSITIVE_COLUMNS` is a denylist, applied to the caller's OWN rows. A
 *   vacancy's screening rubric is inappropriate for model context even for the
 *   campus that owns it, because no tool here is meant to return it — the
 *   recruitment getter reports only `hasRubric`.
 * - The raw row is withheld entirely when *publication* rather than scope
 *   authorized the read. A denylist cannot carry that case: it only strips
 *   what someone thought to name, and an out-of-scope caller was getting every
 *   column nobody had thought to name — `auto_screen` here, and on other
 *   domains an event's join link or a product's ledger account.
 *
 * `jobs` is the sharp case for both: it grants table-level `read("any")`, so
 * Appwrite does not stop any of it either.
 */

import { describe, expect, test } from "bun:test";
import { CAMPUS_ADMIN, createFakeBackend, HR_MEMBER } from "../testing/index";
import { createContentService } from "./content";

const LINKS = {
  web: (path: string) => `https://biso.no${path}`,
  admin: (path: string) => `https://admin.biso.no${path}`,
};

function tables() {
  return {
    jobs: [
      {
        $id: "bergen-vacancy",
        $updatedAt: "2026-01-01T00:00:00.000Z",
        slug: "bergen-role",
        status: "published",
        campus_id: "2",
        department_id: "dept-b",
        application_deadline: null,
        screening_rubric: JSON.stringify({ weights: { motivation: 0.6 } }),
        interview_template: JSON.stringify({ questions: ["Why BISO?"] }),
        custom_questions: JSON.stringify([{ id: "q1", label: "Availability" }]),
        embedding_id: "emb-1",
        auto_screen: true,
        translations: [],
      },
    ],
  };
}

function service() {
  return createContentService(createFakeBackend({ tables: tables() }), LINKS);
}

describe("recruitment internals in the generic getter", () => {
  test("another campus's HR cannot read the screening rubric", async () => {
    // Oslo HR passes the recruitment gate — it is HR — and `isPublished` waves
    // the row past the campus check. Asserted over the WHOLE detail, not just
    // `raw`: withholding one field is not the property, the rubric never
    // reaching model context by any route is.
    const detail = await service().get(
      HR_MEMBER("Oslo", "1"),
      "jobs",
      "bergen-vacancy"
    );

    const serialised = JSON.stringify(detail);
    expect(serialised).not.toContain("screening_rubric");
    expect(serialised).not.toContain("interview_template");
    expect(serialised).not.toContain("custom_questions");
    expect(serialised).not.toContain("motivation");
    expect(serialised).not.toContain("Why BISO?");
  });

  test("the vacancy's own campus HR cannot read it either", async () => {
    // No tool in this package returns a rubric; the recruitment getter reports
    // `hasRubric`. Scope is not what makes it inappropriate.
    const detail = await service().get(
      HR_MEMBER("Bergen", "2"),
      "jobs",
      "bergen-vacancy"
    );

    expect(detail.raw).not.toHaveProperty("screening_rubric");
  });

  test("an out-of-scope reader gets the public columns and no raw row", async () => {
    // `auto_screen` is the point. It is not in any denylist and never will be:
    // it is one operational column among many that a denylist cannot
    // anticipate. Publication authorized this read, so the curated projection
    // is the answer and the row itself is not.
    const detail = await service().get(
      HR_MEMBER("Oslo", "1"),
      "jobs",
      "bergen-vacancy"
    );

    expect(detail.raw).toBeNull();
    expect(detail.fields).toHaveProperty("slug", "bergen-role");
    expect(detail.fields).not.toHaveProperty("auto_screen");
    expect(detail.status).toBe("published");
    expect(detail.warnings.join(" ")).toContain("outside your campus");
  });
});

/**
 * Who counts as the owner of a published row.
 *
 * Tested on `news`, where both principals are plainly legitimate staff and no
 * recruitment gate is in the way — the question is only whether the scope
 * engine says the row is theirs. (It never says so for HR on a vacancy: an HR
 * member holds `dept-hr`, not the vacancy's own department, and reaches
 * vacancies through the recruitment tools' scope instead. So for `jobs` the
 * generic getter withholds `raw` from HR too.)
 */
describe("the raw row follows ownership, not visibility", () => {
  function bergenNews() {
    return {
      news: [
        {
          $id: "bergen-story",
          $updatedAt: "2026-01-01T00:00:00.000Z",
          slug: "bergen-story",
          status: "published",
          campus_id: "2",
          department_id: "dept-b",
          internal_note: "not for other campuses",
          translation_refs: [],
        },
      ],
    };
  }

  function newsService() {
    return createContentService(
      createFakeBackend({ tables: bergenNews() }),
      LINKS
    );
  }

  test("the campus that owns it gets the raw row", async () => {
    const detail = await newsService().get(
      CAMPUS_ADMIN("Bergen", "2"),
      "news",
      "bergen-story"
    );

    expect(detail.raw).toHaveProperty("slug", "bergen-story");
    expect(detail.raw).toHaveProperty("internal_note");
    expect(detail.warnings).toHaveLength(0);
  });

  test("another campus reads it as published content only", async () => {
    // Oslo can see the story — it is published — but has no claim on the row,
    // so a column nobody thought to deny (`internal_note`) does not come back.
    const detail = await newsService().get(
      CAMPUS_ADMIN("Oslo", "1"),
      "news",
      "bergen-story"
    );

    expect(detail.raw).toBeNull();
    expect(JSON.stringify(detail)).not.toContain("not for other campuses");
    expect(detail.title ?? detail.slug).toBe("bergen-story");
  });
});

describe("translations in the content detail read", () => {
  function newsWithTranslations() {
    return {
      news: [
        {
          $id: "article",
          $updatedAt: "2026-01-01T00:00:00.000Z",
          slug: "welcome",
          status: "published",
          campus_id: "1",
          department_id: "dept-a",
          translation_refs: [
            {
              $id: "tr-no",
              locale: "no",
              title: "Velkomstuke",
              description: "Norsk tekst",
              short_description: "Norsk ingress",
            },
            {
              $id: "tr-en",
              locale: "en",
              title: "Welcome week",
              description: "English text",
              short_description: "English teaser",
            },
          ],
        },
      ],
    };
  }

  test("the detail read returns the translations it read", async () => {
    // `get` reads `row[spec.translations.relationship]`, so the query has to
    // name the relationship — every other detail reader in this repo does.
    const service = createContentService(
      createFakeBackend({ tables: newsWithTranslations() }),
      LINKS
    );
    const detail = await service.get(HR_MEMBER("Oslo", "1"), "news", "article");

    expect(detail.translations.map((item) => item.locale).sort()).toEqual([
      "en",
      "no",
    ]);
    expect(detail.title).toBe("Velkomstuke");
    expect(detail.locales.sort()).toEqual(["en", "no"]);
  });
});

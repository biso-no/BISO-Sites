/**
 * What the generic content getter hands back.
 *
 * `content.get` lets a *published* row through without a campus check — right
 * for reading published content, and the reason `raw` is load-bearing: anything
 * on a published row that must not cross a campus boundary has to be in
 * `SENSITIVE_COLUMNS`, because that check will not stop it.
 *
 * `jobs` is the sharp case. It grants table-level `read("any")`, so Appwrite
 * does not stop it either, and a vacancy's screening rubric, interview template
 * and application questions are how candidates get graded. The recruitment
 * getter deliberately reports only `hasRubric`.
 */

import { describe, expect, test } from "bun:test";
import { createFakeBackend, HR_MEMBER } from "../testing/index";
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
    // the row past the campus check. `raw` is the last thing standing.
    const detail = await service().get(
      HR_MEMBER("Oslo", "1"),
      "jobs",
      "bergen-vacancy"
    );

    expect(detail.raw).not.toHaveProperty("screening_rubric");
    expect(detail.raw).not.toHaveProperty("interview_template");
    expect(detail.raw).not.toHaveProperty("custom_questions");
    expect(JSON.stringify(detail.raw)).not.toContain("motivation");
    expect(JSON.stringify(detail.raw)).not.toContain("Why BISO?");
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

  test("the public columns still come back", async () => {
    const detail = await service().get(
      HR_MEMBER("Oslo", "1"),
      "jobs",
      "bergen-vacancy"
    );

    expect(detail.raw).toHaveProperty("slug", "bergen-role");
    expect(detail.raw).toHaveProperty("auto_screen", true);
    expect(detail.status).toBe("published");
  });
});

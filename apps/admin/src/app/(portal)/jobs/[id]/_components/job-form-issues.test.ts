import { describe, expect, it } from "bun:test";
import { JobsStatus } from "@repo/api/types/appwrite";
import { recruitmentVacancyUpsertSchema } from "@repo/shared/types/recruitment";
import { describeJobFormIssues } from "./job-form-issues";

const base = {
  campus_id: "campus-oslo",
  description_en: "<p>Body</p>",
  description_no: "",
  slug: "role",
  status: JobsStatus.DRAFT,
  title_en: "Role",
  title_no: "",
};

function issuesFor(values: Record<string, unknown>) {
  const result = recruitmentVacancyUpsertSchema.safeParse({
    ...base,
    ...values,
  });
  if (result.success) {
    throw new Error("expected validation to fail");
  }
  return describeJobFormIssues(result.error.issues);
}

describe("describeJobFormIssues", () => {
  it("points an over-long teaser at the essentials step and its locale", () => {
    const [issue] = issuesFor({ short_description_no: "x".repeat(281) });
    expect(issue).toMatchObject({
      field: "short_description_no",
      label: "One-line teaser (NO)",
      locale: "no",
      message: "Must be at most 280 characters",
      step: 0,
    });
  });

  it("points an invalid contact email at logistics", () => {
    const [issue] = issuesFor({ contact_email: "not-an-email" });
    expect(issue).toMatchObject({
      field: "contact_email",
      message: "Enter a valid email address",
      step: 2,
    });
  });

  it("does not force a locale for the one-complete-language rule", () => {
    const [issue] = issuesFor({ description_en: "", title_en: "" });
    expect(issue).toMatchObject({ field: "content", locale: null, step: 0 });
  });
});

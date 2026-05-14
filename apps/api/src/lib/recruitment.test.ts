import { JobApplicationStatus, JobStatus } from "@repo/api/types/appwrite";
import type { AdminScope } from "@repo/shared/types/user-management";
import { describe, expect, it } from "vitest";
import {
  assertRecruitmentApplicationTransition,
  computeRecruitmentRetentionUntil,
  isRecruitmentVacancyOpen,
  parseRecruitmentApplicationReviewMetadata,
  parseRecruitmentVacancyMetadata,
} from "../../../../packages/shared/types/recruitment";
import {
  canManageRecruitmentVacancy,
  canReviewRecruitmentVacancy,
  isAuthenticatedAppwriteUser,
  type RecruitmentLookups,
} from "./recruitment";

const lookupFixture: RecruitmentLookups = {
  campusIdsByName: new Map([
    ["Oslo", "campus-oslo"],
    ["Bergen", "campus-bergen"],
  ]),
  campusNamesById: new Map([
    ["campus-oslo", "Oslo"],
    ["campus-bergen", "Bergen"],
  ]),
  departmentIdsByName: new Map([
    ["Marketing", "dept-marketing"],
    ["Finance", "dept-finance"],
  ]),
  departmentNamesById: new Map([
    ["dept-marketing", "Marketing"],
    ["dept-finance", "Finance"],
  ]),
};

function buildScope(overrides: Partial<AdminScope> = {}): AdminScope {
  return {
    canManageAnyCampus: false,
    isCampusAdmin: false,
    isGlobalAdmin: false,
    managedCampusNames: ["Oslo"],
    managedDepartmentNames: ["Marketing"],
    userId: "admin-1",
    ...overrides,
  };
}

describe("recruitment domain helpers", () => {
  it("parses metadata and preserves new recruitment fields", () => {
    const metadata = parseRecruitmentVacancyMetadata(
      JSON.stringify({
        application_deadline: "2026-05-01T12:00:00.000Z",
        auto_translate: true,
        company: "BISO",
        commitment: "6 h/week",
        cover_image_file_id: "cover-1",
        cover_image_url: "https://example.com/cover.jpg",
        cover_pattern: 2,
        cv_required: true,
        location: "Campus Oslo",
        newsletter: true,
        paid: true,
        publication_mode: "scheduled",
        push_to_inboxes: true,
        scheduled_publish_at: "2026-04-20T10:00:00.000Z",
        tags: ["Volunteer", "Leadership"],
      })
    );

    expect(metadata.auto_translate).toBe(true);
    expect(metadata.company).toBe("BISO");
    expect(metadata.commitment).toBe("6 h/week");
    expect(metadata.cover_image_file_id).toBe("cover-1");
    expect(metadata.cover_image_url).toBe("https://example.com/cover.jpg");
    expect(metadata.cover_pattern).toBe(2);
    expect(metadata.cv_required).toBe(true);
    expect(metadata.location).toBe("Campus Oslo");
    expect(metadata.newsletter).toBe(true);
    expect(metadata.paid).toBe(true);
    expect(metadata.publication_mode).toBe("scheduled");
    expect(metadata.push_to_inboxes).toBe(true);
    expect(metadata.scheduled_publish_at).toBe("2026-04-20T10:00:00.000Z");
    expect(metadata.tags).toEqual(["Volunteer", "Leadership"]);
  });

  it("parses legacy metadata without design fields safely", () => {
    const metadata = parseRecruitmentVacancyMetadata(
      JSON.stringify({
        company: "BISO",
        paid: false,
      })
    );

    expect(metadata.company).toBe("BISO");
    expect(metadata.tags).toEqual([]);
    expect(metadata.push_to_inboxes).toBe(false);
    expect(metadata.newsletter).toBe(false);
    expect(metadata.commitment).toBeUndefined();
    expect(metadata.audience).toBeUndefined();
  });

  it("parses application review metadata with interview planning fields", () => {
    const metadata = parseRecruitmentApplicationReviewMetadata(
      JSON.stringify({
        assigned_hr_user_email: "hr@biso.no",
        assigned_hr_user_id: "user-hr",
        assigned_hr_user_name: "HR Member",
        candidate_availability: ["Monday 10:00", "Tuesday 14:00"],
        hr_availability: ["Monday 10:00"],
        interview_duration_minutes: 45,
        interview_location: "BI Oslo",
        interview_status: "scheduled",
        interview_starts_at: "2026-05-20T10:00:00.000Z",
        review_notes: "Strong candidate",
        score: 5,
      })
    );

    expect(metadata.assigned_hr_user_email).toBe("hr@biso.no");
    expect(metadata.candidate_availability).toEqual([
      "Monday 10:00",
      "Tuesday 14:00",
    ]);
    expect(metadata.hr_availability).toEqual(["Monday 10:00"]);
    expect(metadata.interview_status).toBe("scheduled");
    expect(metadata.score).toBe(5);
  });

  it("computes retention 180 days after the vacancy close date", () => {
    const retentionUntil = computeRecruitmentRetentionUntil(
      {
        application_deadline: "2026-05-01T00:00:00.000Z",
        auto_translate: false,
        company: "BISO",
        contact_email: null,
        contact_name: null,
        contact_role: null,
        cover_pattern: null,
        cv_required: false,
        employment_type: null,
        location: null,
        newsletter: false,
        paid: false,
        push_to_inboxes: false,
        short_description: null,
        start_date: null,
        tags: [],
        term: null,
      },
      new Date("2026-04-20T00:00:00.000Z")
    );

    expect(retentionUntil).toBe("2026-10-28T00:00:00.000Z");
  });

  it("allows only configured application status transitions", () => {
    expect(() =>
      assertRecruitmentApplicationTransition(
        JobApplicationStatus.SUBMITTED,
        JobApplicationStatus.REVIEWED
      )
    ).not.toThrow();

    expect(() =>
      assertRecruitmentApplicationTransition(
        JobApplicationStatus.ACCEPTED,
        JobApplicationStatus.REVIEWED
      )
    ).toThrow("Invalid application status transition");
  });

  it("treats published vacancies past deadline as closed", () => {
    expect(
      isRecruitmentVacancyOpen(
        JobStatus.PUBLISHED,
        {
          application_deadline: "2026-04-01T00:00:00.000Z",
          auto_translate: false,
          company: null,
          contact_email: null,
          contact_name: null,
          contact_role: null,
          cover_pattern: null,
          cv_required: false,
          employment_type: null,
          location: null,
          newsletter: false,
          paid: false,
          push_to_inboxes: false,
          short_description: null,
          start_date: null,
          tags: [],
          term: null,
        },
        new Date("2026-04-10T00:00:00.000Z")
      )
    ).toBe(false);
  });
});

describe("recruitment authorization helpers", () => {
  it("lets department admins manage vacancies in their scoped department", () => {
    expect(
      canManageRecruitmentVacancy(buildScope(), lookupFixture, {
        campus_id: "campus-oslo",
        department_id: "dept-marketing",
      })
    ).toBe(true);

    expect(
      canManageRecruitmentVacancy(buildScope(), lookupFixture, {
        campus_id: "campus-oslo",
        department_id: "dept-finance",
      })
    ).toBe(false);
  });

  it("lets campus admins and scoped department members review applications", () => {
    expect(
      canReviewRecruitmentVacancy(
        buildScope({ isCampusAdmin: true, managedDepartmentNames: [] }),
        lookupFixture,
        {
          campus_id: "campus-oslo",
          department_id: null,
        }
      )
    ).toBe(true);

    expect(
      canReviewRecruitmentVacancy(buildScope(), lookupFixture, {
        campus_id: "campus-oslo",
        department_id: "dept-marketing",
      })
    ).toBe(true);

    expect(
      canReviewRecruitmentVacancy(buildScope(), lookupFixture, {
        campus_id: "campus-oslo",
        department_id: "dept-finance",
      })
    ).toBe(false);
  });

  it("rejects anonymous-style Appwrite users for application submission", () => {
    const anonymousUser = {
      email: "",
      emailVerification: false,
      name: "guest_abc123",
    } as never;

    const authenticatedUser = {
      email: "candidate@example.com",
      emailVerification: true,
      name: "Candidate User",
    } as never;

    expect(isAuthenticatedAppwriteUser(anonymousUser)).toBe(false);
    expect(isAuthenticatedAppwriteUser(authenticatedUser)).toBe(true);
  });
});

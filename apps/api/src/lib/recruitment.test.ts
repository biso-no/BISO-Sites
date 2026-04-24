import { JobApplicationStatus, JobStatus } from "@repo/api/types/appwrite";
import type { AdminScope } from "@repo/shared/types/user-management";
import { describe, expect, it } from "vitest";
import {
  assertRecruitmentApplicationTransition,
  computeRecruitmentRetentionUntil,
  isRecruitmentVacancyOpen,
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
        company: "BISO",
        cv_required: true,
        location: "Campus Oslo",
        paid: true,
      })
    );

    expect(metadata.company).toBe("BISO");
    expect(metadata.cv_required).toBe(true);
    expect(metadata.location).toBe("Campus Oslo");
    expect(metadata.paid).toBe(true);
  });

  it("computes retention 180 days after the vacancy close date", () => {
    const retentionUntil = computeRecruitmentRetentionUntil(
      {
        application_deadline: "2026-05-01T00:00:00.000Z",
        company: "BISO",
        contact_email: null,
        contact_name: null,
        cv_required: false,
        employment_type: null,
        location: null,
        paid: false,
        short_description: null,
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
          company: null,
          contact_email: null,
          contact_name: null,
          cv_required: false,
          employment_type: null,
          location: null,
          paid: false,
          short_description: null,
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

  it("limits application review to campus and global admins", () => {
    expect(
      canReviewRecruitmentVacancy(
        buildScope({ isCampusAdmin: true, managedDepartmentNames: [] }),
        lookupFixture,
        {
          campus_id: "campus-oslo",
        }
      )
    ).toBe(true);

    expect(
      canReviewRecruitmentVacancy(buildScope(), lookupFixture, {
        campus_id: "campus-oslo",
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

/**
 * Recruitment scope is not content scope.
 *
 * `toRecruitmentAdminScope` gives HR every vacancy at its campuses with **no**
 * department narrowing, and HR together with National every campus. Content
 * scope is campus *and* department. The generic content path applied the
 * content rule to `jobs`, which both hid most of a campus HR user's vacancies
 * — they are owned by the departments that are hiring, not by HR — and, for
 * HR+National, nearly all of them.
 *
 * Two halves here: the generic path no longer serves vacancies at all, and the
 * one place that still has to read one reads it under the recruitment rule.
 */

import { describe, expect, test } from "bun:test";
import { createFakeBackend, HR_MEMBER, makePrincipal } from "../testing/index";
import {
  CONTENT_REGISTRY,
  supports,
  unsupportedReason,
} from "./content-registry";
import { createLookupService } from "./lookups";
import { createRecruitmentService } from "./recruitment";

describe("the generic content path does not serve vacancies", () => {
  test("neither search nor get is supported for jobs", () => {
    expect(supports("jobs", "search")).toBe(false);
    expect(supports("jobs", "get")).toBe(false);
  });

  test("and the refusal names the tool that applies the right rule", () => {
    expect(unsupportedReason("jobs", "search")).toContain(
      "biso_list_vacancies"
    );
    expect(unsupportedReason("jobs", "get")).toContain("biso_get_vacancy");
  });

  test("every other domain is unaffected", () => {
    for (const domain of ["news", "events", "benefits", "products"] as const) {
      expect(supports(domain, "search")).toBe(true);
    }
    // And the registry still describes jobs, so the model is told why rather
    // than finding the domain simply absent.
    expect(CONTENT_REGISTRY.jobs.note).toContain("recruitment rule");
  });
});

describe("HR reads a vacancy its own department does not own", () => {
  /**
   * The concrete case the content rule got wrong: a vacancy at Oslo, owned by
   * the department that is hiring. Under content scope an Oslo HR member —
   * department `dept-hr` — matches the campus and not the department, so the
   * row is invisible. Under the recruitment rule it is theirs.
   */
  function tables() {
    return {
      campus: [
        { $id: "1", name: "Oslo" },
        { $id: "2", name: "Bergen" },
      ],
      jobs: [
        {
          $id: "job-esn",
          $updatedAt: "2026-01-02T00:00:00.000Z",
          slug: "esn-coordinator",
          campus_id: "1",
          campus: { $id: "1" },
          department_id: "dept-esn-oslo",
          department: { $id: "dept-esn-oslo" },
          status: "draft",
          title: "ESN coordinator",
        },
      ],
    };
  }

  function recruitment() {
    const backend = createFakeBackend({ tables: tables() });
    return createRecruitmentService(backend, createLookupService(backend));
  }

  test("the recruitment getter serves it", async () => {
    const vacancy = await recruitment().getVacancy(
      HR_MEMBER("Oslo", "1"),
      "job-esn"
    );
    expect(vacancy.id).toBe("job-esn");
    expect(vacancy.departmentId).toBe("dept-esn-oslo");
  });

  test("HR at another campus is still refused", async () => {
    await expect(
      recruitment().getVacancy(HR_MEMBER("Bergen", "2"), "job-esn")
    ).rejects.toThrow();
  });

  test("HR together with National reaches every campus", async () => {
    // `toRecruitmentScope` promotes HR+National to all campuses; content scope
    // would have narrowed them to the National campus and the HR department,
    // which is close to nothing.
    const national = makePrincipal({
      userId: "hr-national",
      roles: ["hr"],
      campusNames: ["National"],
      departmentNames: ["HR"],
      departmentTeamIds: ["sg-app-dept-hr"],
      resolvedCampusIds: ["3"],
      resolvedDepartmentIds: ["dept-hr"],
      profile: "staff",
    });

    const vacancy = await recruitment().getVacancy(national, "job-esn");
    expect(vacancy.id).toBe("job-esn");
  });
});

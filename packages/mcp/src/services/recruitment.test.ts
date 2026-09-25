/**
 * Recruitment scope.
 *
 * Recruitment is HR-exclusive with global-admin break-glass, and HR membership
 * is campus-scoped like any other. The property pinned here is that a campus
 * filter must *narrow* what an HR principal may see and can never widen it,
 * substitute for it, or be silently ignored — answering a Bergen request with
 * Oslo vacancies, presented as a filtered result, is worse than refusing.
 */

import { describe, expect, test } from "bun:test";
import { DomainError } from "../runtime/errors";
import { createFakeBackend, GLOBAL_ADMIN, HR_MEMBER } from "../testing/index";
import { createLookupService } from "./lookups";
import { createRecruitmentService } from "./recruitment";

function tables() {
  return {
    campus: [
      { $id: "1", name: "Oslo" },
      { $id: "2", name: "Bergen" },
    ],
    jobs: [
      {
        $id: "job-oslo",
        $updatedAt: "2026-01-02T00:00:00.000Z",
        campus_id: "1",
        campus: { $id: "1" },
        status: "published",
        title: "Oslo vacancy",
      },
      {
        $id: "job-bergen",
        $updatedAt: "2026-01-01T00:00:00.000Z",
        campus_id: "2",
        campus: { $id: "2" },
        status: "published",
        title: "Bergen vacancy",
      },
    ],
  };
}

function service() {
  const backend = createFakeBackend({ tables: tables() });
  return createRecruitmentService(backend, createLookupService(backend));
}

const PAGE = { limit: 20, offset: 0 };

describe("listVacancies campus filter", () => {
  test("campus-scoped HR sees only their own campus by default", async () => {
    const result = await service().listVacancies(HR_MEMBER("Oslo", "1"), PAGE);
    expect(result.rows.map((row) => row.id)).toEqual(["job-oslo"]);
  });

  test("a campus they manage narrows rather than widens", async () => {
    const result = await service().listVacancies(HR_MEMBER("Oslo", "1"), {
      ...PAGE,
      campusId: "1",
    });
    expect(result.rows.map((row) => row.id)).toEqual(["job-oslo"]);
  });

  test("a campus they do not manage is refused, not silently ignored", async () => {
    // The failure mode this guards: returning Oslo rows for a Bergen request
    // while the scope note claims the filter was applied.
    let thrown: unknown;
    try {
      await service().listVacancies(HR_MEMBER("Oslo", "1"), {
        ...PAGE,
        campusId: "2",
      });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(DomainError);
    expect((thrown as DomainError).code).toBe("forbidden");
  });

  test("global scope may filter to any campus", async () => {
    const result = await service().listVacancies(GLOBAL_ADMIN(), {
      ...PAGE,
      campusId: "2",
    });
    expect(result.rows.map((row) => row.id)).toEqual(["job-bergen"]);
  });
});

describe("deadline ordering", () => {
  /**
   * The campus briefing asks "what closes soon". The default
   * most-recently-updated ordering answers a different question, and with a
   * limit it answers it destructively: an imminent vacancy nobody has edited
   * lately falls outside the window, and the briefing reports nothing urgent.
   */
  /**
   * Deadlines are relative to the real clock, because `order: "deadline"`
   * now bounds on it: a vacancy stays `published` after its deadline, so the
   * query excludes past ones before the limit. A hardcoded date would stop
   * meaning "upcoming" the day it passed — which is precisely what happened
   * to the literal that used to sit here.
   */
  const DAY = 86_400_000;
  const CLOSES_SOON = new Date(Date.now() + 2 * DAY).toISOString();
  const CLOSES_LATER = new Date(Date.now() + 300 * DAY).toISOString();
  const CLOSED_ALREADY = new Date(Date.now() - 2 * DAY).toISOString();

  function tablesWithDeadlines() {
    return {
      campus: [{ $id: "1", name: "Oslo" }],
      jobs: [
        {
          $id: "recently-edited-far-off",
          $updatedAt: "2026-09-15T00:00:00.000Z",
          campus_id: "1",
          campus: { $id: "1" },
          status: "published",
          title: "Far off",
          application_deadline: CLOSES_LATER,
        },
        {
          $id: "stale-but-imminent",
          $updatedAt: "2026-01-01T00:00:00.000Z",
          campus_id: "1",
          campus: { $id: "1" },
          status: "published",
          title: "Closes tomorrow",
          application_deadline: CLOSES_SOON,
        },
        {
          $id: "no-deadline",
          $updatedAt: "2026-09-14T00:00:00.000Z",
          campus_id: "1",
          campus: { $id: "1" },
          status: "published",
          title: "Open ended",
          application_deadline: null,
        },
      ],
    };
  }

  function service() {
    const backend = createFakeBackend({ tables: tablesWithDeadlines() });
    return createRecruitmentService(backend, createLookupService(backend));
  }

  test("a limit of one returns the soonest deadline, not the newest edit", async () => {
    const result = await service().listVacancies(GLOBAL_ADMIN(), {
      status: "published",
      order: "deadline",
      limit: 1,
      offset: 0,
    });
    expect(result.rows.map((row) => row.id)).toEqual(["stale-but-imminent"]);
  });

  test("an expired vacancy does not occupy the deadline window", async () => {
    // A vacancy stays `published` after its deadline, so ascending order puts
    // the oldest expired rows first. With a limit they fill the whole window
    // and the briefing filters them out locally — reporting nothing closing
    // soon while a vacancy closes in two days. The bound has to be in the
    // query, before the limit.
    const backend = createFakeBackend({
      tables: {
        campus: [{ $id: "1", name: "Oslo" }],
        jobs: [
          {
            $id: "expired",
            $updatedAt: "2026-01-01T00:00:00.000Z",
            campus_id: "1",
            campus: { $id: "1" },
            status: "published",
            title: "Closed last week",
            application_deadline: CLOSED_ALREADY,
          },
          {
            $id: "closes-soon",
            $updatedAt: "2026-01-01T00:00:00.000Z",
            campus_id: "1",
            campus: { $id: "1" },
            status: "published",
            title: "Closes in two days",
            application_deadline: CLOSES_SOON,
          },
        ],
      },
    });
    const result = await createRecruitmentService(
      backend,
      createLookupService(backend)
    ).listVacancies(GLOBAL_ADMIN(), {
      status: "published",
      order: "deadline",
      limit: 1,
      offset: 0,
    });
    expect(result.rows.map((row) => row.id)).toEqual(["closes-soon"]);
  });

  test("vacancies with no deadline are excluded from the deadline probe", async () => {
    // Ascending order would otherwise let them fill the window — the rows this
    // ordering exists to exclude.
    const result = await service().listVacancies(GLOBAL_ADMIN(), {
      status: "published",
      order: "deadline",
      limit: 20,
      offset: 0,
    });
    expect(result.rows.map((row) => row.id)).not.toContain("no-deadline");
  });

  test("the default ordering is unchanged", async () => {
    const result = await service().listVacancies(GLOBAL_ADMIN(), {
      status: "published",
      limit: 1,
      offset: 0,
    });
    expect(result.rows.map((row) => row.id)).toEqual([
      "recently-edited-far-off",
    ]);
  });
});

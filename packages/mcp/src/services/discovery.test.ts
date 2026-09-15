/**
 * Public discovery.
 *
 * These tools answer for signed-out visitors, so "what the public site shows"
 * is the specification. A vacancy stays `published` after its deadline passes,
 * so status alone is not "open" — `isRecruitmentVacancyOpen` in `@repo/shared`
 * is the repo's definition, and `apps/web` filters both its vacancy list and
 * its sitemap by it.
 */

import { describe, expect, test } from "bun:test";
import type { JobsStatus } from "@repo/api/types/appwrite";
import { isRecruitmentVacancyOpen } from "@repo/shared/types/recruitment";
import { createFakeBackend } from "../testing/index";
import { createDiscoveryService } from "./discovery";

const LINKS = {
  web: (path: string) => `https://biso.no${path}`,
  admin: (path: string) => `https://admin.biso.no${path}`,
};

const PAST = "2020-01-01T00:00:00.000Z";
const FUTURE = "2099-01-01T00:00:00.000Z";

function tables() {
  return {
    jobs: [
      {
        $id: "open-with-deadline",
        $updatedAt: "2026-01-03T00:00:00.000Z",
        slug: "open-deadline",
        status: "published",
        campus_id: "1",
        application_deadline: FUTURE,
        translations: [],
      },
      {
        $id: "open-no-deadline",
        $updatedAt: "2026-01-02T00:00:00.000Z",
        slug: "open-no-deadline",
        status: "published",
        campus_id: "1",
        application_deadline: null,
        translations: [],
      },
      {
        $id: "closed-by-deadline",
        $updatedAt: "2026-01-01T00:00:00.000Z",
        slug: "closed",
        status: "published",
        campus_id: "1",
        application_deadline: PAST,
        translations: [],
      },
    ],
  };
}

function service() {
  return createDiscoveryService(createFakeBackend({ tables: tables() }), LINKS);
}

describe("public vacancy discovery", () => {
  test("a vacancy past its deadline is not offered", async () => {
    const result = await service().search({
      kind: "jobs",
      locale: "no",
      limit: 20,
      offset: 0,
    });
    const ids = result.rows.map((row) => row.id);
    expect(ids).not.toContain("closed-by-deadline");
  });

  test("open vacancies, with and without a deadline, are offered", async () => {
    const result = await service().search({
      kind: "jobs",
      locale: "no",
      limit: 20,
      offset: 0,
    });
    const ids = result.rows.map((row) => row.id);
    expect(ids).toContain("open-with-deadline");
    expect(ids).toContain("open-no-deadline");
  });

  test("the result agrees with the shared predicate row for row", async () => {
    // The point of this one: if the repo's definition of "open" moves, this
    // fails rather than quietly drifting from what the public site shows.
    const result = await service().search({
      kind: "jobs",
      locale: "no",
      limit: 20,
      offset: 0,
    });
    const returned = new Set(result.rows.map((row) => row.id));
    for (const job of tables().jobs) {
      const open = isRecruitmentVacancyOpen(
        job.status as JobsStatus,
        job.application_deadline
      );
      expect(returned.has(job.$id)).toBe(open);
    }
  });

  test("the total excludes closed vacancies, so paging stays truthful", async () => {
    const result = await service().search({
      kind: "jobs",
      locale: "no",
      limit: 20,
      offset: 0,
    });
    expect(result.total).toBe(2);
  });
});

/**
 * A vacancy's title, when the locale row is there but its title is not.
 *
 * `localizeVacancy` in `@repo/shared/recruitment` states the rule: a locale
 * row can exist with only some fields written, so a blank field falls back to
 * the first other locale that has it. `apps/web` runs every vacancy listing
 * and detail through it. This package presented vacancy titles from three
 * places that all stopped at `find(locale)?.title ?? …` — and `??` does not
 * catch `""`, which is exactly what an absent title normalizes to
 * (`toRecruitmentTranslation` writes `translation.title ?? ""`).
 *
 * So a vacancy the site shows as "Kommunikasjonsansvarlig" came back from
 * this package with an empty title.
 */

import { describe, expect, test } from "bun:test";
import { createFakeBackend, HR_MEMBER } from "../testing/index";
import { createDiscoveryService } from "./discovery";
import { createLookupService } from "./lookups";
import { createRecruitmentService } from "./recruitment";

const LINKS = {
  web: (path: string) => `https://biso.no${path}`,
  admin: (path: string) => `https://admin.biso.no${path}`,
};

const FUTURE = "2099-01-01T00:00:00.000Z";

/**
 * One vacancy, two translation rows. The English row exists — it carries the
 * teaser — but its title was never written. The Norwegian one has the title.
 */
function jobsTable() {
  return [
    {
      $id: "job-comms",
      $updatedAt: "2026-01-02T00:00:00.000Z",
      slug: "kommunikasjonsansvarlig",
      status: "published",
      campus_id: "1",
      campus: { $id: "1" },
      department_id: "dept-comms-oslo",
      department: { $id: "dept-comms-oslo" },
      application_deadline: FUTURE,
      metadata: null,
      translations: [
        {
          $id: "tr-en",
          locale: "en",
          title: "",
          short_description: "We are hiring a communications manager",
          description: "",
        },
        {
          $id: "tr-no",
          locale: "no",
          title: "Kommunikasjonsansvarlig",
          short_description: "Vi søker en kommunikasjonsansvarlig",
          description: "<p>Som kommunikasjonsansvarlig</p>",
        },
      ],
    },
  ];
}

function campusTable() {
  return [
    { $id: "1", name: "Oslo" },
    { $id: "2", name: "Bergen" },
  ];
}

describe("public discovery", () => {
  function service() {
    return createDiscoveryService(
      createFakeBackend({ tables: { jobs: jobsTable() } }),
      LINKS
    );
  }

  test("an English caller gets the Norwegian title, not a blank one", async () => {
    const result = await service().search({
      kind: "jobs",
      locale: "en",
      limit: 20,
      offset: 0,
    });
    const row = result.rows.find((item) => item.id === "job-comms");
    expect(row?.title).toBe("Kommunikasjonsansvarlig");
  });

  test("and keeps the English teaser it does have", async () => {
    // The point of the per-field rule: only the blank field falls back. The
    // English row's own short_description must survive.
    const result = await service().search({
      kind: "jobs",
      locale: "en",
      limit: 20,
      offset: 0,
    });
    const row = result.rows.find((item) => item.id === "job-comms");
    expect(row?.summary).toBe("We are hiring a communications manager");
  });

  test("a Norwegian caller is unaffected", async () => {
    const result = await service().search({
      kind: "jobs",
      locale: "no",
      limit: 20,
      offset: 0,
    });
    const row = result.rows.find((item) => item.id === "job-comms");
    expect(row?.title).toBe("Kommunikasjonsansvarlig");
    expect(row?.summary).toBe("Vi søker en kommunikasjonsansvarlig");
  });
});

describe("staff recruitment", () => {
  /**
   * The staff path prefers `no` and has no locale argument, so the failing
   * shape is the mirror image: the Norwegian row is the one missing a title.
   */
  function staffJobs() {
    const [job] = jobsTable();
    return [
      {
        ...job,
        translations: [
          {
            $id: "tr-no",
            locale: "no",
            title: "",
            short_description: null,
            description: "",
          },
          {
            $id: "tr-en",
            locale: "en",
            title: "Communications manager",
            short_description: null,
            description: "",
          },
        ],
      },
    ];
  }

  function recruitment() {
    const backend = createFakeBackend({
      tables: { campus: campusTable(), jobs: staffJobs() },
    });
    return createRecruitmentService(backend, createLookupService(backend));
  }

  test("the listing falls back rather than showing an empty title", async () => {
    const result = await recruitment().listVacancies(HR_MEMBER("Oslo", "1"), {
      limit: 20,
      offset: 0,
    });
    const row = result.rows.find((item) => item.id === "job-comms");
    expect(row?.title).toBe("Communications manager");
  });

  test("the getter answers the same as the listing", async () => {
    // These were byte-identical copies of one rule in two files. A caller who
    // finds a vacancy by title in the listing and opens it by id must not be
    // told it is a different role.
    const principal = HR_MEMBER("Oslo", "1");
    const listed = await recruitment().listVacancies(principal, {
      limit: 20,
      offset: 0,
    });
    const fetched = await recruitment().getVacancy(principal, "job-comms");
    const row = listed.rows.find((item) => item.id === "job-comms");
    expect(fetched.title).toBe("Communications manager");
    expect(row).toBeDefined();
    expect(fetched.title).toBe(row?.title ?? null);
  });
});

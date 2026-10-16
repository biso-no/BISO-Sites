import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { codeOnly } from "@/test/source";
import { ledeFor, plainText } from "./lede";
import { feedTotal, islandTotalAfterPage } from "./paging";

/** Hoisted: Biome forbids building a regex inside an assertion. */
const SEARCH_CARRIES_CAMPUS = /SEARCH_KEEPS = \[\s*"campus"/;

const read = (f: string) =>
  codeOnly(readFileSync(join(import.meta.dirname, f), "utf8"));
const list = read("jobs-v2.tsx");
const card = read("job-card.tsx");
const loadMore = read("jobs-load-more.tsx");
const detail = read("job-detail-v2.tsx");
const chips = read("../../ui/filter-chips.tsx");
const globals = readFileSync(
  join(import.meta.dirname, "../../../../../../packages/ui/styles/globals.css"),
  "utf8"
);

describe("jobs list (RD-019)", () => {
  it("renders on the server — no client directive, no filter state", () => {
    // v1 holds filters in useState inside a client component and mirrors them
    // with router.replace. Server rendering is what makes the list appear
    // without JS, and is why all five vacancies are in the initial HTML.
    expect(list).not.toContain('"use client"');
    expect(list).not.toContain("useState");
    expect(list).not.toContain("router.replace");
  });

  it("has no scroll-triggered motion", () => {
    expect(list).not.toContain("whileInView");
    expect(detail).not.toContain("whileInView");
  });

  it("renders no workload badge (PLACEHOLDER-002)", () => {
    // The reference shows "20%" on each card. `Jobs` has no column behind it,
    // so nothing is rendered rather than inventing a number.
    for (const source of [list, card]) {
      expect(source).not.toContain("workload");
      expect(source).not.toContain("%</");
    }
  });

  it("offers only filters the query can answer, with options from the open set", () => {
    // Updated in the main merge. This asserted an employment-type chip row
    // derived from the loaded jobs. Main's paginated `listJobs` (#61) dropped
    // the employment-type and paid-only filters on purpose: both live in the
    // vacancy's JSON metadata, which Appwrite cannot filter on, and filtering
    // one page client-side leaves holes in every later page. The options that
    // remain come from `listJobFacets`, which reads the whole open set rather
    // than page one — still derived from the data, never a fixed list.
    expect(list).not.toContain('param="type"');
    expect(list).not.toContain('param="paid"');
    expect(list).toContain("facets.categories");
    expect(list).toContain("facets.departments");
  });

  it("still shows a vacancy's employment type, read from its data", () => {
    expect(card).toContain("job.metadata.employment_type");
  });

  it("leaves campus to the header switcher, and carries it along", () => {
    // Main's feed had no in-page campus filter, and the Branding Committee
    // (#95) made the header switcher the one place to change campus. The
    // parameter it writes must survive a search and every chip link.
    expect(list).not.toContain('param="campus"');
    expect(list).toMatch(SEARCH_CARRIES_CAMPUS);
    expect(list).toContain("searchParams={linkParams}");
  });
});

describe("jobs feed paging (main #61)", () => {
  it("appends later pages through listJobs with the shared load-more hook", () => {
    expect(loadMore).toContain('"use client"');
    expect(loadMore).toContain("useLoadMore");
    expect(loadMore).toContain("listJobs(");
    expect(loadMore).toContain("<LoadMoreButton");
  });

  it("remounts the island when a filter changes", () => {
    // useLoadMore does not watch its props; without a key a new filter would
    // append its pages onto the previous filter's rows.
    expect(list).toContain("<JobsLoadMore");
    expect(list).toContain("key={`${campusId");
  });

  it("renders the server grid and the island with one card", () => {
    // Identical markup on both sides needs a card free of hooks and of
    // server-only imports, taking its labels already translated.
    expect(card).not.toContain('"use client"');
    expect(card).not.toContain("next-intl");
    expect(card).not.toContain("@repo/api/server");
    expect(list).toContain("<JobCard");
    expect(loadMore).toContain("<JobCard");
  });

  it("says when a capped search counted only the first matches", () => {
    expect(list).toContain("result.capped");
    expect(list).toContain('t("filters.showingFirstResults"');
  });

  it("counts with the guards, not Appwrite's total directly", () => {
    expect(list).toContain("feedTotal(");
    expect(loadMore).toContain("islandTotalAfterPage(");
  });
});

describe("counting without trusting Appwrite's total", () => {
  // `listRows().total` can report the whole table (see `countRows` in
  // lib/data/queries.ts). A short page is the last one, so it is the count.
  it("takes a short page as the exact count", () => {
    expect(
      feedTotal({ pageRows: 5, pageSize: 12, reportedTotal: 253, startPage: 1 })
    ).toBe(5);
    expect(
      feedTotal({ pageRows: 5, pageSize: 12, reportedTotal: 253, startPage: 3 })
    ).toBe(29);
    expect(
      feedTotal({ pageRows: 0, pageSize: 12, reportedTotal: 253, startPage: 1 })
    ).toBe(0);
  });

  it("uses the reported total only while every page is full", () => {
    expect(
      feedTotal({ pageRows: 12, pageSize: 12, reportedTotal: 28, startPage: 1 })
    ).toBe(28);
  });

  it("ends the load-more list at a short page", () => {
    const after = (page: number, pageRows: number, reportedTotal = 253) =>
      islandTotalAfterPage({
        page,
        pageRows,
        pageSize: 12,
        reportedTotal,
        shownBefore: 12,
      });
    // A full page cannot tell; the list goes on.
    expect(after(2, 12)).toBe(241);
    // Page 3 has 4 rows: the island holds 12 + 4 and nothing more is offered.
    expect(after(3, 4)).toBe(16);
    // An empty page past a full one ends it too.
    expect(after(3, 0)).toBe(12);
    // Where the total is right, the guard agrees with it.
    expect(after(2, 12, 24)).toBe(12);
  });
});

describe("filter groups (RD-019)", () => {
  it("renders nothing when only the default option exists", () => {
    // No vacancy currently carries an employment_type, so the type group would
    // otherwise be a lone "All" chip: furniture that looks like a control.
    expect(chips).toContain("options.length < MIN_OPTIONS");
    expect(chips).toContain("return null");
  });
});

describe("job detail (RD-019)", () => {
  it("is a Server Component with one small client island", () => {
    // v1 marks all 368 lines "use client" to get a copy-link button.
    expect(detail).not.toContain('"use client"');
    expect(detail).toContain("CopyLinkButton");
  });

  it("keeps the JobPosting structured data that feeds Google Jobs", () => {
    expect(detail).toContain("<JobPostingSchema job={job} />");
  });

  it("gates a members-only vacancy's form and says so in the header", () => {
    // Main (d6c1c42d): everyone can read a members-only vacancy, only members
    // may apply. The page resolves membership; the form shows the gate.
    expect(detail).toContain('job.metadata.audience === "members"');
    expect(detail).toContain("isMember={isMember}");
    expect(detail).toContain("membersOnly={membersOnly}");
    expect(detail).toContain('t("card.membersOnly")');
  });

  it("navigates back with a link, not router.push", () => {
    // router.push inside a button gives no middle-click, no open-in-new-tab
    // and no visible href.
    expect(detail).not.toContain("useRouter");
    expect(detail).toContain('href="/jobs"');
  });

  it("translates labels and formats dates for the active locale", () => {
    // v1 hardcodes "Vacancy details", "Employer", "Deadline", "Rolling" and
    // formats every date en-GB, so a Norwegian visitor reads an English page.
    // `VacancySummary` scopes itself to "jobs.detail", so its labels are
    // t("summaryTitle"); the page-level ones stay t("detail.*").
    expect(detail).toContain('getTranslations("jobs.detail")');
    expect(detail).toContain('t("summaryTitle")');
    expect(detail).toContain('t("detail.rolling")');
    for (const label of ["employer", "deadline", "location", "campus"]) {
      expect(detail).toContain(`t("${label}")`);
    }
    expect(detail).toContain('locale === "no" ? "nb-NO" : "en-GB"');
    expect(detail).not.toContain('toLocaleDateString("en-GB")');
  });
});

describe("plainText", () => {
  it("reads HTML descriptions, the shape actually stored", () => {
    expect(plainText("<p>One two.</p><p>Three four.</p>")).toBe(
      "One two. Three four."
    );
  });

  it("reads Plate JSON, which the renderer also accepts", () => {
    expect(plainText('[{"type":"p","children":[{"text":"One two."}]}]')).toBe(
      "One two."
    );
  });

  it("decodes the entities that appear in stored copy", () => {
    expect(plainText("<p>R&amp;D&nbsp;team</p>")).toBe("R&D team");
  });
});

describe("ledeFor", () => {
  const description =
    "<p>BISO Media søker nye Content Creators!</p><p>BISO Media spiller en sentral rolle i BISO ved å levere foto.</p>";

  it("drops a short_description that is a truncation of the body", () => {
    // Every stored vacancy is currently like this — the field ends mid-word
    // and repeats the opening paragraph verbatim.
    const truncated =
      "BISO Media søker nye Content Creators! BISO Media spiller en sentral rolle i BISO ved å levere f";
    expect(ledeFor(truncated, description)).toBeUndefined();
  });

  it("keeps a genuinely written summary", () => {
    const written = "Shoot photo and video for every BISO event in Bergen.";
    expect(ledeFor(written, description)).toBe(written);
  });

  it("keeps a summary too short to judge, and drops nothing else", () => {
    expect(ledeFor("Join us", description)).toBe("Join us");
    expect(ledeFor(null, description)).toBeUndefined();
    expect(ledeFor("   ", description)).toBeUndefined();
  });
});

describe("focus ring token", () => {
  it("registers --color-focus-ring so ring-focus-ring is a real utility", () => {
    // Regression guard. `ring-focus-ring` was used 27 times across apps/web
    // before this alias existed. Tailwind only emits a `ring-<name>` utility
    // for a registered theme colour, so every one of those compiled to
    // nothing — while the `focus-visible:outline-none` beside it applied,
    // leaving those controls with *less* visible focus than the default.
    expect(globals).toContain("--color-focus-ring:");
  });
});

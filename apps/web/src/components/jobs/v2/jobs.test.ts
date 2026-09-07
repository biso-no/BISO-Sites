import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { codeOnly } from "@/test/source";
import { ledeFor, plainText } from "./lede";

const read = (f: string) =>
  codeOnly(readFileSync(join(import.meta.dirname, f), "utf8"));
const list = read("jobs-v2.tsx");
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
    expect(list).not.toContain("workload");
    expect(list).not.toContain("%</");
  });

  it("derives employment types from the data rather than a fixed list", () => {
    expect(list).toContain("job.metadata.employment_type");
    expect(list).toContain("new Set(");
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

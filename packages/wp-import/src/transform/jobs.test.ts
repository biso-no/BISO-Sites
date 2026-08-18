import { describe, expect, test } from "bun:test";
import type { DepartmentRecord } from "./departments";
import { transformJob } from "./jobs";

const DEPARTMENTS: DepartmentRecord[] = [
  { Id: "21", Name: "OSL Bergensbaneløpet", campus_id: "1" },
  { Id: "313", Name: "BRG Næringslivsutvalget", campus_id: "2" },
];

const baseJob = {
  campus: ["Oslo"],
  content:
    "Karrieredagene rekrutterer til en ny manager for 2026.\n\n\n\nDu vil ha ansvar for kommunikasjon og synlighet mot studentene, og du skal jobbe med sosiale medier og nettside.",
  date_posted: "2026-08-01 14:56:35",
  department: ["Bergensbaneløpet"],
  expiry_date: "2026-08-20",
  id: 63_903,
  is_expired: false,
  job_type: null,
  location: null,
  post: {
    content: {
      rendered: "<p>Karrieredagene rekrutterer til en ny manager.</p>",
    },
    date: "2026-08-01T14:56:35",
    id: 63_903,
    link: "https://biso.no/undergruppe/pr-manager/",
    slug: "pr-manager",
    status: "publish",
    title: { rendered: "PR Manager &#8211; Karrieredagene" },
  },
  slug: "pr-manager",
  thumbnail: [],
  title: "PR Manager – Karrieredagene",
  url: "https://biso.no/undergruppe/pr-manager/",
  verv: ["PR"],
};

describe("transformJob", () => {
  test("builds a jobs row with a deterministic id", () => {
    const { job, reject } = transformJob(baseJob, DEPARTMENTS, new Map());

    expect(reject).toBeNull();
    expect(job?.rowId).toBe("wpjob63903");
    expect(job?.row.slug).toBe("pr-manager");
    expect(job?.row.campus_id).toBe("1");
  });

  test("maps campus name to the Appwrite campus id", () => {
    const { job } = transformJob(
      { ...baseJob, campus: ["Bergen"], department: ["Næringslivsutvalget"] },
      DEPARTMENTS,
      new Map()
    );

    expect(job?.row.campus_id).toBe("2");
    expect(job?.row.department_id).toBe("313");
  });

  test("rejects a job with no campus, because campus_id is required", () => {
    const { job, reject } = transformJob(
      { ...baseJob, campus: [] },
      DEPARTMENTS,
      new Map()
    );

    expect(job).toBeNull();
    expect(reject?.reason).toContain("campus");
  });

  test("marks an expired job as closed", () => {
    const { job } = transformJob(
      { ...baseJob, is_expired: true },
      DEPARTMENTS,
      new Map()
    );

    expect(job?.row.status).toBe("closed");
  });

  test("marks a live job as published", () => {
    const { job } = transformJob(baseJob, DEPARTMENTS, new Map());

    expect(job?.row.status).toBe("published");
  });

  test("sets application_deadline from expiry_date", () => {
    const { job } = transformJob(baseJob, DEPARTMENTS, new Map());

    expect(job?.row.application_deadline).toBe("2026-08-20T00:00:00.000Z");
  });

  test("detects the written language rather than trusting the url locale", () => {
    const { job } = transformJob(
      { ...baseJob, url: "https://biso.no/en/undergruppe/pr-manager/" },
      DEPARTMENTS,
      new Map()
    );

    expect(job?.sourceLocale).toBe("no");
  });

  test("decodes entities in the title", () => {
    const { job } = transformJob(baseJob, DEPARTMENTS, new Map());

    expect(job?.title).toBe("PR Manager – Karrieredagene");
  });

  test("leaves department_id null when no confident match exists", () => {
    const { job } = transformJob(
      { ...baseJob, department: ["HR advisor"] },
      DEPARTMENTS,
      new Map()
    );

    expect(job?.row.department_id).toBeNull();
  });

  test("prefers a human-resolved department over the matcher", () => {
    const resolved = new Map([["1::HR advisor", "21"]]);
    const { job } = transformJob(
      { ...baseJob, department: ["HR advisor"] },
      DEPARTMENTS,
      resolved
    );

    expect(job?.row.department_id).toBe("21");
  });

  test("stores verv values as metadata tags, capped at four", () => {
    const { job } = transformJob(
      { ...baseJob, verv: ["a", "b", "c", "d", "e"] },
      DEPARTMENTS,
      new Map()
    );
    const metadata = JSON.parse(String(job?.row.metadata));

    expect(metadata.tags).toHaveLength(4);
  });

  test("normalizes the description into the studio block subset", () => {
    const { job } = transformJob(baseJob, DEPARTMENTS, new Map());

    expect(job?.descriptionHtml.startsWith("<p>")).toBe(true);
    expect(job?.descriptionHtml).not.toContain("\n\n");
  });
});

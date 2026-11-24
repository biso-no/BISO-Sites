import { JobsStatus } from "@repo/api/types/appwrite";
import { describe, expect, it } from "vitest";
import { OPEN_ENDED } from "../types";
import { ctx, noText } from "./fixtures";
import { jobEntries } from "./job";

type Row = Parameters<typeof jobEntries>[0];
const job = (o: Partial<Row> = {}): Row => ({
  $id: "j1",
  slug: "volunteer",
  status: JobsStatus.PUBLISHED,
  campus_id: "1",
  department_id: "d9",
  application_deadline: null,
  ...o,
});

describe("jobEntries", () => {
  it("maps an open vacancy", () => {
    const e = jobEntries(
      job({ application_deadline: "2027-01-01T00:00:00Z" }),
      noText,
      ctx()
    );
    expect(e[0]).toMatchObject({
      type: "job",
      url: "/jobs/volunteer",
      department: "Dept d9",
      deadline: 1_798_761_600,
      visible_until: 1_798_761_600,
    });
  });
  it("is open-ended without a deadline", () => {
    const e = jobEntries(job(), noText, ctx())[0];
    expect(e.visible_until).toBe(OPEN_ENDED);
    expect(e.deadline).toBeNull();
  });
  it("hides past deadlines and closed jobs", () => {
    expect(
      jobEntries(
        job({ application_deadline: "2026-11-01T00:00:00Z" }),
        noText,
        ctx({ now: new Date("2026-11-23") })
      )
    ).toEqual([]);
    expect(
      jobEntries(job({ status: JobsStatus.CLOSED }), noText, ctx())
    ).toEqual([]);
  });
});

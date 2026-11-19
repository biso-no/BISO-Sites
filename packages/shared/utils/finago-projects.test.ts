import type {
  FinagoProjects,
  FinagoProjectUsage,
} from "@repo/api/types/appwrite";
import type { CostLine } from "@repo/connectors/24sevenoffice";
import { describe, expect, it } from "vitest";
import {
  aggregateUsage,
  departmentCandidates,
  editionTiming,
  parseProjectName,
  shareClass,
} from "./finago-projects";

function line(over: Partial<CostLine> = {}): CostLine {
  return {
    accountNumber: 6800,
    amount: 100,
    date: "2026-03-01",
    departmentId: "D1",
    projectId: "P1",
    ...over,
  };
}

function project(over: Partial<FinagoProjects> = {}): FinagoProjects {
  return {
    $id: over.project_id ?? "P1",
    active: true,
    event_date: null,
    first_line_date: null,
    last_line_date: null,
    line_count: 0,
    name: "Project",
    peak_date: null,
    project_id: "P1",
    series: "project",
    synced_at: null,
    year: null,
    ...over,
  } as FinagoProjects;
}

/** A project row named like Finago, with series and year parsed from it. */
function named(
  projectId: string,
  name: string,
  over: Partial<FinagoProjects> = {}
): FinagoProjects {
  return project({
    name,
    project_id: projectId,
    ...parseProjectName(name),
    ...over,
  });
}

function usage(over: Partial<FinagoProjectUsage> = {}): FinagoProjectUsage {
  return {
    $id: "U1",
    department_id: "D1",
    first_line_date: "2026-01-10T00:00:00.000+00:00",
    last_line_date: "2026-06-10T00:00:00.000+00:00",
    line_count: 3,
    project_id: "P1",
    synced_at: null,
    ...over,
  } as FinagoProjectUsage;
}

describe("parseProjectName", () => {
  it.each([
    ["KD 2026", "kd", 2026],
    ["Wintergames 2027", "wintergames", 2027],
    ["Landsmøte mars 2026", "landsmøte", 2026],
    ["Academics samling oktober2026", "academics samling", 2026],
    ["Fadderullan 17", "fadderullan", 2017],
    ["Ball 18", "ball", 2018],
    ["24Sevenoffice", "24sevenoffice", null],
    ["BISO-Lunsj", "biso-lunsj", null],
  ])("%s → %s, %s", (name, series, year) => {
    expect(parseProjectName(name)).toEqual({ series, year });
  });

  it("collapses whitespace and drops a dangling dash", () => {
    expect(parseProjectName("  Wintergames  -  2027 ")).toEqual({
      series: "wintergames",
      year: 2027,
    });
  });

  it("removes English month words too", () => {
    expect(parseProjectName("Leader summit October 2026")).toEqual({
      series: "leader summit",
      year: 2026,
    });
  });

  it("a lone two-digit word is not a year", () => {
    expect(parseProjectName("17")).toEqual({ series: "17", year: null });
  });

  it("a two-digit word that is not last is not a year", () => {
    expect(parseProjectName("Team 17 Oslo")).toEqual({
      series: "team 17 oslo",
      year: null,
    });
  });

  it("a name that is only a year keeps it as the series", () => {
    expect(parseProjectName("2026")).toEqual({ series: "2026", year: 2026 });
  });

  it("a name that is only a month keeps the month as the series", () => {
    expect(parseProjectName("Mars 2026")).toEqual({
      series: "mars",
      year: 2026,
    });
  });
});

describe("aggregateUsage", () => {
  it("the busiest two weeks set the peak date", () => {
    const { projects } = aggregateUsage([
      line({ amount: 300, date: "2026-01-05" }),
      line({ amount: 500, date: "2026-03-01" }),
      line({ amount: 1000, date: "2026-06-10" }),
      line({ amount: 1500, date: "2026-06-14" }),
      // A credit counts by its size.
      line({ amount: -800, date: "2026-06-16" }),
      line({ amount: 200, date: "2026-09-30" }),
    ]);
    expect(projects.get("P1")).toEqual({
      firstLineDate: "2026-01-05",
      lastLineDate: "2026-09-30",
      lineCount: 6,
      peakDate: "2026-06-13",
    });
  });

  it("a single big day is its own peak date", () => {
    const { projects } = aggregateUsage([
      line({ amount: 50, date: "2026-01-02" }),
      line({ amount: 5000, date: "2026-02-20" }),
      line({ amount: 50, date: "2026-05-01" }),
    ]);
    expect(projects.get("P1")?.peakDate).toBe("2026-02-20");
  });

  it("the earliest of two equally busy stretches wins", () => {
    const { projects } = aggregateUsage([
      line({ amount: 400, date: "2026-02-10" }),
      line({ amount: 400, date: "2026-08-10" }),
    ]);
    expect(projects.get("P1")?.peakDate).toBe("2026-02-10");
  });

  it("a project whose lines sum to nothing has no peak date", () => {
    const { projects } = aggregateUsage([
      line({ amount: 0, date: "2026-02-10" }),
    ]);
    expect(projects.get("P1")).toEqual({
      firstLineDate: "2026-02-10",
      lastLineDate: "2026-02-10",
      lineCount: 1,
      peakDate: null,
    });
  });

  it("counts each project's lines per department", () => {
    const { usage } = aggregateUsage([
      line({ date: "2026-03-01", departmentId: "D1" }),
      line({ date: "2026-01-15", departmentId: "D1" }),
      line({ date: "2026-04-01", departmentId: "D2" }),
      line({ date: "2026-05-01", departmentId: "D1", projectId: "P2" }),
      // No department: counts for the project, not for any department.
      line({ date: "2026-06-01", departmentId: null }),
    ]);
    expect(usage.get("P1|D1")).toEqual({
      departmentId: "D1",
      firstLineDate: "2026-01-15",
      lastLineDate: "2026-03-01",
      lineCount: 2,
      projectId: "P1",
    });
    expect(usage.get("P1|D2")?.lineCount).toBe(1);
    expect(usage.get("P2|D1")?.lineCount).toBe(1);
    expect(usage.size).toBe(3);
  });

  it("department share counts lines with and without a project", () => {
    const { departmentShare, projects } = aggregateUsage([
      line({ departmentId: "D1", projectId: "P1" }),
      line({ departmentId: "D1", projectId: "P2" }),
      line({ departmentId: "D1", projectId: null }),
      line({ departmentId: "D2", projectId: null }),
      line({ departmentId: null, projectId: null }),
    ]);
    expect(departmentShare.get("D1")).toEqual({ total: 3, withProject: 2 });
    expect(departmentShare.get("D2")).toEqual({ total: 1, withProject: 0 });
    expect(departmentShare.size).toBe(2);
    expect([...projects.keys()].sort()).toEqual(["P1", "P2"]);
  });
});

describe("shareClass", () => {
  it.each([
    [1, "expected"],
    [0.8, "expected"],
    [0.79, "sometimes"],
    [0.2, "sometimes"],
    [0.19, "rare"],
    [0, "rare"],
    [null, "rare"],
  ] as const)("%s → %s", (share, expected) => {
    expect(shareClass(share)).toBe(expected);
  });
});

describe("departmentCandidates", () => {
  const today = "2026-11-19";

  it("a department without history has no candidates", () => {
    expect(
      departmentCandidates({
        departmentId: "D9",
        projects: [named("P1", "KD 2026"), named("P2", "KD 2027")],
        today,
        usage: [usage({ department_id: "D1", project_id: "P1" })],
      })
    ).toEqual([]);
  });

  it("a newer year of a used series is a candidate before it has lines", () => {
    const candidates = departmentCandidates({
      departmentId: "D1",
      projects: [
        named("P25", "Wintergames 2025"),
        named("P26", "Wintergames 2026"),
        named("P27", "Wintergames 2027"),
        named("K26", "KD 2026"),
      ],
      today,
      usage: [usage({ project_id: "P26" })],
    });
    expect(candidates.map((p) => p.project_id)).toEqual(["P26", "P27"]);
  });

  it("a newer year counts even when the year the department used is closed", () => {
    const candidates = departmentCandidates({
      departmentId: "D1",
      projects: [
        named("P26", "Wintergames 2026", { active: false }),
        named("P27", "Wintergames 2027"),
      ],
      today,
      usage: [usage({ project_id: "P26" })],
    });
    expect(candidates.map((p) => p.project_id)).toEqual(["P27"]);
  });

  it("inactive projects are never candidates", () => {
    const candidates = departmentCandidates({
      departmentId: "D1",
      projects: [
        named("P26", "BBL 2026", { active: false }),
        named("P27", "BBL 2027", { active: false }),
        named("L", "BISO-Lunsj", { active: false }),
      ],
      today,
      usage: [usage({ project_id: "P26" }), usage({ project_id: "L" })],
    });
    expect(candidates).toEqual([]);
  });

  it("year-less projects the department used are candidates", () => {
    const candidates = departmentCandidates({
      departmentId: "D1",
      projects: [named("L", "BISO-Lunsj"), named("S", "24Sevenoffice")],
      today,
      usage: [usage({ project_id: "L" })],
    });
    expect(candidates.map((p) => p.project_id)).toEqual(["L"]);
  });

  it("usage older than 24 months does not count", () => {
    const candidates = departmentCandidates({
      departmentId: "D1",
      projects: [named("P24", "KD 2024"), named("P25", "KD 2025")],
      today,
      usage: [
        usage({
          last_line_date: "2024-11-18T00:00:00.000+00:00",
          project_id: "P24",
        }),
      ],
    });
    expect(candidates).toEqual([]);
  });

  it("usage exactly 24 months back still counts", () => {
    const candidates = departmentCandidates({
      departmentId: "D1",
      projects: [named("P24", "KD 2024")],
      today,
      usage: [
        usage({
          last_line_date: "2024-11-19T00:00:00.000+00:00",
          project_id: "P24",
        }),
      ],
    });
    expect(candidates.map((p) => p.project_id)).toEqual(["P24"]);
  });

  it("older years of a used series are not candidates", () => {
    const candidates = departmentCandidates({
      departmentId: "D1",
      projects: [named("P25", "KD 2025"), named("P26", "KD 2026")],
      today,
      usage: [usage({ project_id: "P26" })],
    });
    expect(candidates.map((p) => p.project_id)).toEqual(["P26"]);
  });
});

describe("editionTiming", () => {
  const bbl = [
    named("B25", "BBL 2025", { peak_date: "2025-06-10T00:00:00.000+00:00" }),
    named("B26", "BBL 2026", { peak_date: "2026-06-15T00:00:00.000+00:00" }),
    // Preparation spending for next summer's race.
    named("B27", "BBL 2027", { peak_date: "2026-09-15T00:00:00.000+00:00" }),
  ];

  it("a BBL receipt in September after a summer race suggests next year", () => {
    const timing = editionTiming({
      editions: bbl,
      receiptDate: "2026-09-20",
      series: "bbl",
    });
    expect(timing.editions).toEqual([
      {
        eventDate: "2025-06-13",
        eventDateSource: "bookings",
        name: "BBL 2025",
        projectId: "B25",
        year: 2025,
      },
      {
        eventDate: "2026-06-13",
        eventDateSource: "bookings",
        name: "BBL 2026",
        projectId: "B26",
        year: 2026,
      },
      {
        eventDate: "2027-06-13",
        eventDateSource: "bookings",
        name: "BBL 2027",
        projectId: "B27",
        year: 2027,
      },
    ]);
    expect(timing.suggested).toBe("B27");
    expect(timing.recentlyHeld).toBeNull();
    expect(timing.missing).toBeNull();
  });

  it("a future edition's own preparation peak is not its event date", () => {
    const timing = editionTiming({
      editions: bbl,
      receiptDate: "2026-09-20",
      series: "bbl",
    });
    const next = timing.editions.find((e) => e.projectId === "B27");
    expect(next?.eventDate).not.toBe("2026-09-15");
    expect(next?.eventDate?.startsWith("2027-")).toBe(true);
    // Under the wrong rule every edition would be past, and 2028 "missing".
    expect(timing.missing).toBeNull();
  });

  it("a future edition's preparation peak is unused when past editions have no bookings", () => {
    const timing = editionTiming({
      editions: [
        named("W26", "Wintergames 2026"),
        named("W27", "Wintergames 2027", {
          peak_date: "2026-10-01T00:00:00.000+00:00",
        }),
      ],
      receiptDate: "2026-11-05",
      series: "wintergames",
    });
    expect(timing.editions.map((e) => e.eventDate)).toEqual([null, null]);
    expect(timing.suggested).toBeNull();
    expect(timing.missing).toBeNull();
  });

  it("with one edition, its peak's day of the year is placed in its own year", () => {
    // A December peak before a January event must not make KD 2027 look held.
    const timing = editionTiming({
      editions: [
        named("K27", "KD 2027", {
          peak_date: "2026-12-15T00:00:00.000+00:00",
        }),
      ],
      receiptDate: "2026-12-20",
      series: "kd",
    });
    expect(timing.editions[0]?.eventDate).toBe("2027-12-15");
    expect(timing.suggested).toBe("K27");
    expect(timing.missing).toBeNull();
  });

  it("a receipt a week after the event is recently held", () => {
    const timing = editionTiming({
      editions: [
        named("W25", "Wintergames 2025", {
          peak_date: "2025-02-12T00:00:00.000+00:00",
        }),
        named("W26", "Wintergames 2026", {
          peak_date: "2026-02-10T00:00:00.000+00:00",
        }),
        named("W27", "Wintergames 2027", {
          peak_date: "2026-10-01T00:00:00.000+00:00",
        }),
      ],
      receiptDate: "2026-02-18",
      series: "wintergames",
    });
    expect(timing.editions.find((e) => e.projectId === "W26")?.eventDate).toBe(
      "2026-02-11"
    );
    expect(timing.recentlyHeld).toBe("W26");
    expect(timing.suggested).toBe("W27");
    expect(timing.missing).toBeNull();
  });

  it("an event more than 30 days back is not recently held", () => {
    const timing = editionTiming({
      editions: [
        named("W26", "Wintergames 2026", {
          event_date: "2026-02-10T00:00:00.000+00:00",
        }),
        named("W27", "Wintergames 2027"),
      ],
      receiptDate: "2026-03-13",
      series: "wintergames",
    });
    expect(timing.recentlyHeld).toBeNull();

    const dayThirty = editionTiming({
      editions: [
        named("W26", "Wintergames 2026", {
          event_date: "2026-02-10T00:00:00.000+00:00",
        }),
      ],
      receiptDate: "2026-03-12",
      series: "wintergames",
    });
    expect(dayThirty.recentlyHeld).toBe("W26");
  });

  it("reports a missing next edition instead of last year's", () => {
    const timing = editionTiming({
      editions: [
        named("W26", "Wintergames 2026", {
          peak_date: "2026-02-10T00:00:00.000+00:00",
        }),
      ],
      receiptDate: "2026-11-05",
      series: "wintergames",
    });
    expect(timing.editions[0]?.eventDate).toBe("2026-02-10");
    expect(timing.suggested).toBeNull();
    expect(timing.recentlyHeld).toBeNull();
    expect(timing.missing).toEqual({ series: "wintergames", year: 2027 });
  });

  it("a receipt on the event day suggests that edition", () => {
    const timing = editionTiming({
      editions: [
        named("K26", "KD 2026", {
          event_date: "2026-02-04T00:00:00.000+00:00",
        }),
      ],
      receiptDate: "2026-02-04",
      series: "kd",
    });
    expect(timing.suggested).toBe("K26");
    expect(timing.recentlyHeld).toBeNull();
    expect(timing.missing).toBeNull();
  });

  it("finance's event date wins over the website and the bookings", () => {
    const timing = editionTiming({
      editions: [
        named("K25", "KD 2025", {
          peak_date: "2025-02-01T00:00:00.000+00:00",
        }),
        named("K26", "KD 2026", {
          event_date: "2026-03-03T00:00:00.000+00:00",
          peak_date: "2026-02-01T00:00:00.000+00:00",
        }),
      ],
      receiptDate: "2026-01-10",
      series: "kd",
      websiteEventDates: new Map([["K26", "2026-02-20"]]),
    });
    expect(timing.editions.find((e) => e.projectId === "K26")).toMatchObject({
      eventDate: "2026-03-03",
      eventDateSource: "finance",
    });
  });

  it("a website event wins over the bookings", () => {
    const timing = editionTiming({
      editions: [
        named("K25", "KD 2025", {
          peak_date: "2025-02-01T00:00:00.000+00:00",
        }),
        named("K26", "KD 2026", {
          peak_date: "2026-02-01T00:00:00.000+00:00",
        }),
      ],
      receiptDate: "2026-01-10",
      series: "kd",
      websiteEventDates: new Map([["K26", "2026-02-20T16:00:00.000+00:00"]]),
    });
    expect(timing.editions.find((e) => e.projectId === "K26")).toMatchObject({
      eventDate: "2026-02-20",
      eventDateSource: "website",
    });
  });

  it("a series held around new year keeps its date across the year change", () => {
    // Day-of-year 364 and 2 would average to midsummer; counted from each
    // edition's own 1 January they are -2 and +2, so the usual day is 1 Jan.
    const timing = editionTiming({
      editions: [
        named("N25", "Nyttårsball 2025", {
          peak_date: "2024-12-30T00:00:00.000+00:00",
        }),
        named("N26", "Nyttårsball 2026", {
          peak_date: "2026-01-03T00:00:00.000+00:00",
        }),
        named("N27", "Nyttårsball 2027", {
          peak_date: "2026-10-01T00:00:00.000+00:00",
        }),
      ],
      receiptDate: "2026-12-15",
      series: "nyttårsball",
    });
    expect(timing.editions.find((e) => e.projectId === "N27")?.eventDate).toBe(
      "2027-01-01"
    );
    expect(timing.suggested).toBe("N27");
  });

  it("the usual day is the median of past editions' peaks", () => {
    const timing = editionTiming({
      editions: [
        named("F23", "Fadderullan 2023", {
          peak_date: "2023-08-14T00:00:00.000+00:00",
        }),
        named("F24", "Fadderullan 2024", {
          peak_date: "2024-03-01T00:00:00.000+00:00",
        }),
        named("F25", "Fadderullan 2025", {
          peak_date: "2025-08-17T00:00:00.000+00:00",
        }),
        named("F26", "Fadderullan 2026"),
      ],
      receiptDate: "2026-05-01",
      series: "fadderullan",
    });
    // The middle of 14 Aug, 1 Mar and 17 Aug: the March outlier drops out.
    expect(timing.editions.find((e) => e.projectId === "F26")?.eventDate).toBe(
      "2026-08-14"
    );
    expect(timing.suggested).toBe("F26");
  });

  it("editions without a year get no event date", () => {
    const timing = editionTiming({
      editions: [
        named("L", "Landsmøte", {
          peak_date: "2026-03-10T00:00:00.000+00:00",
          series: "landsmøte",
        }),
      ],
      receiptDate: "2026-11-05",
      series: "landsmøte",
    });
    expect(timing.editions).toEqual([
      {
        eventDate: null,
        eventDateSource: null,
        name: "Landsmøte",
        projectId: "L",
        year: null,
      },
    ]);
    expect(timing.suggested).toBeNull();
    expect(timing.missing).toBeNull();
  });

  it("an inactive edition is never suggested, nor the one after it", () => {
    const timing = editionTiming({
      editions: [
        named("K26", "KD 2026", {
          active: false,
          event_date: "2026-02-04T00:00:00.000+00:00",
        }),
        named("K27", "KD 2027", {
          event_date: "2027-02-03T00:00:00.000+00:00",
        }),
      ],
      receiptDate: "2026-01-20",
      series: "kd",
    });
    expect(timing.suggested).toBeNull();
    expect(timing.missing).toBeNull();
  });

  it("an inactive edition is never recently held", () => {
    const timing = editionTiming({
      editions: [
        named("K26", "KD 2026", {
          active: false,
          event_date: "2026-02-04T00:00:00.000+00:00",
        }),
      ],
      receiptDate: "2026-02-10",
      series: "kd",
    });
    expect(timing.recentlyHeld).toBeNull();
  });

  it("a newest edition without a date is not reported missing", () => {
    const timing = editionTiming({
      editions: [
        named("W26", "Wintergames 2026", {
          event_date: "2026-02-10T00:00:00.000+00:00",
        }),
        named("W27", "Wintergames 2027"),
      ],
      receiptDate: "2026-11-05",
      series: "wintergames",
    });
    expect(
      timing.editions.find((e) => e.projectId === "W27")?.eventDate
    ).toBeNull();
    expect(timing.suggested).toBeNull();
    expect(timing.missing).toBeNull();
  });

  it("ignores editions of another series", () => {
    const timing = editionTiming({
      editions: [
        named("K26", "KD 2026", {
          event_date: "2026-02-04T00:00:00.000+00:00",
        }),
        named("B27", "BBL 2027", {
          event_date: "2027-06-13T00:00:00.000+00:00",
        }),
      ],
      receiptDate: "2026-03-01",
      series: "kd",
    });
    expect(timing.editions.map((e) => e.projectId)).toEqual(["K26"]);
    expect(timing.missing).toEqual({ series: "kd", year: 2027 });
  });
});

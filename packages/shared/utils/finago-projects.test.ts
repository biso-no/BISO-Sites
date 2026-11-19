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
  nameMonth,
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
    projectName: null,
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
    ["KD (2026)", "kd", 2026],
    ["BBL-2026", "bbl", 2026],
    ["Wintergames 2026/2027", "wintergames", 2026],
    ["HR samling okt 2026", "hr samling", 2026],
    ["HR samling 2026 oktober", "hr samling", 2026],
    // "jul" is Christmas in Norwegian, never a month.
    ["BISO Jul 2026", "biso jul", 2026],
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

describe("nameMonth", () => {
  it.each([
    ["Landsmøte mars 2026", 3],
    ["HR samling 2026 oktober", 10],
    ["Academics samling oktober2026", 10],
    ["HR samling okt 2026", 10],
    ["Leader summit Oct. 2026", 10],
    ["Samling i september 2026 - External", 9],
    ["BISO Jul 2026", null],
    ["Wintergames 2027", null],
  ])("%s → %s", (name, month) => {
    expect(nameMonth(name)).toBe(month);
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

  it("the later of two equally busy stretches wins", () => {
    const { projects } = aggregateUsage([
      line({ amount: 400, date: "2026-02-10" }),
      line({ amount: 400, date: "2026-08-10" }),
    ]);
    expect(projects.get("P1")?.peakDate).toBe("2026-08-10");
  });

  it("a later stretch at least half as busy as the busiest is the peak", () => {
    // Spring preparations, then the autumn event.
    const { projects } = aggregateUsage([
      line({ amount: 1000, date: "2026-03-10" }),
      line({ amount: 500, date: "2026-09-20" }),
      line({ amount: 50, date: "2026-11-01" }),
    ]);
    expect(projects.get("P1")?.peakDate).toBe("2026-09-20");
  });

  it("a later stretch under half the busiest is not the peak", () => {
    const { projects } = aggregateUsage([
      line({ amount: 1000, date: "2026-03-10" }),
      line({ amount: 499, date: "2026-09-20" }),
    ]);
    expect(projects.get("P1")?.peakDate).toBe("2026-03-10");
  });

  it("the peak of the last big stretch is its busiest two weeks", () => {
    const { projects } = aggregateUsage([
      line({ amount: 1000, date: "2026-03-10" }),
      line({ amount: 300, date: "2026-09-01" }),
      line({ amount: 900, date: "2026-09-20" }),
      line({ amount: 300, date: "2026-10-20" }),
    ]);
    expect(projects.get("P1")?.peakDate).toBe("2026-09-20");
  });

  it("with the year known, only lines in the edition's own window make the peak", () => {
    const lines = [
      line({ amount: 1000, date: "2025-03-01" }),
      // A large late invoice the year after.
      line({ amount: 5000, date: "2026-02-01" }),
    ];
    expect(aggregateUsage(lines).projects.get("P1")?.peakDate).toBe(
      "2026-02-01"
    );
    const { projects } = aggregateUsage(lines, () => 2025);
    expect(projects.get("P1")).toEqual({
      firstLineDate: "2025-03-01",
      lastLineDate: "2026-02-01",
      lineCount: 2,
      peakDate: "2025-03-01",
    });
  });

  it("an edition's window starts 1 July the year before", () => {
    const { projects } = aggregateUsage(
      [
        line({ amount: 900, date: "2025-06-20" }),
        line({ amount: 100, date: "2025-07-10" }),
      ],
      () => 2026
    );
    expect(projects.get("P1")?.peakDate).toBe("2025-07-10");
  });

  it("with no lines in its own window, all lines make the peak", () => {
    const { projects } = aggregateUsage(
      [line({ amount: 500, date: "2026-03-01" })],
      () => 2028
    );
    expect(projects.get("P1")?.peakDate).toBe("2026-03-01");
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

  it("with no usable past, a future edition's preparation peak is placed in its own year", () => {
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
    expect(timing.editions.find((e) => e.projectId === "W27")?.eventDate).toBe(
      "2027-10-01"
    );
    expect(timing.suggested).toBe("W27");
    expect(timing.missing).toBeNull();
  });

  it("an old edition without lines does not block the newest edition's own peak", () => {
    const timing = editionTiming({
      editions: [
        named("B18", "Ball 18"),
        named("B26", "Ball 2026", {
          peak_date: "2026-04-20T00:00:00.000+00:00",
        }),
      ],
      receiptDate: "2026-11-19",
      series: "ball",
    });
    expect(timing.editions.find((e) => e.projectId === "B26")?.eventDate).toBe(
      "2026-04-20"
    );
    expect(timing.suggested).toBeNull();
    expect(timing.missing).toEqual({ series: "ball", year: 2027 });
  });

  it.each([
    "2026-05-10",
    "2026-11-19",
  ])("a past edition's peak outside its own year is ignored (receipt %s)", (receiptDate) => {
    // Real Landsmøte history with the months taken out of the names: the
    // 2021 project got 4 stray lines in March 2026, and the 2024 edition
    // only has late invoices around new year.
    const timing = editionTiming({
      editions: [
        named("48", "Landsmøte 2021", {
          line_count: 4,
          peak_date: "2026-03-23T00:00:00.000+00:00",
        }),
        named("87", "Landsmøte 2024", {
          line_count: 4,
          peak_date: "2025-01-15T00:00:00.000+00:00",
        }),
        named("110", "Landsmøte 2025", {
          line_count: 155,
          peak_date: "2025-03-05T00:00:00.000+00:00",
        }),
        named("124", "Landsmøte 2026", {
          line_count: 151,
          peak_date: "2026-03-05T00:00:00.000+00:00",
        }),
      ],
      receiptDate,
      series: "landsmøte",
    });
    expect(timing.editions.find((e) => e.projectId === "124")?.eventDate).toBe(
      "2026-03-05"
    );
    expect(timing.suggested).toBeNull();
    expect(timing.missing).toEqual({ series: "landsmøte", year: 2027 });
  });

  it.each([
    "2026-05-10",
    "2026-11-19",
  ])("Landsmøte as named in Finago is held in March (receipt %s)", (receiptDate) => {
    const timing = editionTiming({
      editions: [
        named("48", "Landsmøte 2021", {
          line_count: 4,
          peak_date: "2026-03-23T00:00:00.000+00:00",
        }),
        named("87", "Landsmøte mars 2024", {
          line_count: 4,
          peak_date: "2024-12-25T00:00:00.000+00:00",
        }),
        named("110", "Landsmøte mars 2025", {
          line_count: 155,
          peak_date: "2025-03-05T00:00:00.000+00:00",
        }),
        named("124", "Landsmøte mars 2026", {
          line_count: 151,
          peak_date: "2026-03-05T00:00:00.000+00:00",
        }),
      ],
      receiptDate,
      series: "landsmøte",
    });
    expect(timing.suggested).toBeNull();
    expect(timing.missing).toEqual({ series: "landsmøte", year: 2027 });
  });

  it("one 4-line stray doesn't move the estimate", () => {
    const timing = editionTiming({
      editions: [
        named("F24", "Fadderullan 2024", {
          line_count: 4,
          peak_date: "2024-12-20T00:00:00.000+00:00",
        }),
        named("F25", "Fadderullan 2025", {
          line_count: 258,
          peak_date: "2025-08-12T00:00:00.000+00:00",
        }),
        named("F26", "Fadderullan 2026", { line_count: 320 }),
      ],
      receiptDate: "2026-05-01",
      series: "fadderullan",
    });
    expect(timing.editions.find((e) => e.projectId === "F26")?.eventDate).toBe(
      "2026-08-12"
    );
  });

  it("a past edition's finance date drives the estimate", () => {
    const timing = editionTiming({
      editions: [
        named("K25", "KD 2025", {
          event_date: "2025-02-20T00:00:00.000+00:00",
          // Preparation spending before the event.
          peak_date: "2024-12-01T00:00:00.000+00:00",
        }),
        named("K26", "KD 2026"),
      ],
      receiptDate: "2026-01-10",
      series: "kd",
    });
    expect(timing.editions.find((e) => e.projectId === "K26")).toMatchObject({
      eventDate: "2026-02-20",
      eventDateSource: "bookings",
    });
    expect(timing.suggested).toBe("K26");
  });

  it("a month in the name tells two editions of one year apart", () => {
    const timing = editionTiming({
      editions: [
        named("H3", "HR samling mars 2026"),
        named("H4", "HR samling 2026 oktober"),
      ],
      receiptDate: "2026-09-01",
      series: "hr samling",
    });
    expect(timing.editions).toEqual([
      {
        eventDate: "2026-03-15",
        eventDateSource: "name",
        name: "HR samling mars 2026",
        projectId: "H3",
        year: 2026,
      },
      {
        eventDate: "2026-10-15",
        eventDateSource: "name",
        name: "HR samling 2026 oktober",
        projectId: "H4",
        year: 2026,
      },
    ]);
    expect(timing.suggested).toBe("H4");
    expect(timing.missing).toBeNull();
  });

  it("the name's month wins over the bookings, a website date over the name", () => {
    const timing = editionTiming({
      editions: [
        named("L25", "Landsmøte mars 2025", {
          peak_date: "2025-03-05T00:00:00.000+00:00",
        }),
        named("L26", "Landsmøte mars 2026", {
          peak_date: "2026-02-01T00:00:00.000+00:00",
        }),
      ],
      receiptDate: "2026-01-10",
      series: "landsmøte",
      websiteEventDates: new Map([["L25", "2025-03-08"]]),
    });
    expect(
      timing.editions.map((e) => [e.eventDate, e.eventDateSource])
    ).toEqual([
      ["2025-03-08", "website"],
      ["2026-03-15", "name"],
    ]);
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
    expect(timing.inactiveNext).toBe("K26");
    expect(timing.missing).toBeNull();
  });

  it("an active next edition is not reported as closed", () => {
    const timing = editionTiming({
      editions: [
        named("K26", "KD 2026", {
          event_date: "2026-02-04T00:00:00.000+00:00",
        }),
      ],
      receiptDate: "2026-01-20",
      series: "kd",
    });
    expect(timing.suggested).toBe("K26");
    expect(timing.inactiveNext).toBeNull();
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
        // Dated but without a year, so it says nothing about other years.
        named("WX", "Wintergames", {
          event_date: "2026-02-10T00:00:00.000+00:00",
          series: "wintergames",
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

describe("editionTiming's missing year", () => {
  it("is the first year whose event is still to come", () => {
    const editions = [
      named("121", "Business og projects samling 2025", {
        line_count: 40,
        peak_date: "2025-08-29T00:00:00.000+00:00",
      }),
    ];
    const series = "business og projects samling";
    // The 2026 gathering would have been in August, so it is 2027's turn.
    expect(
      editionTiming({ editions, receiptDate: "2026-11-19", series }).missing
    ).toEqual({ series, year: 2027 });
    expect(
      editionTiming({ editions, receiptDate: "2026-03-01", series }).missing
    ).toEqual({ series, year: 2026 });
  });

  it("follows an edition dated by the month in its name", () => {
    const timing = editionTiming({
      editions: [named("T25", "TRD Tivoli Studentfestival august 2025")],
      receiptDate: "2026-11-19",
      series: "trd tivoli studentfestival",
    });
    expect(timing.missing).toEqual({
      series: "trd tivoli studentfestival",
      year: 2027,
    });
  });

  it("follows the latest of two editions in the newest year", () => {
    const timing = editionTiming({
      editions: [
        named("H3", "HR samling mars 2026"),
        named("H4", "HR samling 2026 oktober"),
      ],
      receiptDate: "2026-11-19",
      series: "hr samling",
    });
    expect(timing.missing).toEqual({ series: "hr samling", year: 2027 });
  });
});

/** `YYYY-MM-DD amount` pairs, comma-separated, as one cost line each. */
function dailyLines(projectId: string, days: string): CostLine[] {
  return days.split(",").map((pair) => {
    const [date, amount] = pair.trim().split(" ");
    return line({ amount: Number(amount), date, projectId });
  });
}

// KD's real bookings in Finago (read 2026-11-19), summed per day and rounded
// to 100 kr. KD spends twice a year: spring, then the autumn event.
const KD_2024 =
  "2024-11-27 3600, 2024-12-31 6000, 2025-07-01 300, 2025-12-31 1900";
const KD_2025 = `
  2024-11-30 1400, 2024-12-19 5900, 2024-12-31 36000, 2025-01-21 10400,
  2025-01-23 1700, 2025-01-30 2500, 2025-01-31 8200, 2025-02-01 72300,
  2025-02-05 24900, 2025-02-06 200, 2025-02-07 200, 2025-02-13 100,
  2025-02-28 6200, 2025-03-01 299300, 2025-03-04 200, 2025-03-05 500,
  2025-03-07 19700, 2025-03-10 1500, 2025-03-11 4000, 2025-03-12 66800,
  2025-03-19 83800, 2025-03-21 5300, 2025-03-24 5000, 2025-03-28 7000,
  2025-03-31 3900, 2025-04-02 12900, 2025-04-03 2900, 2025-04-10 502800,
  2025-04-11 22900, 2025-05-13 6300, 2025-05-22 8700, 2025-06-07 6700,
  2025-06-13 26700, 2025-08-02 200, 2025-08-12 54300, 2025-08-13 16100,
  2025-08-20 1300, 2025-08-27 6800, 2025-08-31 3500, 2025-09-04 16500,
  2025-09-05 21400, 2025-09-12 6200, 2025-09-13 5200, 2025-09-14 8400,
  2025-09-15 5200, 2025-09-16 9000, 2025-09-17 7700, 2025-09-18 3600,
  2025-09-19 8500, 2025-09-21 2000, 2025-09-22 7400, 2025-09-23 4500,
  2025-09-24 24200, 2025-09-25 14000, 2025-09-30 341300, 2025-10-04 32300,
  2025-10-05 1600, 2025-10-08 1600, 2025-10-16 1200, 2025-10-19 600,
  2025-10-21 600, 2025-10-27 30000, 2025-11-15 1200, 2026-03-06 1300`;
const KD_2026 = `
  2025-08-25 3900, 2025-09-01 2100, 2025-09-17 13500, 2025-09-18 500,
  2025-10-02 100, 2025-10-16 600, 2025-10-20 600, 2025-10-23 600,
  2025-10-31 6900, 2025-11-20 1600, 2025-12-17 15400, 2025-12-27 13500,
  2026-01-20 700, 2026-01-23 7900, 2026-01-31 1400, 2026-02-02 100,
  2026-02-03 24500, 2026-02-04 12800, 2026-02-05 1100, 2026-02-06 2600,
  2026-02-07 12200, 2026-02-13 2000, 2026-02-14 500, 2026-02-23 3700,
  2026-02-24 5800, 2026-02-26 5400, 2026-02-27 8600, 2026-02-28 3400,
  2026-03-01 53400, 2026-03-03 200, 2026-03-04 900, 2026-03-05 4600,
  2026-03-06 39800, 2026-03-07 200, 2026-03-08 1300, 2026-03-09 1000,
  2026-03-10 4600, 2026-03-11 5000, 2026-03-16 4800, 2026-03-18 302600,
  2026-03-19 204600, 2026-03-20 11100, 2026-03-21 9100, 2026-03-22 700,
  2026-03-25 52200, 2026-03-26 25200, 2026-03-30 9500, 2026-03-31 64800,
  2026-04-16 200, 2026-04-17 3000, 2026-04-25 100, 2026-04-30 2600,
  2026-05-25 100, 2026-05-31 1200, 2026-06-08 20000, 2026-06-25 100,
  2026-07-25 100, 2026-08-25 100, 2026-08-26 1400, 2026-08-29 8100,
  2026-08-31 500, 2026-09-01 47300, 2026-09-02 1300, 2026-09-03 5400,
  2026-09-10 11200, 2026-09-14 1300, 2026-09-16 23600, 2026-09-17 8500,
  2026-09-18 4200, 2026-09-21 12800, 2026-09-22 7100, 2026-09-23 5700,
  2026-09-24 47600, 2026-09-25 21100, 2026-09-28 407600, 2026-09-29 7500,
  2026-09-30 174700, 2026-10-01 89000, 2026-10-05 2500, 2026-10-14 1000,
  2026-10-25 100, 2026-10-26 32300, 2026-10-30 29600`;

describe("KD's real bookings, two peaks a year", () => {
  const booked = new Map([
    ["84", "KD 2024"],
    ["106", "KD 2025"],
    ["122", "KD 2026"],
  ]);
  const { projects: stats } = aggregateUsage(
    [
      ...dailyLines("84", KD_2024),
      ...dailyLines("106", KD_2025),
      ...dailyLines("122", KD_2026),
    ],
    (projectId) => parseProjectName(booked.get(projectId) ?? "").year
  );
  const editions = [
    // Older editions are in Finago without lines in the last 24 months.
    ...["2018", "2019", "2020", "2021", "2022", "2023"].map((year) =>
      named(`K${year}`, `KD ${year}`)
    ),
    ...[...booked].map(([projectId, name]) => {
      const s = stats.get(projectId);
      return named(projectId, name, {
        first_line_date: s?.firstLineDate ?? null,
        last_line_date: s?.lastLineDate ?? null,
        line_count: s?.lineCount ?? 0,
        peak_date: s?.peakDate ?? null,
      });
    }),
  ];

  it("KD 2025's event is its autumn peak, not the bigger spring one", () => {
    expect(stats.get("106")?.peakDate).toBe("2025-09-28");
  });

  it("a receipt in mid-September belongs to KD 2026", () => {
    const timing = editionTiming({
      editions,
      receiptDate: "2026-09-15",
      series: "kd",
    });
    expect(timing.editions.find((e) => e.projectId === "122")).toMatchObject({
      eventDate: "2026-09-28",
      eventDateSource: "bookings",
    });
    expect(timing.suggested).toBe("122");
    expect(timing.missing).toBeNull();
  });

  it("a receipt in November reports KD 2027 missing", () => {
    const timing = editionTiming({
      editions,
      receiptDate: "2026-11-19",
      series: "kd",
    });
    expect(timing.suggested).toBeNull();
    expect(timing.recentlyHeld).toBeNull();
    expect(timing.missing).toEqual({ series: "kd", year: 2027 });
  });
});

/**
 * Finago projects: the series and year in a project's name, the booking
 * history behind each project, which projects a department picks from, and
 * which edition of a series a receipt belongs to. Pure functions; the project
 * sync and the expense check call them.
 *
 * Dates are ISO strings. Only the `YYYY-MM-DD` part counts, as a UTC day, so
 * Finago line dates and Appwrite datetimes compare alike.
 */

import type {
  FinagoProjects,
  FinagoProjectUsage,
} from "@repo/api/types/appwrite";
import type { CostLine } from "@repo/connectors/24sevenoffice";

const DAY_MS = 86_400_000;
const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})/;

/** Days since 1970-01-01 (UTC) of an ISO date or datetime; null if it isn't one. */
function dayNumber(iso: string | null | undefined): number | null {
  const match = iso ? ISO_DAY.exec(iso) : null;
  if (!match) {
    return null;
  }
  const [, year, month, day] = match;
  return Date.UTC(Number(year), Number(month) - 1, Number(day)) / DAY_MS;
}

function requireDay(iso: string, label: string): number {
  const day = dayNumber(iso);
  if (day === null) {
    throw new Error(`${label} must be an ISO date, got "${iso}"`);
  }
  return day;
}

function isoDay(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

/** Day number of 1 January of a year. */
function newYear(year: number): number {
  return Date.UTC(year, 0, 1) / DAY_MS;
}

// --- Names ------------------------------------------------------------------

const FOUR_DIGIT_YEAR = /(?<!\d)(?:19|20)\d{2}(?!\d)/;
const TWO_DIGITS = /^\d{2}$/;
const SEPARATOR_ONLY = /^[-–—_/,.:;|]+$/;
const WHITESPACE = /\s+/;
const TWO_DIGIT_CENTURY = 2000;

const MONTH_WORDS = new Set([
  // Norwegian
  "januar",
  "februar",
  "mars",
  "april",
  "mai",
  "juni",
  "juli",
  "august",
  "september",
  "oktober",
  "november",
  "desember",
  // English (the rest are spelt the same)
  "january",
  "february",
  "march",
  "may",
  "june",
  "july",
  "october",
  "december",
]);

export interface ParsedProjectName {
  series: string;
  year: number | null;
}

function words(text: string): string[] {
  return text.split(WHITESPACE).filter((word) => word.length > 0);
}

/**
 * The series left once the year is gone: month words and lone separators
 * dropped. A name that is nothing but a month (or a year) keeps what it has.
 */
function seriesFrom(rest: string, whole: string): string {
  const kept = words(rest).filter((word) => !SEPARATOR_ONLY.test(word));
  const withoutMonths = kept.filter((word) => !MONTH_WORDS.has(word));
  if (withoutMonths.length > 0) {
    return withoutMonths.join(" ");
  }
  return kept.length > 0 ? kept.join(" ") : whole;
}

/**
 * Series and year from a Finago project name. The year is a 4-digit 19xx/20xx
 * anywhere (also glued to a month: `oktober2026`), else a final 2-digit word
 * when the name has at least two words (`Fadderullan 17` → 2017). The series
 * is the lowercased name without the year and month words.
 */
export function parseProjectName(name: string): ParsedProjectName {
  const all = words(name.normalize("NFC").toLowerCase());
  const text = all.join(" ");

  const fourDigit = FOUR_DIGIT_YEAR.exec(text);
  if (fourDigit) {
    return {
      series: seriesFrom(text.replace(FOUR_DIGIT_YEAR, " "), text),
      year: Number(fourDigit[0]),
    };
  }

  const last = all.at(-1);
  if (all.length >= 2 && last && TWO_DIGITS.test(last)) {
    return {
      series: seriesFrom(all.slice(0, -1).join(" "), text),
      year: TWO_DIGIT_CENTURY + Number(last),
    };
  }

  return { series: seriesFrom(text, text), year: null };
}

/** A project row's series, parsed from its name if the row has none yet. */
function seriesOf(project: FinagoProjects): string {
  return project.series ?? parseProjectName(project.name).series;
}

// --- Usage ------------------------------------------------------------------

/** Days in the stretch whose spending decides a project's peak. */
const PEAK_WINDOW_DAYS = 14;
/** The middle day of the stretch: its 8th day. */
const PEAK_MIDDLE = 7;
const CENTS = 100;

export interface ProjectStats {
  firstLineDate: string;
  lastLineDate: string;
  lineCount: number;
  /** Middle day of the busiest 14 days by amount; null when nothing moved. */
  peakDate: string | null;
}

export interface UsageStats {
  departmentId: string;
  firstLineDate: string;
  lastLineDate: string;
  lineCount: number;
  projectId: string;
}

export interface DepartmentShare {
  total: number;
  withProject: number;
}

export interface UsageSummary {
  departmentShare: Map<string, DepartmentShare>;
  /** Keyed by project id. */
  projects: Map<string, ProjectStats>;
  /** Keyed by `usageKey(projectId, departmentId)`. */
  usage: Map<string, UsageStats>;
}

export function usageKey(projectId: string, departmentId: string): string {
  return `${projectId}|${departmentId}`;
}

interface DatedAmount {
  amount: number;
  day: number;
}

/**
 * The middle day of the 14-day window with the largest sum of absolute
 * amounts. Every window start is tried (in whole øre, so ties are exact).
 * When neighbouring windows tie (one big day sits in 14 of them), the middle
 * of that run is taken, so a single busy day is its own peak; between
 * separate equally busy stretches the earliest wins.
 */
function peakDay(lines: DatedAmount[]): number | null {
  const perDay = new Map<number, number>();
  for (const { amount, day } of lines) {
    const cents = Math.round(Math.abs(amount) * CENTS);
    perDay.set(day, (perDay.get(day) ?? 0) + cents);
  }
  const days = [...perDay.keys()];
  const first = Math.min(...days);
  const last = Math.max(...days);

  let sum = 0;
  let best = 0;
  let runStart = first;
  let runEnd = first;
  let inBestRun = false;
  for (let start = first - PEAK_WINDOW_DAYS + 1; start <= last; start += 1) {
    sum += perDay.get(start + PEAK_WINDOW_DAYS - 1) ?? 0;
    sum -= perDay.get(start - 1) ?? 0;
    if (sum > best) {
      best = sum;
      runStart = start;
      runEnd = start;
      inBestRun = true;
    } else if (inBestRun && sum === best) {
      runEnd = start;
    } else {
      inBestRun = false;
    }
  }
  if (best === 0) {
    return null;
  }
  return Math.floor((runStart + runEnd) / 2) + PEAK_MIDDLE;
}

function projectStats(lines: DatedAmount[]): ProjectStats {
  const days = lines.map((line) => line.day);
  const peak = peakDay(lines);
  return {
    firstLineDate: isoDay(Math.min(...days)),
    lastLineDate: isoDay(Math.max(...days)),
    lineCount: lines.length,
    peakDate: peak === null ? null : isoDay(peak),
  };
}

function countDepartment(
  shares: Map<string, DepartmentShare>,
  departmentId: string,
  hasProject: boolean
): void {
  const share = shares.get(departmentId) ?? { total: 0, withProject: 0 };
  share.total += 1;
  if (hasProject) {
    share.withProject += 1;
  }
  shares.set(departmentId, share);
}

function countUsage(
  usage: Map<string, UsageStats>,
  projectId: string,
  departmentId: string,
  date: string
): void {
  const key = usageKey(projectId, departmentId);
  const row = usage.get(key);
  if (!row) {
    usage.set(key, {
      departmentId,
      firstLineDate: date,
      lastLineDate: date,
      lineCount: 1,
      projectId,
    });
    return;
  }
  row.lineCount += 1;
  if (date < row.firstLineDate) {
    row.firstLineDate = date;
  }
  if (date > row.lastLineDate) {
    row.lastLineDate = date;
  }
}

/**
 * Per project: line count, first/last line and peak date. Per project and
 * department: line count and first/last line. Per department: lines in all
 * and lines with a project (its project share). Lines without a department
 * count for their project only; lines without a valid date are skipped.
 */
export function aggregateUsage(lines: CostLine[]): UsageSummary {
  const perProject = new Map<string, DatedAmount[]>();
  const usage = new Map<string, UsageStats>();
  const departmentShare = new Map<string, DepartmentShare>();

  for (const line of lines) {
    const day = dayNumber(line.date);
    if (day === null) {
      continue;
    }
    const { departmentId, projectId } = line;
    if (departmentId) {
      countDepartment(departmentShare, departmentId, Boolean(projectId));
    }
    if (!projectId) {
      continue;
    }
    const dated = perProject.get(projectId) ?? [];
    dated.push({ amount: line.amount, day });
    perProject.set(projectId, dated);
    if (departmentId) {
      countUsage(usage, projectId, departmentId, isoDay(day));
    }
  }

  const projects = new Map<string, ProjectStats>();
  for (const [projectId, dated] of perProject) {
    projects.set(projectId, projectStats(dated));
  }
  return { departmentShare, projects, usage };
}

// --- Project share ----------------------------------------------------------

/** Share of a department's cost lines with a project from which it is expected. */
export const EXPECTED_PROJECT_SHARE = 0.8;
/** Share from which a department sometimes books on a project. */
export const SOMETIMES_PROJECT_SHARE = 0.2;

export type ProjectShareClass = "expected" | "sometimes" | "rare";

export function shareClass(share: number | null): ProjectShareClass {
  if (share === null) {
    return "rare";
  }
  if (share >= EXPECTED_PROJECT_SHARE) {
    return "expected";
  }
  if (share >= SOMETIMES_PROJECT_SHARE) {
    return "sometimes";
  }
  return "rare";
}

// --- Candidates -------------------------------------------------------------

/** How far back a department's use of a project makes it a candidate. */
export const CANDIDATE_HISTORY_MONTHS = 24;

function monthsBefore(today: string, months: number): string {
  const [, year, month, day] = ISO_DAY.exec(today) ?? [];
  if (!(year && month && day)) {
    throw new Error(`today must be an ISO date, got "${today}"`);
  }
  const then = Date.UTC(Number(year), Number(month) - 1 - months, Number(day));
  return isoDay(then / DAY_MS);
}

/**
 * The projects a department picks from: active projects it booked on in the
 * last 24 months, plus active projects of the same series with a higher year
 * than any it used (next year's edition before it has lines). Never inactive.
 */
export function departmentCandidates(input: {
  departmentId: string;
  projects: FinagoProjects[];
  today: string;
  usage: FinagoProjectUsage[];
}): FinagoProjects[] {
  const cutoff = monthsBefore(input.today, CANDIDATE_HISTORY_MONTHS);
  const used = new Set(
    input.usage
      .filter(
        (row) =>
          row.department_id === input.departmentId &&
          (row.last_line_date?.slice(0, 10) ?? "") >= cutoff
      )
      .map((row) => row.project_id)
  );

  const newestUsedYear = new Map<string, number>();
  for (const project of input.projects) {
    if (!used.has(project.project_id) || project.year === null) {
      continue;
    }
    const series = seriesOf(project);
    const newest = newestUsedYear.get(series) ?? project.year;
    newestUsedYear.set(series, Math.max(newest, project.year));
  }

  const isNewerEdition = (project: FinagoProjects): boolean => {
    const newest = newestUsedYear.get(seriesOf(project));
    return (
      newest !== undefined && project.year !== null && project.year > newest
    );
  };

  return input.projects.filter(
    (project) =>
      project.active &&
      (used.has(project.project_id) || isNewerEdition(project))
  );
}

// --- Edition timing ---------------------------------------------------------

/** Days after an event in which a receipt may still be an after-event cost. */
export const RECENTLY_HELD_DAYS = 30;

export type EventDateSource = "finance" | "website" | "bookings";

export interface EditionTiming {
  eventDate: string | null;
  eventDateSource: EventDateSource | null;
  name: string;
  projectId: string;
  year: number | null;
}

export interface SeriesTiming {
  editions: EditionTiming[];
  /** Next year's edition, when the receipt is after every edition and it isn't in Finago yet. */
  missing: { series: string; year: number } | null;
  /** An active edition held within 30 days before the receipt. */
  recentlyHeld: string | null;
  /** The active edition with the earliest event date on or after the receipt. */
  suggested: string | null;
}

function median(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[middle] ?? null;
  }
  return Math.round(((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2);
}

/**
 * The series' usual event day, as days from 1 January of an edition's year.
 *
 * From past editions (year below the newest): the median of each one's peak
 * counted from 1 January of its own year. Counting from the edition's year
 * rather than the peak's keeps a series held around new year together (a
 * peak on 30 Dec before the 2025 edition is -2, one on 3 Jan 2026 is +2).
 * A future edition's own peak never counts: it is preparation spending.
 *
 * With one year only, there is no past: its peak's day of the year is placed
 * in its own year. If past editions exist but none has a peak, null.
 */
function usualEventDay(editions: FinagoProjects[]): number | null {
  const years = editions.flatMap((e) => (e.year === null ? [] : [e.year]));
  if (years.length === 0) {
    return null;
  }
  const newest = Math.max(...years);
  const past = editions.filter((e) => e.year !== null && e.year < newest);

  if (past.length > 0) {
    return median(
      past.flatMap((e) => {
        const peak = dayNumber(e.peak_date);
        return peak === null || e.year === null ? [] : [peak - newYear(e.year)];
      })
    );
  }
  return median(
    editions.flatMap((e) => {
      const peak = dayNumber(e.peak_date);
      if (peak === null) {
        return [];
      }
      return [peak - newYear(new Date(peak * DAY_MS).getUTCFullYear())];
    })
  );
}

function eventDateOf(
  edition: FinagoProjects,
  websiteEventDates: Map<string, string> | undefined,
  usualDay: number | null
): Pick<EditionTiming, "eventDate" | "eventDateSource"> {
  const finance = dayNumber(edition.event_date);
  if (finance !== null) {
    return { eventDate: isoDay(finance), eventDateSource: "finance" };
  }
  const website = dayNumber(websiteEventDates?.get(edition.project_id));
  if (website !== null) {
    return { eventDate: isoDay(website), eventDateSource: "website" };
  }
  if (edition.year !== null && usualDay !== null) {
    return {
      eventDate: isoDay(newYear(edition.year) + usualDay),
      eventDateSource: "bookings",
    };
  }
  return { eventDate: null, eventDateSource: null };
}

/** Oldest year first, editions without a year last. */
function byYear(a: FinagoProjects, b: FinagoProjects): number {
  if (a.year === b.year) {
    return 0;
  }
  if (a.year === null) {
    return 1;
  }
  if (b.year === null) {
    return -1;
  }
  return a.year - b.year;
}

interface TimedEdition {
  day: number | null;
  edition: FinagoProjects;
  timing: EditionTiming;
}

/** Next year's edition, if the receipt is past every edition of the newest year. */
function missingEdition(
  series: string,
  timed: TimedEdition[],
  receipt: number
): SeriesTiming["missing"] {
  const years = timed.flatMap((t) =>
    t.edition.year === null ? [] : [t.edition.year]
  );
  if (years.length === 0) {
    return null;
  }
  const newest = Math.max(...years);
  const newestHeld = timed
    .filter((t) => t.edition.year === newest)
    .every((t) => t.day !== null && t.day < receipt);
  return newestHeld ? { series, year: newest + 1 } : null;
}

/**
 * When each edition of a series is held, and which one a receipt belongs to.
 * Event date: finance's `event_date` > a website event > the series' usual
 * day placed in the edition's year (editions without a year get none).
 * A receipt belongs to the next edition not yet held on its date; an edition
 * held in the 30 days before is `recentlyHeld` (after-event costs, decided
 * from the receipt's content). If every edition is already held, next
 * year's edition is `missing` instead of last year's being suggested.
 * Inactive editions are never suggested or recently held.
 */
export function editionTiming(input: {
  editions: FinagoProjects[];
  receiptDate: string;
  series: string;
  websiteEventDates?: Map<string, string>;
}): SeriesTiming {
  const receipt = requireDay(input.receiptDate, "receiptDate");
  const editions = input.editions
    .filter((edition) => seriesOf(edition) === input.series)
    .sort(byYear);
  const usualDay = usualEventDay(editions);

  const timed: TimedEdition[] = editions.map((edition) => {
    const timing: EditionTiming = {
      name: edition.name,
      projectId: edition.project_id,
      year: edition.year,
      ...eventDateOf(edition, input.websiteEventDates, usualDay),
    };
    return { day: dayNumber(timing.eventDate), edition, timing };
  });

  const upcoming = timed
    .filter((t) => t.day !== null && t.day >= receipt)
    .sort((a, b) => (a.day ?? 0) - (b.day ?? 0));
  const next = upcoming[0];

  const justHeld = timed
    .filter(
      (t) =>
        t.day !== null &&
        t.day < receipt &&
        receipt - t.day <= RECENTLY_HELD_DAYS
    )
    .sort((a, b) => (b.day ?? 0) - (a.day ?? 0))[0];

  return {
    editions: timed.map((t) => t.timing),
    missing:
      upcoming.length === 0
        ? missingEdition(input.series, timed, receipt)
        : null,
    recentlyHeld: justHeld?.edition.active ? justHeld.edition.project_id : null,
    suggested: next?.edition.active ? next.edition.project_id : null,
  };
}

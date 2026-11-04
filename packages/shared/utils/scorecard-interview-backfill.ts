import { Query } from "@repo/api";
import { errorMessage, scanTable } from "./table-scan";

/**
 * Sets the `interview` relationship on interview scorecards that only carry
 * `interview_id`. Scorecards written before the relationship was set are not
 * removed with their interview or application by the retention cleanup, which
 * relies on the relationship's cascade.
 *
 * Two phases: job_interviews and job_interview_scorecards are scanned
 * read-only first; nothing is written if either scan failed. A scorecard whose
 * `interview_id` matches no interview is reported as an orphan and is never
 * changed or deleted; remove those by hand.
 */

export interface ScorecardLink {
  interviewId: string;
  scorecardId: string;
}

export interface ScorecardOrphan {
  interviewId: string;
  scorecardId: string;
}

export interface ScorecardBackfillReport {
  applied: number;
  errors: { message: string; rowId?: string; tableId?: string }[];
  links: ScorecardLink[];
  orphans: ScorecardOrphan[];
  /** True when a scan failed; nothing is written in that case. */
  scanFailed: boolean;
  scanned: { interviews: number; scorecards: number };
}

interface BackfillRow {
  $id: string;
  [key: string]: unknown;
}

/** Minimal slice of `TablesDB`, structurally satisfied by the real client. */
export interface ScorecardBackfillDb {
  listRows(params: {
    databaseId: string;
    tableId: string;
    queries?: string[];
  }): Promise<{ rows: BackfillRow[] }>;
  updateRow(params: {
    databaseId: string;
    tableId: string;
    rowId: string;
    data?: Record<string, unknown>;
  }): Promise<unknown>;
}

const DATABASE_ID = "app";
const INTERVIEWS = "job_interviews";
const SCORECARDS = "job_interview_scorecards";

// The relationship is selected explicitly: Appwrite does not return it unless
// asked, and a scorecard that is already linked must not be planned again.
const INTERVIEW_COLUMNS = [Query.select(["$id"])];
const SCORECARD_COLUMNS = [
  Query.select(["$id", "interview_id", "interview.$id"]),
];

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** The relationship can come back as an id or as a row carrying `$id`. */
function hasRelationship(value: unknown): boolean {
  if (typeof value === "string") {
    return value.length > 0;
  }
  if (typeof value === "object" && value !== null) {
    return asString((value as { $id?: unknown }).$id).length > 0;
  }
  return false;
}

/** Phase 1: read-only scan; computes links and orphans. */
async function scan(
  db: ScorecardBackfillDb,
  report: ScorecardBackfillReport
): Promise<void> {
  const interviewIds = new Set<string>();
  try {
    for await (const row of scanTable(db, INTERVIEWS, INTERVIEW_COLUMNS)) {
      report.scanned.interviews += 1;
      interviewIds.add(row.$id);
    }
  } catch (error) {
    report.errors.push({ tableId: INTERVIEWS, message: errorMessage(error) });
    return;
  }
  try {
    for await (const row of scanTable(db, SCORECARDS, SCORECARD_COLUMNS)) {
      report.scanned.scorecards += 1;
      const interviewId = asString(row.interview_id);
      if (!interviewIds.has(interviewId)) {
        report.orphans.push({ scorecardId: row.$id, interviewId });
        continue;
      }
      if (!hasRelationship(row.interview)) {
        report.links.push({ scorecardId: row.$id, interviewId });
      }
    }
  } catch (error) {
    report.errors.push({ tableId: SCORECARDS, message: errorMessage(error) });
  }
}

/** Phase 2: write the links; a failed update does not stop the rest. */
async function applyLinks(
  db: ScorecardBackfillDb,
  report: ScorecardBackfillReport
): Promise<void> {
  for (const { scorecardId, interviewId } of report.links) {
    try {
      await db.updateRow({
        databaseId: DATABASE_ID,
        tableId: SCORECARDS,
        rowId: scorecardId,
        data: { interview: interviewId },
      });
      report.applied += 1;
    } catch (error) {
      report.errors.push({ rowId: scorecardId, message: errorMessage(error) });
    }
  }
}

export async function backfillScorecardInterviews(
  db: ScorecardBackfillDb,
  options: { apply: boolean }
): Promise<ScorecardBackfillReport> {
  const report: ScorecardBackfillReport = {
    applied: 0,
    errors: [],
    links: [],
    orphans: [],
    scanFailed: false,
    scanned: { interviews: 0, scorecards: 0 },
  };
  await scan(db, report);
  report.scanFailed = report.errors.length > 0;
  // A partial interview list would make valid scorecards look orphaned, so
  // nothing is written unless both scans completed.
  if (options.apply && !report.scanFailed) {
    await applyLinks(db, report);
  }
  return report;
}

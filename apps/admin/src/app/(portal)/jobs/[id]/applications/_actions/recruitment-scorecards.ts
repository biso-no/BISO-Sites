import { Query } from "@repo/api";
import type { JobInterviewScorecards } from "@repo/api/types/appwrite";

const DATABASE_ID = "app";
const INTERVIEW_ID_CHUNK = 100;
const SCORECARD_PAGE_LIMIT = 500;

/** Minimal slice of the session `db` the loader needs. */
interface ScorecardDb {
  listRows<T extends { $id: string }>(
    databaseId: string,
    tableId: string,
    queries?: string[]
  ): Promise<{ rows: T[] }>;
}

/**
 * Loads scorecards for the given interviews by `interview_id` (indexed, and
 * independent of the `interview` relationship), grouped by application. A
 * failed chunk is logged and skipped so the board still renders.
 */
export async function loadScorecardsForInterviews(
  db: ScorecardDb,
  interviewIds: string[]
): Promise<Map<string, JobInterviewScorecards[]>> {
  const map = new Map<string, JobInterviewScorecards[]>();
  for (let i = 0; i < interviewIds.length; i += INTERVIEW_ID_CHUNK) {
    const chunk = interviewIds.slice(i, i + INTERVIEW_ID_CHUNK);
    try {
      let cursor: string | undefined;
      while (true) {
        const queries = [
          Query.equal("interview_id", chunk),
          Query.orderAsc("$id"),
          Query.limit(SCORECARD_PAGE_LIMIT),
        ];
        if (cursor) {
          queries.push(Query.cursorAfter(cursor));
        }
        const { rows } = await db.listRows<JobInterviewScorecards>(
          DATABASE_ID,
          "job_interview_scorecards",
          queries
        );
        for (const scorecard of rows) {
          const list = map.get(scorecard.application_id) ?? [];
          list.push(scorecard);
          map.set(scorecard.application_id, list);
        }
        if (rows.length < SCORECARD_PAGE_LIMIT) {
          break;
        }
        cursor = rows.at(-1)?.$id;
      }
    } catch (error) {
      console.error("Failed to load interview scorecards for the board", error);
    }
  }
  return map;
}

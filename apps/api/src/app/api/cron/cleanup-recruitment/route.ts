import { type Models, Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import {
  RECRUITMENT_RESUME_BUCKET_ID,
  RECRUITMENT_RETENTION_DAYS,
} from "@repo/shared/types/recruitment";
import { safeSecretCompare } from "@repo/shared/utils/secrets";
import { NextResponse } from "next/server";

/**
 * Recruitment retention. Driven by the `scheduled-dispatch` Appwrite Function
 * (`RECRUITMENT_RETENTION_CLEANUP_URL`), which sends `x-cron-secret`; can also
 * be hit manually with `Authorization: Bearer ${CRON_SECRET}`.
 *
 * Deletes job applications (and their resume file) and candidate profiles whose
 * `data_retention_until` has passed. Rows without that value fall back to
 * `$createdAt` + 180 days. Answers and interviews cascade with the application.
 * The resume is deleted before the row, so a failed file delete leaves the row
 * in place for the next run instead of orphaning the file. Bounded per run.
 */

export const runtime = "nodejs";
export const maxDuration = 300;

const DAY_MS = 24 * 60 * 60 * 1000;
const BATCH_SIZE = 100;
const MAX_BATCHES = 10;
const LOG_TAG = "[Recruitment Cleanup]";

type AdminClient = Awaited<ReturnType<typeof createAdminClient>>;

interface ExpiredRow extends Models.Row {
  resume_file_id?: string | null;
}

interface SweepResult {
  deleted: number;
  failed: number;
}

function readBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  return header?.startsWith("Bearer ") ? header.slice(7) : null;
}

function hasValidCronSecret(request: Request, secret: string): boolean {
  return [readBearerToken(request), request.headers.get("x-cron-secret")].some(
    (candidate) => safeSecretCompare(candidate, secret)
  );
}

function isNotFound(error: unknown): boolean {
  return (error as { code?: number } | null)?.code === 404;
}

function expiredQuery(now: Date): string {
  const fallbackCutoff = new Date(
    now.getTime() - RECRUITMENT_RETENTION_DAYS * DAY_MS
  );
  return Query.or([
    Query.lessThan("data_retention_until", now.toISOString()),
    Query.and([
      Query.isNull("data_retention_until"),
      Query.lessThan("$createdAt", fallbackCutoff.toISOString()),
    ]),
  ]);
}

/**
 * Walks expired rows in `$id` order and hands each to `purge`. Paging by
 * `$id > last` (not a cursor) keeps rows that failed to delete from being
 * re-listed within the same run, and works after the cursor row is gone.
 */
async function sweep(
  { db }: AdminClient,
  table: string,
  columns: string[],
  now: Date,
  purge: (row: ExpiredRow) => Promise<void>
): Promise<SweepResult> {
  const result: SweepResult = { deleted: 0, failed: 0 };
  let lastId: string | null = null;
  for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
    const queries = [
      expiredQuery(now),
      Query.orderAsc("$id"),
      Query.limit(BATCH_SIZE),
      Query.select(["$id", ...columns]),
    ];
    if (lastId) {
      queries.push(Query.greaterThan("$id", lastId));
    }
    const { rows } = await db.listRows<ExpiredRow>("app", table, queries);
    for (const row of rows) {
      try {
        await purge(row);
        result.deleted += 1;
      } catch (error) {
        result.failed += 1;
        console.error(
          `${LOG_TAG} Failed to delete ${table} ${row.$id}:`,
          error
        );
      }
    }
    if (rows.length < BATCH_SIZE) {
      break;
    }
    lastId = rows.at(-1)?.$id ?? null;
  }
  return result;
}

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error(`${LOG_TAG} CRON_SECRET is not configured`);
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }
  if (!hasValidCronSecret(request, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const client = await createAdminClient();
    let resumesDeleted = 0;

    const applications = await sweep(
      client,
      "job_applications",
      ["resume_file_id"],
      now,
      async (row) => {
        if (row.resume_file_id) {
          try {
            await client.storage.deleteFile(
              RECRUITMENT_RESUME_BUCKET_ID,
              row.resume_file_id
            );
            resumesDeleted += 1;
          } catch (error) {
            if (!isNotFound(error)) {
              throw error;
            }
          }
        }
        await client.db.deleteRow("app", "job_applications", row.$id);
      }
    );

    const profiles = await sweep(
      client,
      "candidate_profiles",
      [],
      now,
      async (row) => {
        await client.db.deleteRow("app", "candidate_profiles", row.$id);
      }
    );

    const body = {
      applicationsDeleted: applications.deleted,
      failed: applications.failed + profiles.failed,
      profilesDeleted: profiles.deleted,
      resumesDeleted,
    };
    console.log(`${LOG_TAG} ${JSON.stringify(body)}`);
    return NextResponse.json(body);
  } catch (error) {
    console.error(`${LOG_TAG} Cleanup failed:`, error);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

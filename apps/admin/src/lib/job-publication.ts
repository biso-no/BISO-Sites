import { ID, Query } from "@repo/api";
import type { createAdminClient } from "@repo/api/server";
import {
  type ContentTranslations,
  type Jobs,
  JobsStatus,
} from "@repo/api/types/appwrite";
import { parseRecruitmentVacancyMetadata } from "@repo/shared/types/recruitment";
import { buildJobRowPermissions } from "@/lib/recruitment";

export type JobPublicationDecision =
  | { error: string; scheduledPublishAt?: never; status?: never }
  | { error?: never; scheduledPublishAt: string | null; status: JobsStatus };

/**
 * Decides what a save actually writes.
 *
 * Scheduling keeps the vacancy a draft (invisible to the public, which only
 * lists `published`) and arms `scheduled_publish_at`; the dispatcher publishes
 * it when due. Only "Publish" arms a schedule — "Save draft" disarms it, so a
 * draft never goes live by surprise. A vacancy that is already published stays
 * published: scheduling never takes a live vacancy down.
 */
export function resolveJobPublication(input: {
  currentStatus: JobsStatus | null;
  now?: Date;
  publicationMode: string | null | undefined;
  requestedStatus: JobsStatus;
  scheduledPublishAt: string | null | undefined;
}): JobPublicationDecision {
  const { currentStatus, publicationMode, requestedStatus } = input;
  const now = input.now ?? new Date();

  if (requestedStatus !== JobsStatus.PUBLISHED) {
    return { scheduledPublishAt: null, status: requestedStatus };
  }
  if (
    publicationMode !== "scheduled" ||
    currentStatus === JobsStatus.PUBLISHED
  ) {
    return { scheduledPublishAt: null, status: JobsStatus.PUBLISHED };
  }

  if (!input.scheduledPublishAt) {
    return { error: "Choose a publish time, or switch to Publish now." };
  }
  const scheduledAt = new Date(input.scheduledPublishAt);
  if (Number.isNaN(scheduledAt.getTime())) {
    return { error: "The scheduled publish time is not a valid date." };
  }
  if (scheduledAt.getTime() <= now.getTime()) {
    // The chosen time has already passed — publishing now is what was meant.
    return { scheduledPublishAt: null, status: JobsStatus.PUBLISHED };
  }
  return {
    scheduledPublishAt: scheduledAt.toISOString(),
    status: JobsStatus.DRAFT,
  };
}

type AdminDb = Awaited<ReturnType<typeof createAdminClient>>["db"];

function isStillDue(
  job: Pick<Jobs, "scheduled_publish_at" | "status">,
  now: Date
): boolean {
  if (job.status !== JobsStatus.DRAFT || !job.scheduled_publish_at) {
    return false;
  }
  return new Date(job.scheduled_publish_at).getTime() <= now.getTime();
}

/** Best-effort audit row; a failure here must not undo the publish. */
async function recordScheduledPublish(
  db: AdminDb,
  jobId: string,
  scheduledPublishAt: string | null
): Promise<void> {
  try {
    await db.createRow("app", "audit_logs", ID.unique(), {
      action: "recruitment.vacancy.scheduled_publish",
      actor_email: null,
      actor_id: "system:scheduled-dispatch",
      payload: JSON.stringify({ scheduled_publish_at: scheduledPublishAt }),
      resource_id: jobId,
      resource_type: "job",
    });
  } catch (error) {
    console.error("[recruitment/publish-scheduled] audit write failed", {
      error,
      jobId,
    });
  }
}

const DUE_JOBS_PAGE_SIZE = 50;

export interface PublishDueJobsResult {
  failed: number;
  processed: number;
  published: number;
}

/**
 * Publishes every draft vacancy whose `scheduled_publish_at` has passed:
 * grants consumer read permissions on the translations first (so a live
 * vacancy never lacks readable content), then flips the parent row to
 * published and disarms the schedule. Safe to re-run — a published row no
 * longer matches the query.
 */
export async function publishDueJobs(
  db: AdminDb,
  now: Date = new Date()
): Promise<PublishDueJobsResult> {
  const due = await db.listRows<Jobs>("app", "jobs", [
    Query.equal("status", JobsStatus.DRAFT),
    Query.lessThanEqual("scheduled_publish_at", now.toISOString()),
    Query.select(["$id", "metadata", "scheduled_publish_at"]),
    Query.limit(DUE_JOBS_PAGE_SIZE),
  ]);

  const result: PublishDueJobsResult = {
    failed: 0,
    processed: due.rows.length,
    published: 0,
  };

  for (const job of due.rows) {
    const startedAt = Date.now();
    try {
      // Re-check just before writing: an editor may have cancelled or moved
      // the schedule since the list query ran.
      const current = await db.getRow<Jobs>("app", "jobs", job.$id, [
        Query.select(["$id", "status", "scheduled_publish_at"]),
      ]);
      if (!isStillDue(current, now)) {
        continue;
      }
      const audience =
        parseRecruitmentVacancyMetadata(job.metadata).audience ?? "public";
      const permissions = buildJobRowPermissions(
        audience,
        JobsStatus.PUBLISHED
      );

      const translations = await db.listRows<ContentTranslations>(
        "app",
        "content_translations",
        [
          Query.equal("content_type", "job"),
          Query.equal("content_id", job.$id),
          Query.select(["$id"]),
          Query.limit(10),
        ]
      );
      for (const translation of translations.rows) {
        await db.updateRow(
          "app",
          "content_translations",
          translation.$id,
          {},
          permissions
        );
      }

      await db.updateRow(
        "app",
        "jobs",
        job.$id,
        { scheduled_publish_at: null, status: JobsStatus.PUBLISHED },
        permissions
      );
      result.published += 1;
      await recordScheduledPublish(db, job.$id, job.scheduled_publish_at);
      console.info("[recruitment/publish-scheduled] published", {
        durationMs: Date.now() - startedAt,
        jobId: job.$id,
        scheduledPublishAt: job.scheduled_publish_at,
      });
    } catch (error) {
      result.failed += 1;
      console.error("[recruitment/publish-scheduled] failed", {
        durationMs: Date.now() - startedAt,
        error,
        jobId: job.$id,
      });
    }
  }

  return result;
}

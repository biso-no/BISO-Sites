"use server";

/**
 * Migration: move interview information out of the JSON `review_metadata`
 * blob on `job_applications` into the new `job_interviews` +
 * `job_interview_participants` collections, and grant existing SG-App-Dept-*
 * teams CRUD on the new recruitment tables.
 *
 * Idempotent — for each application we only insert a `job_interviews` row when
 * the legacy `interview_starts_at` is set and there isn't already an interview
 * linked to the application. Safe to re-run.
 */

import { ID, Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type { JobApplications, Jobs } from "@repo/api/types/appwrite";
import {
  InterviewParticipantRole,
  InterviewResponseStatus,
  InterviewStatus,
} from "@repo/api/types/appwrite";
import { parseRecruitmentApplicationReviewMetadata } from "@repo/shared/types/recruitment";
import { isGlobalAdmin } from "@/lib/authorization";
import { grantTeamRecruitmentAccess } from "@/lib/team-provisioning";

const DATABASE_ID = "app";

interface MigrationResult {
  applications_scanned: number;
  dry_run: boolean;
  error?: string;
  errors: number;
  interviews_created: number;
  participants_created: number;
  success: boolean;
  teams_provisioned: number;
}

export async function runRecruitment2026MayMigration(
  options: { dryRun?: boolean } = {}
): Promise<MigrationResult> {
  if (!(await isGlobalAdmin())) {
    return {
      applications_scanned: 0,
      dry_run: Boolean(options.dryRun),
      error: "Unauthorized",
      errors: 0,
      interviews_created: 0,
      participants_created: 0,
      success: false,
      teams_provisioned: 0,
    };
  }

  const dryRun = Boolean(options.dryRun);
  const { db, teams } = await createAdminClient();
  let applicationsScanned = 0;
  let interviewsCreated = 0;
  let participantsCreated = 0;
  let teamsProvisioned = 0;
  let errors = 0;

  // 1) Provision existing dept teams against the new recruitment tables.
  const teamPage = await teams.list();
  for (const team of teamPage.teams.filter((t) =>
    t.name.startsWith("SG-App-Dept-")
  )) {
    try {
      if (!dryRun) {
        await grantTeamRecruitmentAccess(team.$id);
      }
      teamsProvisioned++;
    } catch (err) {
      console.error(
        `Failed to provision recruitment access for ${team.name}`,
        err
      );
      errors++;
    }
  }

  // 2) Walk all applications with non-empty review_metadata.
  let cursor: string | undefined;
  const BATCH = 100;
  // Safety cap to avoid runaway loops.
  for (let i = 0; i < 1000; i++) {
    const queries = [Query.limit(BATCH), Query.orderAsc("$id")];
    if (cursor) {
      queries.push(Query.cursorAfter(cursor));
    }
    const page = await db.listRows<JobApplications>(
      DATABASE_ID,
      "job_applications",
      queries
    );
    if (page.rows.length === 0) {
      break;
    }
    cursor = page.rows[page.rows.length - 1].$id;

    for (const application of page.rows) {
      applicationsScanned++;
      if (!application.review_metadata) {
        continue;
      }

      const review = parseRecruitmentApplicationReviewMetadata(
        application.review_metadata
      );
      if (!review.interview_starts_at) {
        continue;
      }

      // Skip if an interview already exists for this application.
      const existing = await db.listRows(DATABASE_ID, "job_interviews", [
        Query.equal("application_id", application.$id),
        Query.limit(1),
      ]);
      if (existing.rows.length > 0) {
        continue;
      }

      // Resolve job to denormalise campus/department onto the interview.
      let job: Jobs | null = null;
      try {
        job = await db.getRow<Jobs>(DATABASE_ID, "jobs", application.job_id, [
          Query.select(["$id", "campus_id", "department_id"]),
        ]);
      } catch (err) {
        console.warn(
          `Migration: job ${application.job_id} missing for application ${application.$id}`,
          err
        );
        errors++;
        continue;
      }

      const durationMinutes = review.interview_duration_minutes ?? 45;
      const startsAt = new Date(review.interview_starts_at);
      const endsAt = new Date(startsAt.getTime() + durationMinutes * 60 * 1000);

      const status = mapLegacyInterviewStatus(review.interview_status);

      try {
        if (dryRun) {
          interviewsCreated++;
          participantsCreated++;
          if (review.assigned_hr_user_id) {
            participantsCreated++;
          }
        } else {
          const interview = await db.createRow(
            DATABASE_ID,
            "job_interviews",
            ID.unique(),
            {
              application_id: application.$id,
              cancelled_reason: null,
              campus_id: job.campus_id,
              created_by_user_id: review.assigned_hr_user_id ?? null,
              department_id: job.department_id ?? null,
              ends_at: endsAt.toISOString(),
              job_id: application.job_id,
              location: review.interview_location ?? null,
              meeting_url: review.interview_meeting_url ?? null,
              notes: review.interview_notes ?? null,
              outlook_event_id: null,
              round: 1,
              starts_at: startsAt.toISOString(),
              status,
              teams_meeting_id: null,
              timezone: "Europe/Oslo",
              title: "Migrated interview",
            }
          );
          interviewsCreated++;

          // Candidate participant
          await db.createRow(
            DATABASE_ID,
            "job_interview_participants",
            ID.unique(),
            {
              display_name: application.applicant_name,
              email: application.applicant_email,
              interview_id: interview.$id,
              is_lead: false,
              response_status: InterviewResponseStatus.PENDING,
              role: InterviewParticipantRole.CANDIDATE,
              user_id: null,
            }
          );
          participantsCreated++;

          // Assigned HR participant (if any)
          if (review.assigned_hr_user_id && review.assigned_hr_user_email) {
            await db.createRow(
              DATABASE_ID,
              "job_interview_participants",
              ID.unique(),
              {
                display_name: review.assigned_hr_user_name ?? null,
                email: review.assigned_hr_user_email,
                interview_id: interview.$id,
                is_lead: true,
                response_status: InterviewResponseStatus.ACCEPTED,
                role: InterviewParticipantRole.INTERVIEWER,
                user_id: review.assigned_hr_user_id,
              }
            );
            participantsCreated++;
          }
        }
      } catch (err) {
        console.error(
          `Migration: failed to create interview for ${application.$id}`,
          err
        );
        errors++;
      }
    }

    if (page.rows.length < BATCH) {
      break;
    }
  }

  return {
    applications_scanned: applicationsScanned,
    dry_run: dryRun,
    errors,
    interviews_created: interviewsCreated,
    participants_created: participantsCreated,
    success: errors === 0,
    teams_provisioned: teamsProvisioned,
  };
}

function mapLegacyInterviewStatus(legacy: string | undefined): InterviewStatus {
  switch (legacy) {
    case "scheduled":
      return InterviewStatus.SCHEDULED;
    case "completed":
      return InterviewStatus.COMPLETED;
    case "cancelled":
      return InterviewStatus.CANCELLED;
    case "requested":
      return InterviewStatus.PROPOSED;
    default:
      return InterviewStatus.PROPOSED;
  }
}

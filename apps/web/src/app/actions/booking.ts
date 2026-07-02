"use server";

import { createHash } from "node:crypto";
import { ID, Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type {
  JobApplications,
  JobInterviews,
  Jobs,
  RecruitmentBookingTokens,
} from "@repo/api/types/appwrite";
import { JobInterviewsStatus } from "@repo/api/types/appwrite";
import type { JobInterviewWriteInput } from "@repo/api/types/inputs";
import { createTypedRow } from "@repo/api/write";
import { buildRecruitmentStaffRowPermissions } from "@repo/shared/recruitment";
import { recruitmentBookingConfirmSchema } from "@repo/shared/types/recruitment";

const SECRET = process.env.RECRUITMENT_BOOKING_SECRET;

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export interface BookingContext {
  application: { applicant_name: string; applicant_email: string };
  job: { $id: string; slug: string; campus_name: string | null };
  token: {
    duration_minutes: number;
    expires_at: string;
    window_from: string;
    window_to: string;
  };
}

export async function getBookingContext(
  token: string
): Promise<{ data: BookingContext } | { error: string }> {
  if (!SECRET) {
    return { error: "Booking is not configured." };
  }

  const tokenHash = hashToken(token);
  const { db } = await createAdminClient();

  const result = await db.listRows<RecruitmentBookingTokens>(
    "app",
    "recruitment_booking_tokens",
    [Query.equal("token_hash", tokenHash), Query.limit(1)]
  );
  const record = result.rows[0];
  if (!record) {
    return { error: "This booking link is invalid." };
  }

  if (record.consumed_at) {
    return { error: "This booking link has already been used." };
  }
  if (Date.now() > new Date(record.expires_at).getTime()) {
    return { error: "This booking link has expired." };
  }

  const application = await db.getRow<JobApplications>(
    "app",
    "job_applications",
    record.application_id
  );
  const job = await db.getRow<Jobs>("app", "jobs", application.job_id, [
    Query.select(["$id", "slug", "campus.name"]),
  ]);

  return {
    data: {
      application: {
        applicant_email: application.applicant_email,
        applicant_name: application.applicant_name,
      },
      job: {
        $id: job.$id,
        campus_name:
          (job as unknown as { campus?: { name: string } }).campus?.name ??
          null,
        slug: job.slug,
      },
      token: {
        duration_minutes: record.duration_minutes,
        expires_at: record.expires_at,
        window_from: record.window_from,
        window_to: record.window_to,
      },
    },
  };
}

export async function confirmBookingSlot(
  token: string,
  startsAt: string,
  durationMinutes: number
): Promise<
  { data: { interview_id: string; starts_at: string } } | { error: string }
> {
  if (!SECRET) {
    return { error: "Booking is not configured." };
  }

  const parsed = recruitmentBookingConfirmSchema.safeParse({
    token,
    starts_at: startsAt,
    duration_minutes: durationMinutes,
  });
  if (!parsed.success) {
    return { error: "Invalid booking parameters." };
  }

  const tokenHash = hashToken(token);
  const { db } = await createAdminClient();

  const result = await db.listRows<RecruitmentBookingTokens>(
    "app",
    "recruitment_booking_tokens",
    [Query.equal("token_hash", tokenHash), Query.limit(1)]
  );
  const record = result.rows[0];
  if (!record) {
    return { error: "This booking link is invalid." };
  }
  if (record.consumed_at) {
    return { error: "This booking link has already been used." };
  }
  if (Date.now() > new Date(record.expires_at).getTime()) {
    return { error: "This booking link has expired." };
  }

  const start = new Date(parsed.data.starts_at);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  const windowFrom = new Date(record.window_from).getTime();
  const windowTo = new Date(record.window_to).getTime();

  if (start.getTime() < windowFrom || end.getTime() > windowTo) {
    return { error: "Selected slot is outside the allowed window." };
  }

  // Atomically claim the token before any write. Two concurrent confirms both
  // pass the consumed_at read above; only the caller that increments the lock
  // from 0 to 1 may create an interview (PR-059).
  let claimHeld = false;
  try {
    const claimed = (await db.incrementRowColumn({
      databaseId: "app",
      tableId: "recruitment_booking_tokens",
      rowId: record.$id,
      column: "claim_lock",
      value: 1,
    })) as unknown as { claim_lock?: number };
    const lockValue =
      typeof claimed.claim_lock === "number" ? claimed.claim_lock : 0;
    if (lockValue !== 1) {
      return { error: "This booking link has already been used." };
    }
    claimHeld = true;
  } catch (error) {
    // Schema without claim_lock yet — keep the legacy (racy) behaviour rather
    // than blocking all bookings.
    console.warn("[Booking] Atomic token claim unavailable:", error);
  }

  const releaseClaim = async () => {
    if (!claimHeld) {
      return;
    }
    await db
      .decrementRowColumn({
        databaseId: "app",
        tableId: "recruitment_booking_tokens",
        rowId: record.$id,
        column: "claim_lock",
        value: 1,
        min: 0,
      })
      .catch(() => undefined);
  };

  try {
    // Slot uniqueness: reject a slot that overlaps another SCHEDULED interview
    // for the same interviewer, so two candidates can't book the same instant
    // from different tokens (PR-060).
    if (record.created_by_user_id) {
      const overlapping = await db.listRows<JobInterviews>(
        "app",
        "job_interviews",
        [
          Query.equal("created_by_user_id", record.created_by_user_id),
          Query.equal("status", JobInterviewsStatus.SCHEDULED),
          Query.lessThan("starts_at", end.toISOString()),
          Query.greaterThan("ends_at", start.toISOString()),
          Query.limit(1),
        ]
      );
      if (overlapping.rows.length > 0) {
        await releaseClaim();
        return {
          error:
            "That time was just booked by someone else. Please pick another slot.",
        };
      }
    }

    const application = await db.getRow<JobApplications>(
      "app",
      "job_applications",
      record.application_id
    );
    const job = await db.getRow<Jobs>("app", "jobs", application.job_id, [
      Query.select([
        "$id",
        "campus_id",
        "department_id",
        "campus.name",
        "department.$id",
      ]),
    ]);

    const typedJob = job as unknown as {
      campus_id: string;
      department_id: string | null;
    };

    const interview = await createTypedRow<
      JobInterviews,
      JobInterviewWriteInput
    >(
      db,
      "app",
      "job_interviews",
      ID.unique(),
      {
        application: record.application_id,
        application_id: record.application_id,
        cancelled_reason: null,
        campus_id: typedJob.campus_id,
        created_by_user_id: record.created_by_user_id,
        department_id: typedJob.department_id ?? null,
        ends_at: end.toISOString(),
        job_id: application.job_id,
        location: null,
        meeting_url: null,
        notes: "Booked by candidate via self-service link.",
        outlook_event_id: null,
        round: 1,
        starts_at: start.toISOString(),
        status: JobInterviewsStatus.SCHEDULED,
        teams_meeting_id: null,
        timezone: "Europe/Oslo",
        title: "Interview",
      },
      buildRecruitmentStaffRowPermissions()
    );

    await db.updateRow<RecruitmentBookingTokens>(
      "app",
      "recruitment_booking_tokens",
      record.$id,
      { consumed_at: new Date().toISOString(), interview_id: interview.$id }
    );

    return {
      data: { interview_id: interview.$id, starts_at: start.toISOString() },
    };
  } catch (error) {
    // Release the claim so the candidate's link isn't dead after a transient
    // failure — nothing was booked.
    await releaseClaim();
    console.error("[Booking] Failed to confirm booking slot:", error);
    return { error: "Could not confirm the booking. Please try again." };
  }
}

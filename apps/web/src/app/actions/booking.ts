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
import { InterviewStatus } from "@repo/api/types/appwrite";
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

  const application = await db.getRow<JobApplications>(
    "app",
    "job_applications",
    record.application_id
  );
  const job = await db.getRow<Jobs>("app", "jobs", application.job_id, [
    Query.select(["$id", "campus_id", "department_id"]),
  ]);

  const interview = await db.createRow<JobInterviews>(
    "app",
    "job_interviews",
    ID.unique(),
    {
      application_id: record.application_id,
      cancelled_reason: null,
      campus_id: (job as unknown as { campus_id: string }).campus_id,
      created_by_user_id: record.created_by_user_id,
      department_id:
        (job as unknown as { department_id: string | null }).department_id ??
        null,
      ends_at: end.toISOString(),
      job_id: application.job_id,
      location: null,
      meeting_url: null,
      notes: "Booked by candidate via self-service link.",
      outlook_event_id: null,
      round: 1,
      starts_at: start.toISOString(),
      status: InterviewStatus.SCHEDULED,
      teams_meeting_id: null,
      timezone: "Europe/Oslo",
      title: "Interview",
    }
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
}

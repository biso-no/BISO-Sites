import { ID, Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import { InterviewStatus } from "@repo/api/types/appwrite";
import type {
  JobApplications,
  JobInterviews,
  Jobs,
  RecruitmentBookingTokens,
} from "@repo/api/types/appwrite";
import { recruitmentBookingConfirmSchema } from "@repo/shared/types/recruitment";
import { type NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";

const SECRET = process.env.RECRUITMENT_BOOKING_SECRET;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function loadTokenRecord(
  token: string
): Promise<RecruitmentBookingTokens | null> {
  if (!SECRET) {
    return null;
  }
  const tokenHash = hashToken(token);
  const { db } = await createAdminClient();
  const result = await db.listRows<RecruitmentBookingTokens>(
    "app",
    "recruitment_booking_tokens",
    [Query.equal("token_hash", tokenHash), Query.limit(1)]
  );
  return result.rows[0] ?? null;
}

function isTokenValid(record: RecruitmentBookingTokens): {
  ok: boolean;
  reason?: string;
} {
  if (record.consumed_at) {
    return { ok: false, reason: "This booking link has already been used." };
  }
  if (Date.now() > new Date(record.expires_at).getTime()) {
    return { ok: false, reason: "This booking link has expired." };
  }
  return { ok: true };
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> }
): Promise<NextResponse> {
  const { token } = await context.params;
  const record = await loadTokenRecord(token);
  if (!record) {
    return NextResponse.json({ error: "Invalid token" }, { status: 404 });
  }
  const validity = isTokenValid(record);
  if (!validity.ok) {
    return NextResponse.json({ error: validity.reason }, { status: 410 });
  }

  const { db } = await createAdminClient();
  const application = await db.getRow<JobApplications>(
    "app",
    "job_applications",
    record.application_id
  );
  const job = await db.getRow<Jobs>("app", "jobs", application.job_id, [
    Query.select(["$id", "slug", "campus.name"]),
  ]);

  return NextResponse.json({
    data: {
      application: {
        applicant_email: application.applicant_email,
        applicant_name: application.applicant_name,
      },
      job: {
        $id: job.$id,
        campus_name: job.campus?.name ?? null,
        slug: job.slug,
      },
      token: {
        duration_minutes: record.duration_minutes,
        expires_at: record.expires_at,
        window_from: record.window_from,
        window_to: record.window_to,
      },
    },
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
): Promise<NextResponse> {
  const { token } = await context.params;
  const record = await loadTokenRecord(token);
  if (!record) {
    return NextResponse.json({ error: "Invalid token" }, { status: 404 });
  }
  const validity = isTokenValid(record);
  if (!validity.ok) {
    return NextResponse.json({ error: validity.reason }, { status: 410 });
  }

  const body = await request.json().catch(() => null);
  const parsed = recruitmentBookingConfirmSchema.safeParse({
    ...body,
    token,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid booking" }, { status: 400 });
  }

  const startsAt = new Date(parsed.data.starts_at);
  const endsAt = new Date(
    startsAt.getTime() + parsed.data.duration_minutes * 60_000
  );
  const windowFrom = new Date(record.window_from).getTime();
  const windowTo = new Date(record.window_to).getTime();
  if (
    startsAt.getTime() < windowFrom ||
    endsAt.getTime() > windowTo
  ) {
    return NextResponse.json(
      { error: "Selected slot is outside the proposed window." },
      { status: 400 }
    );
  }

  const { db } = await createAdminClient();
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
      campus_id: job.campus_id,
      created_by_user_id: record.created_by_user_id,
      department_id: job.department_id ?? null,
      ends_at: endsAt.toISOString(),
      job_id: application.job_id,
      location: null,
      meeting_url: null,
      notes: "Booked by candidate via self-service link.",
      outlook_event_id: null,
      round: 1,
      starts_at: startsAt.toISOString(),
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
    {
      consumed_at: new Date().toISOString(),
      interview_id: interview.$id,
    }
  );

  return NextResponse.json({
    data: {
      interview_id: interview.$id,
      starts_at: startsAt.toISOString(),
    },
  });
}

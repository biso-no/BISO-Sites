"use server";

import { ID, Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import type {
  JobApplications,
  JobInterviewParticipants,
  JobInterviewScorecards,
  JobInterviews,
  Jobs,
  RecruitmentBookingTokens,
} from "@repo/api/types/appwrite";
import {
  JobInterviewParticipantsResponseStatus,
  JobInterviewParticipantsRole,
  type JobInterviewScorecardsRecommendation,
  JobInterviewsStatus,
} from "@repo/api/types/appwrite";
import type {
  JobInterviewParticipantWriteInput,
  JobInterviewScorecardWriteInput,
  JobInterviewWriteInput,
} from "@repo/api/types/inputs";
import { createTypedRow, updateTypedRow } from "@repo/api/write";
import {
  createSchedulingGraphClient,
  panelBusyIntervals,
  scheduleInterviewOnGraph,
} from "@repo/connectors/azure/recruitment-scheduling";
import { buildRecruitmentStaffRowPermissions } from "@repo/shared/recruitment";
import { isBookingLinkUsable } from "@repo/shared/recruitment/booking-link";
import { availableSlots } from "@repo/shared/recruitment/booking-slots";
import {
  RECRUITMENT_BOOKING_TOKEN_DEFAULT_TTL_DAYS,
  type RecruitmentBookingProposeInput,
  type RecruitmentInterviewCreateInput,
  type RecruitmentScorecardSubmitInput,
  recruitmentBookingProposeSchema,
  recruitmentInterviewCreateSchema,
  recruitmentScorecardSubmitSchema,
} from "@repo/shared/types/recruitment";
import { requireAuth, type UserAuthContext } from "@/lib/authorization";
import {
  assertInterviewWriteAccess,
  assertScorecardWriteAccess,
  loadRecruitmentLookups,
  toRecruitmentAdminScope,
} from "@/lib/recruitment";
import { issueBookingToken } from "@/lib/recruitment-booking";
import { logAuditEvent } from "./audit-log";

const DATABASE_ID = "app";
const NOT_CONNECTED_WARNING =
  "Calendar is not connected (Azure credentials missing). The interview was saved, but no invite was sent.";
const TRAILING_SLASH_RE = /\/$/;

// Fields to select when fetching job_applications with nested job for access control.
const APPLICATION_JOB_SELECT = [
  "$id",
  "job_id",
  "status",
  "applicant_name",
  "applicant_email",
  "job.$id",
  "job.status",
  "job.campus_id",
  "job.department_id",
] as const;

function toParticipantRole(role: string): JobInterviewParticipantsRole {
  switch (role) {
    case JobInterviewParticipantsRole.CANDIDATE:
      return JobInterviewParticipantsRole.CANDIDATE;
    case JobInterviewParticipantsRole.OBSERVER:
      return JobInterviewParticipantsRole.OBSERVER;
    default:
      return JobInterviewParticipantsRole.INTERVIEWER;
  }
}

export interface InterviewWithParticipants {
  interview: JobInterviews;
  participants: JobInterviewParticipants[];
}

async function applyGraphScheduling(
  db: Awaited<ReturnType<typeof createSessionClient>>["db"],
  ctx: UserAuthContext,
  input: {
    auto_create_teams_meeting?: boolean;
    location?: string | null;
    notes?: string | null;
    timezone: string;
    title: string;
  },
  interview: JobInterviews,
  participants: JobInterviewParticipants[],
  startsAt: Date,
  endsAt: Date,
  candidateEmail: string
): Promise<{ interview: JobInterviews; warning?: string }> {
  // Every interview goes out as an Outlook invite to the candidate and the
  // panel; a Teams meeting is added for online and hybrid ones.
  const graph = createSchedulingGraphClient();
  if (!graph) {
    return { interview, warning: NOT_CONNECTED_WARNING };
  }
  const panelEmails = participants
    .filter((p) => p.role === JobInterviewParticipantsRole.INTERVIEWER)
    .map((p) => p.email);
  const lead = participants.find(
    (p) => p.role === JobInterviewParticipantsRole.INTERVIEWER && p.is_lead
  );
  const organizerUpn = lead?.email ?? panelEmails[0] ?? ctx.email ?? null;
  if (!organizerUpn) {
    return {
      interview,
      warning: "No valid organizer found for the calendar invite.",
    };
  }
  try {
    const scheduled = await scheduleInterviewOnGraph(graph, {
      body: input.notes ?? "Interview with BISO.",
      candidateEmail,
      createTeamsMeeting: input.auto_create_teams_meeting !== false,
      ends_at: endsAt,
      location: input.location ?? null,
      organizerUpn,
      panelEmails,
      starts_at: startsAt,
      subject: input.title,
      timezone: input.timezone,
    });
    let saved = interview;
    if (
      scheduled.outlookEventId ||
      scheduled.teamsMeetingId ||
      scheduled.meetingUrl
    ) {
      // Keep whatever came back even if the invite failed: a Teams meeting
      // without a stored join link is just an orphan on the organiser's account.
      saved = await db.updateRow<JobInterviews>(
        DATABASE_ID,
        "job_interviews",
        interview.$id,
        {
          meeting_url: scheduled.meetingUrl ?? interview.meeting_url,
          outlook_event_id: scheduled.outlookEventId,
          teams_meeting_id: scheduled.teamsMeetingId,
        }
      );
    }
    if (!scheduled.outlookEventId) {
      return {
        interview: saved,
        warning:
          "The interview was saved, but Outlook refused the invite. Check the organiser's mailbox and the app's calendar permissions.",
      };
    }
    return { interview: saved };
  } catch (graphError) {
    console.warn(
      `Graph scheduling failed for interview ${interview.$id}`,
      graphError
    );
    return {
      interview,
      warning:
        "Failed to sync with Microsoft calendar. The interview was saved, but no Teams meeting or Outlook invite was created.",
    };
  }
}

export async function createInterview(
  values: RecruitmentInterviewCreateInput
): Promise<{
  data?: InterviewWithParticipants & { warning?: string };
  error?: string;
}> {
  const ctx = await requireAuth();
  const validated = recruitmentInterviewCreateSchema.safeParse(values);
  if (!validated.success) {
    return { error: "Invalid interview payload" };
  }
  const input = validated.data;

  try {
    const { db } = await createSessionClient();
    const scope = toRecruitmentAdminScope(ctx);
    const lookups = await loadRecruitmentLookups(db);

    const application = await db.getRow<JobApplications>(
      DATABASE_ID,
      "job_applications",
      input.application_id,
      [Query.select([...APPLICATION_JOB_SELECT])]
    );
    const job = application.job as Jobs | null;
    if (!job) {
      return { error: "Vacancy not found" };
    }
    assertInterviewWriteAccess(scope, lookups, {
      campus_id: job.campus_id,
      department_id: job.department_id,
    });

    const startsAt = new Date(input.starts_at);
    const endsAt = new Date(input.ends_at);
    if (endsAt.getTime() <= startsAt.getTime()) {
      return { error: "Interview end must be after start" };
    }

    const interview = await createTypedRow<
      JobInterviews,
      JobInterviewWriteInput
    >(
      db,
      DATABASE_ID,
      "job_interviews",
      ID.unique(),
      {
        application: input.application_id,
        application_id: input.application_id,
        cancelled_reason: null,
        campus_id: job.campus_id,
        created_by_user_id: ctx.userId,
        department_id: job.department_id ?? null,
        ends_at: endsAt.toISOString(),
        job_id: application.job_id,
        location: input.location ?? null,
        meeting_url: input.meeting_url ?? null,
        notes: input.notes ?? null,
        outlook_event_id: null,
        round: input.round,
        starts_at: startsAt.toISOString(),
        status: JobInterviewsStatus.SCHEDULED,
        teams_meeting_id: null,
        timezone: input.timezone,
        title: input.title,
      },
      buildRecruitmentStaffRowPermissions()
    );

    const participants: JobInterviewParticipants[] = [];
    // Always seed the candidate as a participant.
    const candidate = await createTypedRow<
      JobInterviewParticipants,
      JobInterviewParticipantWriteInput
    >(
      db,
      DATABASE_ID,
      "job_interview_participants",
      ID.unique(),
      {
        display_name: application.applicant_name,
        email: application.applicant_email,
        interview: interview.$id,
        interview_id: interview.$id,
        is_lead: false,
        response_status: JobInterviewParticipantsResponseStatus.PENDING,
        role: JobInterviewParticipantsRole.CANDIDATE,
        user_id: null,
      },
      buildRecruitmentStaffRowPermissions()
    );
    participants.push(candidate);

    for (const participantInput of input.participants) {
      const participant = await createTypedRow<
        JobInterviewParticipants,
        JobInterviewParticipantWriteInput
      >(
        db,
        DATABASE_ID,
        "job_interview_participants",
        ID.unique(),
        {
          display_name: participantInput.display_name ?? null,
          email: participantInput.email,
          interview: interview.$id,
          interview_id: interview.$id,
          is_lead: participantInput.is_lead,
          response_status: JobInterviewParticipantsResponseStatus.PENDING,
          role: toParticipantRole(participantInput.role),
          user_id: participantInput.user_id ?? null,
        },
        buildRecruitmentStaffRowPermissions()
      );
      participants.push(participant);
    }

    // Best-effort Graph scheduling — opt-in via env vars + flag.
    const { interview: finalInterview, warning } = await applyGraphScheduling(
      db,
      ctx,
      input,
      interview,
      participants,
      startsAt,
      endsAt,
      application.applicant_email
    );

    await logAuditEvent(ctx, "recruitment.interview.create", {
      payload: {
        application_id: input.application_id,
        participants: input.participants.length + 1,
        round: input.round,
        starts_at: startsAt.toISOString(),
        teams_meeting_id: finalInterview.teams_meeting_id,
      },
      resourceId: interview.$id,
      resourceType: "job_interview",
    });

    return { data: { interview: finalInterview, participants, warning } };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to create interview",
    };
  }
}

export async function submitScorecard(
  values: RecruitmentScorecardSubmitInput
): Promise<{ data?: JobInterviewScorecards; error?: string }> {
  const ctx = await requireAuth();
  const validated = recruitmentScorecardSubmitSchema.safeParse(values);
  if (!validated.success) {
    return { error: "Invalid scorecard payload" };
  }
  const input = validated.data;

  try {
    const { db } = await createSessionClient();
    const scope = toRecruitmentAdminScope(ctx);

    const interview = await db.getRow<JobInterviews>(
      DATABASE_ID,
      "job_interviews",
      input.interview_id,
      [
        Query.select([
          "*",
          "participants.$id",
          "participants.user_id",
          "participants.role",
        ]),
      ]
    );
    const participantUserIds = new Set(
      ((interview.participants ?? []) as JobInterviewParticipants[])
        .filter((p) => p.role === JobInterviewParticipantsRole.INTERVIEWER)
        .map((p) => p.user_id)
        .filter((id): id is string => Boolean(id))
    );

    assertScorecardWriteAccess(scope, ctx.userId, participantUserIds);

    const existing = await db.listRows<JobInterviewScorecards>(
      DATABASE_ID,
      "job_interview_scorecards",
      [
        Query.equal("interview_id", input.interview_id),
        Query.equal("interviewer_user_id", ctx.userId),
        Query.limit(1),
      ]
    );

    const payload: JobInterviewScorecardWriteInput = {
      application_id: interview.application_id,
      concerns: input.concerns ?? null,
      criteria: JSON.stringify(input.criteria),
      interview: input.interview_id,
      interview_id: input.interview_id,
      interviewer_user_id: ctx.userId,
      overall_score: input.overall_score,
      private_notes: input.private_notes ?? null,
      recommendation:
        input.recommendation as JobInterviewScorecardsRecommendation,
      strengths: input.strengths ?? null,
      submitted_at: new Date().toISOString(),
    };

    let saved: JobInterviewScorecards;
    if (existing.rows[0]) {
      saved = await updateTypedRow<
        JobInterviewScorecards,
        JobInterviewScorecardWriteInput
      >(
        db,
        DATABASE_ID,
        "job_interview_scorecards",
        existing.rows[0].$id,
        payload,
        buildRecruitmentStaffRowPermissions()
      );
    } else {
      saved = await createTypedRow<
        JobInterviewScorecards,
        JobInterviewScorecardWriteInput
      >(
        db,
        DATABASE_ID,
        "job_interview_scorecards",
        ID.unique(),
        payload,
        buildRecruitmentStaffRowPermissions()
      );
    }

    await logAuditEvent(ctx, "recruitment.scorecard.submit", {
      payload: {
        overall_score: input.overall_score,
        recommendation: input.recommendation,
      },
      resourceId: saved.$id,
      resourceType: "job_interview_scorecard",
    });

    return { data: saved };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to submit scorecard",
    };
  }
}

const TOKEN_PAGE_SIZE = 100;

/**
 * The application's links that are neither used nor expired. Only the indexed
 * application_id is queried; the rest is filtered here.
 */
async function openBookingTokens(
  db: Awaited<ReturnType<typeof createSessionClient>>["db"],
  applicationId: string,
  nowIso: string
): Promise<RecruitmentBookingTokens[]> {
  const open: RecruitmentBookingTokens[] = [];
  let cursor: string | null = null;
  while (true) {
    const queries = [
      Query.equal("application_id", applicationId),
      Query.orderAsc("$id"),
      Query.limit(TOKEN_PAGE_SIZE),
    ];
    if (cursor) {
      queries.push(Query.cursorAfter(cursor));
    }
    const page = await db.listRows<RecruitmentBookingTokens>(
      DATABASE_ID,
      "recruitment_booking_tokens",
      queries
    );
    for (const row of page.rows) {
      if (!row.consumed_at && row.expires_at > nowIso) {
        open.push(row);
      }
    }
    if (page.rows.length < TOKEN_PAGE_SIZE) {
      return open;
    }
    cursor = page.rows.at(-1)?.$id ?? null;
    if (!cursor) {
      return open;
    }
  }
}

export async function createBookingToken(
  values: RecruitmentBookingProposeInput
): Promise<{ data?: { token: string; url: string }; error?: string }> {
  const ctx = await requireAuth();
  const validated = recruitmentBookingProposeSchema.safeParse(values);
  if (!validated.success) {
    return { error: "Invalid booking payload" };
  }
  const input = validated.data;

  try {
    const { db } = await createSessionClient();
    const scope = toRecruitmentAdminScope(ctx);
    const lookups = await loadRecruitmentLookups(db);

    const application = await db.getRow<JobApplications>(
      DATABASE_ID,
      "job_applications",
      input.application_id,
      [Query.select([...APPLICATION_JOB_SELECT])]
    );
    const job = application.job as Jobs | null;
    if (!job) {
      return { error: "Vacancy not found" };
    }
    assertInterviewWriteAccess(scope, lookups, {
      campus_id: job.campus_id,
      department_id: job.department_id,
    });

    if (
      !isBookingLinkUsable({
        applicationStatus: application.status,
        jobStatus: job.status,
      })
    ) {
      return {
        error:
          "Booking links can only be sent to candidates in the interview stage on an open vacancy.",
      };
    }

    // Links already out for this candidate stop working once a new one exists.
    const nowIso = new Date().toISOString();
    const earlier = await openBookingTokens(db, input.application_id, nowIso);

    const issued = issueBookingToken();
    const ttlDays =
      input.expires_in_days ?? RECRUITMENT_BOOKING_TOKEN_DEFAULT_TTL_DAYS;
    const expiresAt = new Date(
      Date.now() + ttlDays * 24 * 60 * 60 * 1000
    ).toISOString();

    await db.createRow(
      DATABASE_ID,
      "recruitment_booking_tokens",
      ID.unique(),
      {
        application_id: input.application_id,
        consumed_at: null,
        created_by_user_id: ctx.userId,
        duration_minutes: input.duration_minutes,
        expires_at: expiresAt,
        interview_id: null,
        // Panel members with emails, so the public booking page can check
        // their calendars and invite them without an admin session.
        panel_user_ids: JSON.stringify(input.panel),
        token_hash: issued.hash,
        window_from: new Date(input.window_from).toISOString(),
        window_to: new Date(input.window_to).toISOString(),
      },
      buildRecruitmentStaffRowPermissions()
    );

    // A failure here must not stop the new link from being returned.
    for (const row of earlier) {
      try {
        await db.updateRow<RecruitmentBookingTokens>(
          DATABASE_ID,
          "recruitment_booking_tokens",
          row.$id,
          { expires_at: nowIso }
        );
      } catch (error) {
        console.error(
          `[Booking] Could not expire earlier link ${row.$id}:`,
          error
        );
      }
    }

    await logAuditEvent(ctx, "recruitment.booking.issue", {
      payload: {
        application_id: input.application_id,
        expires_at: expiresAt,
        panel_size: input.panel.length,
      },
      resourceId: input.application_id,
      resourceType: "recruitment_booking_token",
    });

    const baseUrl =
      process.env.WEB_PUBLIC_BASE_URL ??
      process.env.NEXT_PUBLIC_WEB_BASE_URL ??
      "https://app.biso.no";
    const url = `${baseUrl.replace(TRAILING_SLASH_RE, "")}/recruitment/book/${issued.token}`;
    return { data: { token: issued.token, url } };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to issue booking token",
    };
  }
}

export interface BookingTokenSummary {
  consumed_at: string | null;
  created_at: string;
  expires_at: string;
  id: string;
}

async function assertApplicationAccess(
  db: Awaited<ReturnType<typeof createSessionClient>>["db"],
  ctx: UserAuthContext,
  applicationId: string
): Promise<void> {
  const scope = toRecruitmentAdminScope(ctx);
  const lookups = await loadRecruitmentLookups(db);
  const application = await db.getRow<JobApplications>(
    DATABASE_ID,
    "job_applications",
    applicationId,
    [Query.select([...APPLICATION_JOB_SELECT])]
  );
  const job = application.job as Jobs | null;
  if (!job) {
    throw new Error("Vacancy not found");
  }
  assertInterviewWriteAccess(scope, lookups, {
    campus_id: job.campus_id,
    department_id: job.department_id,
  });
}

export async function listBookingTokens(
  applicationId: string
): Promise<{ data?: BookingTokenSummary[]; error?: string }> {
  const ctx = await requireAuth();
  try {
    const { db } = await createSessionClient();
    await assertApplicationAccess(db, ctx, applicationId);
    const result = await db.listRows<RecruitmentBookingTokens>(
      DATABASE_ID,
      "recruitment_booking_tokens",
      [
        Query.equal("application_id", applicationId),
        Query.orderDesc("$createdAt"),
        Query.limit(50),
      ]
    );
    return {
      data: result.rows.map((row) => ({
        consumed_at: row.consumed_at ?? null,
        created_at: row.$createdAt,
        expires_at: row.expires_at,
        id: row.$id,
      })),
    };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to list booking links",
    };
  }
}

export async function revokeBookingToken(
  tokenId: string
): Promise<{ data?: { id: string }; error?: string }> {
  const ctx = await requireAuth();
  try {
    const { db } = await createSessionClient();
    const token = await db.getRow<RecruitmentBookingTokens>(
      DATABASE_ID,
      "recruitment_booking_tokens",
      tokenId
    );
    await assertApplicationAccess(db, ctx, token.application_id);
    if (token.consumed_at) {
      return { error: "This link has already been used to book." };
    }
    if (new Date(token.expires_at).getTime() <= Date.now()) {
      return { error: "This link has already expired." };
    }
    await db.updateRow<RecruitmentBookingTokens>(
      DATABASE_ID,
      "recruitment_booking_tokens",
      tokenId,
      { expires_at: new Date().toISOString() }
    );
    await logAuditEvent(ctx, "recruitment.booking.revoke", {
      payload: { application_id: token.application_id },
      resourceId: tokenId,
      resourceType: "recruitment_booking_token",
    });
    return { data: { id: tokenId } };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to revoke booking link",
    };
  }
}

export interface ProposedSlot {
  ends_at: string;
  starts_at: string;
}

export async function proposeInterviewSlots(input: {
  panelEmails: string[];
  from: string;
  to: string;
  durationMinutes: number;
}): Promise<{
  available: boolean;
  configured: boolean;
  slots: ProposedSlot[];
}> {
  const ctx = await requireAuth();
  // Reviewers + global admins can propose slots; otherwise lock down.
  const scope = toRecruitmentAdminScope(ctx);
  if (
    !(
      scope.isGlobalAdmin ||
      scope.isCampusAdmin ||
      scope.managedDepartmentNames.length > 0
    )
  ) {
    throw new Error("Forbidden");
  }
  const graph = createSchedulingGraphClient();
  if (!graph) {
    return { available: false, configured: false, slots: [] };
  }
  const window = { from: new Date(input.from), to: new Date(input.to) };
  const { busy, complete } = await panelBusyIntervals(
    graph,
    input.panelEmails,
    window
  );
  const slots = availableSlots({
    ...window,
    busy,
    durationMinutes: input.durationMinutes,
    stepMinutes: 60,
  });
  return {
    available: complete,
    configured: true,
    slots: slots.map((start) => ({
      ends_at: new Date(
        start.getTime() + input.durationMinutes * 60_000
      ).toISOString(),
      starts_at: start.toISOString(),
    })),
  };
}

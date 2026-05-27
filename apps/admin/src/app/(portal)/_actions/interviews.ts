"use server";

import { ID, Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import type {
  JobApplications,
  JobInterviewParticipants,
  JobInterviewScorecards,
  JobInterviews,
  Jobs,
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
  RECRUITMENT_BOOKING_TOKEN_DEFAULT_TTL_DAYS,
  type RecruitmentBookingProposeInput,
  type RecruitmentInterviewCreateInput,
  type RecruitmentInterviewUpdateInput,
  type RecruitmentScorecardCriterion,
  type RecruitmentScorecardSubmitInput,
  recruitmentBookingProposeSchema,
  recruitmentInterviewCreateSchema,
  recruitmentInterviewUpdateSchema,
  recruitmentScorecardSubmitSchema,
} from "@repo/shared/types/recruitment";
import { redirect } from "next/navigation";
import { getUserAuthContext, type UserAuthContext } from "@/lib/authorization";
import {
  assertInterviewWriteAccess,
  assertScorecardWriteAccess,
  loadRecruitmentLookups,
  toRecruitmentAdminScope,
} from "@/lib/recruitment";
import { issueBookingToken } from "@/lib/recruitment-booking";
import {
  cancelInterviewOnGraph,
  type ProposedSlot,
  proposeSlotsForPanel,
  scheduleInterviewOnGraph,
} from "@/lib/recruitment-scheduling";
import { logAuditEvent } from "./audit-log";

const DATABASE_ID = "app";
const TRAILING_SLASH_RE = /\/$/;

// Fields to select when fetching job_applications with nested job for access control.
const APPLICATION_JOB_SELECT = [
  "$id",
  "job_id",
  "applicant_name",
  "applicant_email",
  "job.$id",
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

async function requireAuth(): Promise<UserAuthContext> {
  const ctx = await getUserAuthContext();
  if (!ctx) {
    redirect("/auth/login");
  }
  return ctx;
}

export interface InterviewWithParticipants {
  interview: JobInterviews;
  participants: JobInterviewParticipants[];
}

async function fetchInterviewWithParticipants(
  db: Awaited<ReturnType<typeof createSessionClient>>["db"],
  interviewId: string
): Promise<InterviewWithParticipants> {
  const interview = await db.getRow<JobInterviews>(
    DATABASE_ID,
    "job_interviews",
    interviewId,
    [Query.select(["*", "participants.*"])]
  );
  return {
    interview,
    participants: (interview.participants ?? []) as JobInterviewParticipants[],
  };
}

export async function listInterviewsForApplication(
  applicationId: string
): Promise<InterviewWithParticipants[]> {
  const ctx = await requireAuth();
  const { db } = await createSessionClient();
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

  const interviews = await db.listRows<JobInterviews>(
    DATABASE_ID,
    "job_interviews",
    [
      Query.select(["*", "participants.*"]),
      Query.equal("application_id", applicationId),
      Query.orderAsc("round"),
      Query.orderAsc("starts_at"),
      Query.limit(50),
    ]
  );

  return interviews.rows.map((interview) => ({
    interview,
    participants: (interview.participants ?? []) as JobInterviewParticipants[],
  }));
}

async function applyGraphScheduling(
  db: Awaited<ReturnType<typeof createSessionClient>>["db"],
  ctx: UserAuthContext,
  input: {
    auto_create_teams_meeting?: boolean;
    notes?: string | null;
    title: string;
  },
  interview: JobInterviews,
  participants: JobInterviewParticipants[],
  startsAt: Date,
  endsAt: Date,
  candidateEmail: string
): Promise<JobInterviews> {
  if (input.auto_create_teams_meeting === false) {
    return interview;
  }
  const panelEmails = participants
    .filter((p) => p.role === JobInterviewParticipantsRole.INTERVIEWER)
    .map((p) => p.email);
  const lead = participants.find(
    (p) => p.role === JobInterviewParticipantsRole.INTERVIEWER && p.is_lead
  );
  const organizerUpn = lead?.email ?? panelEmails[0] ?? ctx.email ?? null;
  if (!organizerUpn) {
    return interview;
  }
  try {
    const scheduled = await scheduleInterviewOnGraph({
      body: input.notes ?? "Scheduled via BISO recruitment platform.",
      candidateEmail,
      createTeamsMeeting: true,
      ends_at: endsAt,
      organizerUpn,
      panelEmails,
      starts_at: startsAt,
      subject: input.title,
    });
    if (
      scheduled.outlookEventId ||
      scheduled.teamsMeetingId ||
      scheduled.meetingUrl
    ) {
      return await db.updateRow<JobInterviews>(
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
  } catch (graphError) {
    console.warn(
      `Graph scheduling failed for interview ${interview.$id}`,
      graphError
    );
  }
  return interview;
}

export async function createInterview(
  values: RecruitmentInterviewCreateInput
): Promise<{ data?: InterviewWithParticipants; error?: string }> {
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
    >(db, DATABASE_ID, "job_interviews", ID.unique(), {
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
    });

    const participants: JobInterviewParticipants[] = [];
    // Always seed the candidate as a participant.
    const candidate = await createTypedRow<
      JobInterviewParticipants,
      JobInterviewParticipantWriteInput
    >(db, DATABASE_ID, "job_interview_participants", ID.unique(), {
      display_name: application.applicant_name,
      email: application.applicant_email,
      interview: interview.$id,
      interview_id: interview.$id,
      is_lead: false,
      response_status: JobInterviewParticipantsResponseStatus.PENDING,
      role: JobInterviewParticipantsRole.CANDIDATE,
      user_id: null,
    });
    participants.push(candidate);

    for (const participantInput of input.participants) {
      const participant = await createTypedRow<
        JobInterviewParticipants,
        JobInterviewParticipantWriteInput
      >(db, DATABASE_ID, "job_interview_participants", ID.unique(), {
        display_name: participantInput.display_name ?? null,
        email: participantInput.email,
        interview: interview.$id,
        interview_id: interview.$id,
        is_lead: participantInput.is_lead,
        response_status: JobInterviewParticipantsResponseStatus.PENDING,
        role: toParticipantRole(participantInput.role),
        user_id: participantInput.user_id ?? null,
      });
      participants.push(participant);
    }

    // Best-effort Graph scheduling — opt-in via env vars + flag.
    const finalInterview = await applyGraphScheduling(
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

    return { data: { interview: finalInterview, participants } };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to create interview",
    };
  }
}

export async function updateInterview(
  id: string,
  values: RecruitmentInterviewUpdateInput
): Promise<{ data?: JobInterviews; error?: string }> {
  const ctx = await requireAuth();
  const validated = recruitmentInterviewUpdateSchema.safeParse(values);
  if (!validated.success) {
    return { error: "Invalid interview payload" };
  }
  const input = validated.data;

  try {
    const { db } = await createSessionClient();
    const scope = toRecruitmentAdminScope(ctx);
    const lookups = await loadRecruitmentLookups(db);

    const existing = await db.getRow<JobInterviews>(
      DATABASE_ID,
      "job_interviews",
      id
    );
    assertInterviewWriteAccess(scope, lookups, {
      campus_id: existing.campus_id,
      department_id: existing.department_id,
    });

    const patch: Partial<JobInterviews> = {};
    if (input.title !== undefined) {
      patch.title = input.title;
    }
    if (input.round !== undefined) {
      patch.round = input.round;
    }
    if (input.timezone !== undefined) {
      patch.timezone = input.timezone;
    }
    if (input.location !== undefined) {
      patch.location = input.location ?? null;
    }
    if (input.meeting_url !== undefined) {
      patch.meeting_url = input.meeting_url ?? null;
    }
    if (input.notes !== undefined) {
      patch.notes = input.notes ?? null;
    }
    if (input.status !== undefined) {
      patch.status = input.status as JobInterviewsStatus;
    }
    if (input.cancelled_reason !== undefined) {
      patch.cancelled_reason = input.cancelled_reason ?? null;
    }
    if (input.starts_at !== undefined) {
      patch.starts_at = new Date(input.starts_at).toISOString();
    }
    if (input.ends_at !== undefined) {
      patch.ends_at = new Date(input.ends_at).toISOString();
    }

    const updated = await db.updateRow<JobInterviews>(
      DATABASE_ID,
      "job_interviews",
      id,
      patch
    );

    await logAuditEvent(ctx, "recruitment.interview.update", {
      payload: { keys: Object.keys(patch) },
      resourceId: id,
      resourceType: "job_interview",
    });

    return { data: updated };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to update interview",
    };
  }
}

export async function cancelInterview(
  id: string,
  reason?: string
): Promise<{ data?: JobInterviews; error?: string }> {
  const ctx = await requireAuth();
  try {
    const { db } = await createSessionClient();
    const scope = toRecruitmentAdminScope(ctx);
    const lookups = await loadRecruitmentLookups(db);

    const existing = await db.getRow<JobInterviews>(
      DATABASE_ID,
      "job_interviews",
      id
    );
    assertInterviewWriteAccess(scope, lookups, {
      campus_id: existing.campus_id,
      department_id: existing.department_id,
    });

    // Best-effort Graph cancel; ignore failures.
    if (existing.outlook_event_id) {
      try {
        const lead = await db.listRows<JobInterviewParticipants>(
          DATABASE_ID,
          "job_interview_participants",
          [
            Query.equal("interview_id", id),
            Query.equal("is_lead", true),
            Query.limit(1),
          ]
        );
        const organizerUpn = lead.rows[0]?.email ?? ctx.email ?? null;
        if (organizerUpn) {
          await cancelInterviewOnGraph(
            organizerUpn,
            existing.outlook_event_id,
            reason
          );
        }
      } catch (graphError) {
        console.warn(`Graph cancel failed for interview ${id}`, graphError);
      }
    }

    const updated = await db.updateRow<JobInterviews>(
      DATABASE_ID,
      "job_interviews",
      id,
      {
        cancelled_reason: reason ?? null,
        status: JobInterviewsStatus.CANCELLED,
      }
    );

    await logAuditEvent(ctx, "recruitment.interview.cancel", {
      payload: { reason: reason ?? null },
      resourceId: id,
      resourceType: "job_interview",
    });

    return { data: updated };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to cancel interview",
    };
  }
}

export async function addInterviewParticipant(
  interviewId: string,
  input: {
    email: string;
    user_id?: string | null;
    display_name?: string | null;
    role?: "interviewer" | "observer";
    is_lead?: boolean;
  }
): Promise<{ data?: JobInterviewParticipants; error?: string }> {
  const ctx = await requireAuth();
  try {
    const { db } = await createSessionClient();
    const scope = toRecruitmentAdminScope(ctx);
    const lookups = await loadRecruitmentLookups(db);

    const interview = await db.getRow<JobInterviews>(
      DATABASE_ID,
      "job_interviews",
      interviewId
    );
    assertInterviewWriteAccess(scope, lookups, {
      campus_id: interview.campus_id,
      department_id: interview.department_id,
    });

    const participant = await createTypedRow<
      JobInterviewParticipants,
      JobInterviewParticipantWriteInput
    >(db, DATABASE_ID, "job_interview_participants", ID.unique(), {
      display_name: input.display_name ?? null,
      email: input.email,
      interview_id: interviewId,
      is_lead: input.is_lead ?? false,
      response_status: JobInterviewParticipantsResponseStatus.PENDING,
      role: toParticipantRole(input.role ?? "interviewer"),
      user_id: input.user_id ?? null,
    });

    await logAuditEvent(ctx, "recruitment.interview.participant_add", {
      payload: { email: input.email, role: input.role ?? "interviewer" },
      resourceId: interviewId,
      resourceType: "job_interview",
    });

    return { data: participant };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to add interview participant",
    };
  }
}

export async function removeInterviewParticipant(
  interviewId: string,
  participantId: string
): Promise<{ success?: boolean; error?: string }> {
  const ctx = await requireAuth();
  try {
    const { db } = await createSessionClient();
    const scope = toRecruitmentAdminScope(ctx);
    const lookups = await loadRecruitmentLookups(db);

    const interview = await db.getRow<JobInterviews>(
      DATABASE_ID,
      "job_interviews",
      interviewId
    );
    assertInterviewWriteAccess(scope, lookups, {
      campus_id: interview.campus_id,
      department_id: interview.department_id,
    });

    await db.deleteRow(
      DATABASE_ID,
      "job_interview_participants",
      participantId
    );

    await logAuditEvent(ctx, "recruitment.interview.participant_remove", {
      payload: { participantId },
      resourceId: interviewId,
      resourceType: "job_interview",
    });

    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to remove interview participant",
    };
  }
}

export interface ScorecardWithSummary {
  criteria: RecruitmentScorecardCriterion[];
  scorecard: JobInterviewScorecards;
}

export async function listScorecardsForInterview(
  interviewId: string
): Promise<ScorecardWithSummary[]> {
  await requireAuth();
  const { db } = await createSessionClient();
  const response = await db.listRows<JobInterviewScorecards>(
    DATABASE_ID,
    "job_interview_scorecards",
    [Query.equal("interview_id", interviewId), Query.limit(50)]
  );
  return response.rows.map((scorecard) => ({
    criteria: scorecard.criteria ? safeParseCriteria(scorecard.criteria) : [],
    scorecard,
  }));
}

function safeParseCriteria(value: string): RecruitmentScorecardCriterion[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? (parsed as RecruitmentScorecardCriterion[])
      : [];
  } catch {
    return [];
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
        payload
      );
    } else {
      saved = await createTypedRow<
        JobInterviewScorecards,
        JobInterviewScorecardWriteInput
      >(db, DATABASE_ID, "job_interview_scorecards", ID.unique(), payload);
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

export async function listInterviewsForUser(opts?: {
  from?: string;
  to?: string;
}): Promise<InterviewWithParticipants[]> {
  const ctx = await requireAuth();
  const { db } = await createSessionClient();

  // Find every interview where the user is a participant.
  const memberships = await db.listRows<JobInterviewParticipants>(
    DATABASE_ID,
    "job_interview_participants",
    [Query.equal("user_id", ctx.userId), Query.limit(200)]
  );
  const interviewIds = Array.from(
    new Set(memberships.rows.map((membership) => membership.interview_id))
  );
  if (interviewIds.length === 0) {
    return [];
  }

  const queries = [
    Query.select(["*", "participants.*"]),
    Query.equal("$id", interviewIds),
    Query.orderAsc("starts_at"),
    Query.limit(200),
  ];
  if (opts?.from) {
    queries.push(Query.greaterThanEqual("starts_at", opts.from));
  }
  if (opts?.to) {
    queries.push(Query.lessThanEqual("starts_at", opts.to));
  }

  const interviews = await db.listRows<JobInterviews>(
    DATABASE_ID,
    "job_interviews",
    queries
  );

  return interviews.rows.map((interview) => ({
    interview,
    participants: (interview.participants ?? []) as JobInterviewParticipants[],
  }));
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

    const issued = issueBookingToken();
    const ttlDays =
      input.expires_in_days ?? RECRUITMENT_BOOKING_TOKEN_DEFAULT_TTL_DAYS;
    const expiresAt = new Date(
      Date.now() + ttlDays * 24 * 60 * 60 * 1000
    ).toISOString();

    await db.createRow(DATABASE_ID, "recruitment_booking_tokens", ID.unique(), {
      application_id: input.application_id,
      consumed_at: null,
      created_by_user_id: ctx.userId,
      duration_minutes: input.duration_minutes,
      expires_at: expiresAt,
      interview_id: null,
      panel_user_ids: JSON.stringify(input.panel_user_ids),
      token_hash: issued.hash,
      window_from: new Date(input.window_from).toISOString(),
      window_to: new Date(input.window_to).toISOString(),
    });

    await logAuditEvent(ctx, "recruitment.booking.issue", {
      payload: {
        application_id: input.application_id,
        expires_at: expiresAt,
        panel_size: input.panel_user_ids.length,
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

export async function proposeInterviewSlots(input: {
  panelEmails: string[];
  from: string;
  to: string;
  durationMinutes: number;
}): Promise<{ available: boolean; slots: ProposedSlot[] }> {
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
  const result = await proposeSlotsForPanel({
    durationMinutes: input.durationMinutes,
    from: new Date(input.from),
    to: new Date(input.to),
    upns: input.panelEmails,
  });
  return { available: result.available, slots: result.slots };
}

export async function getInterviewWithParticipants(
  interviewId: string
): Promise<InterviewWithParticipants> {
  const ctx = await requireAuth();
  const { db } = await createSessionClient();
  const scope = toRecruitmentAdminScope(ctx);
  const lookups = await loadRecruitmentLookups(db);

  const data = await fetchInterviewWithParticipants(db, interviewId);
  assertInterviewWriteAccess(scope, lookups, {
    campus_id: data.interview.campus_id,
    department_id: data.interview.department_id,
  });
  return data;
}

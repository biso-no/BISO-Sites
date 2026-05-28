"use server";

import { Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import type {
  CandidateProfiles,
  JobApplicationAnswers,
  JobApplications,
  JobInterviewParticipants,
  JobInterviewScorecards,
  JobInterviews,
  Jobs,
} from "@repo/api/types/appwrite";
import { JobInterviewParticipantsRole } from "@repo/api/types/appwrite";
import { getRecruitmentJobById } from "@repo/shared/recruitment";
import {
  parseRecruitmentAiScreening,
  parseRecruitmentApplicationReviewMetadata,
  parseScorecardCriteria,
  type RecruitmentCustomQuestion,
  type RecruitmentScreeningRubric,
  recruitmentCustomQuestionsSchema,
  recruitmentScreeningRubricSchema,
} from "@repo/shared/types/recruitment";
import { revalidatePath } from "next/cache";
import { listRecruitmentReviewers } from "@/app/(portal)/_actions/jobs";
import { getUserAuthContext, type UserAuthContext } from "@/lib/authorization";
import {
  assertRecruitmentApplicationReviewAccess,
  assertRecruitmentVacancyWriteAccess,
  loadRecruitmentLookups,
  toRecruitmentAdminScope,
} from "@/lib/recruitment";
import {
  type CandidateScorecardSummary,
  daysSince,
  daysUntil,
  type FunnelStageDatum,
  initials,
  type PendingScorecard,
  RECRUITMENT_STAGES,
  type RecruitmentAnalytics,
  type RecruitmentWorkspaceData,
  type SourceDatum,
  type StageDaysDatum,
  sourceMeta,
  type WorkspaceCandidate,
  type WorkspaceInterview,
  type WorkspaceJob,
  type WorkspaceKpis,
} from "../_components/recruitment/view-model";

const DATABASE_ID = "app";
const BOARD_LIMIT = 500;
const WEEK_MS = 7 * 86_400_000;
const TRAILING_SLASH_RE = /\/$/;

type Db = Awaited<ReturnType<typeof createSessionClient>>["db"];

async function requireCtx(): Promise<UserAuthContext> {
  const ctx = await getUserAuthContext();
  if (!ctx) {
    throw new Error("Unauthorized");
  }
  return ctx;
}

const APPLICATION_BOARD_SELECT = [
  "*",
  "candidate_profile.$id",
  "candidate_profile.linkedin_url",
  "candidate_profile.current_role",
  "candidate_profile.current_employer",
  "candidate_profile.full_name",
] as const;

function pickActiveInterview(rows: JobInterviews[]): JobInterviews | null {
  if (rows.length === 0) {
    return null;
  }
  const active = rows.filter((row) => row.status !== "cancelled");
  const pool = active.length > 0 ? active : rows;
  return pool.reduce((best, row) => (row.round >= best.round ? row : best));
}

function summarizeScorecards(
  rows: JobInterviewScorecards[]
): CandidateScorecardSummary | null {
  if (rows.length === 0) {
    return null;
  }
  const scored = rows.filter((row) => typeof row.overall_score === "number");
  const overall =
    scored.length > 0
      ? scored.reduce((sum, row) => sum + (row.overall_score ?? 0), 0) /
        scored.length
      : null;
  return {
    count: rows.length,
    overall: overall == null ? null : Math.round(overall * 10) / 10,
    recommendation: rows.at(-1)?.recommendation ?? null,
  };
}

function mapCandidate(
  application: JobApplications,
  interviewsByApp: Map<string, JobInterviews[]>,
  participantsByInterview: Map<string, JobInterviewParticipants[]>,
  scorecardsByApp: Map<string, JobInterviewScorecards[]>
): WorkspaceCandidate {
  const screening = parseRecruitmentAiScreening(application.ai_screening);
  const review = parseRecruitmentApplicationReviewMetadata(
    application.review_metadata
  );
  const profile = application.candidate_profile as CandidateProfiles | null;
  const interviews = interviewsByApp.get(application.$id) ?? [];
  const active = pickActiveInterview(interviews);
  const activePanel = active
    ? (participantsByInterview.get(active.$id) ?? [])
        .filter((p) => p.role === JobInterviewParticipantsRole.INTERVIEWER)
        .map((p) => initials(p.display_name ?? p.email))
    : [];

  const starredRaw = (review as Record<string, unknown>).starred;

  return {
    appliedAt: application.$createdAt,
    coverLetter: application.cover_letter ?? null,
    currentRole: profile?.current_role ?? null,
    days: daysSince(application.$createdAt),
    dimensions: screening?.dimension_scores ?? [],
    email: application.applicant_email,
    gaps: screening
      ? [...screening.concerns, ...screening.must_have_missing].slice(0, 6)
      : [],
    id: application.$id,
    interview: active
      ? {
          endsAt: active.ends_at,
          id: active.$id,
          meetingUrl: active.meeting_url,
          panel: activePanel,
          round: active.round,
          startsAt: active.starts_at,
          status: active.status,
          teams: Boolean(active.teams_meeting_id),
          title: active.title,
        }
      : null,
    linkedin: profile?.linkedin_url ?? null,
    member: null,
    name: application.applicant_name,
    phone: application.applicant_phone ?? null,
    recommendedStatus: screening?.recommended_status ?? null,
    resumeFileId: application.resume_file_id ?? null,
    reviewNotes: review.review_notes ?? null,
    scorecard: summarizeScorecards(scorecardsByApp.get(application.$id) ?? []),
    score: application.screening_score ?? screening?.normalized_score ?? null,
    skills: screening?.must_have_matches ?? [],
    source: application.source ?? null,
    stage: application.status,
    starred: starredRaw === true,
    strengths: screening?.strengths ?? [],
    summary: screening?.summary ?? review.ai_screening_summary ?? null,
    year: null,
  };
}

function median(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

function buildFunnel(candidates: WorkspaceCandidate[]): FunnelStageDatum[] {
  const total = candidates.length || 1;
  // Funnel is cumulative: each stage counts candidates that reached it or beyond.
  const reachedOrder: Record<string, number> = {
    submitted: 0,
    reviewed: 1,
    interview: 2,
    accepted: 3,
  };
  return RECRUITMENT_STAGES.filter((stage) => stage.id !== "rejected").map(
    (stage) => {
      const threshold = reachedOrder[stage.id];
      const n = candidates.filter((candidate) => {
        if (candidate.stage === "rejected") {
          return false;
        }
        return (reachedOrder[candidate.stage] ?? -1) >= threshold;
      }).length;
      return {
        label: stage.label,
        n,
        pct: Math.round((n / total) * 100),
        stage: stage.id,
        tint: stage.tint,
      };
    }
  );
}

function buildSources(candidates: WorkspaceCandidate[]): SourceDatum[] {
  const total = candidates.length || 1;
  const grouped = new Map<
    string,
    { n: number; hires: number; label: string; tint: string }
  >();
  for (const candidate of candidates) {
    const meta = sourceMeta(candidate.source);
    const entry = grouped.get(meta.id) ?? {
      hires: 0,
      label: meta.label,
      n: 0,
      tint: meta.tint,
    };
    entry.n += 1;
    if (candidate.stage === "accepted") {
      entry.hires += 1;
    }
    grouped.set(meta.id, entry);
  }
  return Array.from(grouped.entries())
    .map(([source, entry]) => ({
      hires: entry.hires,
      label: entry.label,
      n: entry.n,
      pct: Math.round((entry.n / total) * 100),
      source,
      tint: entry.tint,
    }))
    .sort((a, b) => b.n - a.n);
}

function buildTtfTrend(applications: JobApplications[]): number[] {
  const now = Date.now();
  const buckets: number[][] = Array.from({ length: 8 }, () => []);
  for (const application of applications) {
    if (application.status !== "accepted") {
      continue;
    }
    const decided = new Date(application.$updatedAt).getTime();
    const created = new Date(application.$createdAt).getTime();
    const weeksAgo = Math.floor((now - decided) / WEEK_MS);
    if (weeksAgo < 0 || weeksAgo > 7) {
      continue;
    }
    const days = Math.max(0, Math.round((decided - created) / 86_400_000));
    buckets[7 - weeksAgo].push(days);
  }
  const trend: number[] = [];
  for (const bucket of buckets) {
    if (bucket.length > 0) {
      trend.push(
        Math.round(
          bucket.reduce((sum, value) => sum + value, 0) / bucket.length
        )
      );
    }
  }
  return trend;
}

function buildStageDays(
  applications: JobApplications[],
  interviewsByApp: Map<string, JobInterviews[]>
): StageDaysDatum[] {
  const avg = (values: number[]): number | null =>
    values.length === 0
      ? null
      : Math.round(
          (values.reduce((sum, value) => sum + value, 0) / values.length) * 10
        ) / 10;

  const appliedToShortlist: number[] = [];
  const shortlistToInterview: number[] = [];
  const interviewToOffer: number[] = [];

  for (const application of applications) {
    const created = new Date(application.$createdAt).getTime();
    const updated = new Date(application.$updatedAt).getTime();
    const interviews = interviewsByApp.get(application.$id) ?? [];
    const firstInterview = interviews
      .map((row) => new Date(row.$createdAt).getTime())
      .sort((a, b) => a - b)[0];

    if (
      application.status === "reviewed" ||
      application.status === "interview" ||
      application.status === "accepted"
    ) {
      appliedToShortlist.push((updated - created) / 86_400_000);
    }
    if (firstInterview) {
      shortlistToInterview.push(
        Math.max(0, (firstInterview - created) / 86_400_000)
      );
    }
    if (application.status === "accepted" && firstInterview) {
      interviewToOffer.push(
        Math.max(0, (updated - firstInterview) / 86_400_000)
      );
    }
  }

  const result: StageDaysDatum[] = [];
  const a = avg(appliedToShortlist);
  const b = avg(shortlistToInterview);
  const c = avg(interviewToOffer);
  if (a != null) {
    result.push({ days: a, label: "Applied -> Shortlist" });
  }
  if (b != null) {
    result.push({ days: b, label: "Shortlist -> Interview" });
  }
  if (c != null) {
    result.push({ days: c, label: "Interview -> Offer" });
  }
  return result;
}

function buildAnalytics(
  candidates: WorkspaceCandidate[],
  applications: JobApplications[],
  interviewsByApp: Map<string, JobInterviews[]>
): RecruitmentAnalytics {
  const total = candidates.length;
  const scores = candidates
    .map((candidate) => candidate.score)
    .filter((score): score is number => typeof score === "number");
  const rejected = candidates.filter(
    (candidate) => candidate.stage === "rejected"
  ).length;

  return {
    aboveNinety: scores.filter((score) => score >= 90).length,
    declineRate: total > 0 ? Math.round((rejected / total) * 1000) / 10 : null,
    funnel: buildFunnel(candidates),
    medianMatch: median(scores),
    memberShare: null,
    sources: buildSources(candidates),
    stageDays: buildStageDays(applications, interviewsByApp),
    total,
    ttfTrend: buildTtfTrend(applications),
  };
}

function buildKpis(
  candidates: WorkspaceCandidate[],
  interviews: JobInterviews[],
  deadline: string | null
): WorkspaceKpis {
  const now = Date.now();
  const weekFromNow = now + WEEK_MS;
  const interviewsThisWeek = interviews.filter((row) => {
    if (!row.starts_at || row.status === "cancelled") {
      return false;
    }
    const starts = new Date(row.starts_at).getTime();
    return starts >= now && starts <= weekFromNow;
  }).length;

  return {
    aiShortlisted: candidates.filter(
      (candidate) => (candidate.score ?? 0) >= 85
    ).length,
    applicants: candidates.length,
    awaitingConfirm: interviews.filter((row) => row.status === "proposed")
      .length,
    daysToClose: daysUntil(deadline),
    inPipeline: candidates.filter(
      (candidate) =>
        candidate.stage !== "rejected" && candidate.stage !== "accepted"
    ).length,
    interviewsThisWeek,
    newToday: candidates.filter(
      (candidate) => candidate.days <= 1 && candidate.stage === "submitted"
    ).length,
    offersOut: candidates.filter((candidate) => candidate.stage === "accepted")
      .length,
  };
}

async function loadJobInterviews(
  db: Db,
  jobId: string
): Promise<{
  interviews: JobInterviews[];
  interviewsByApp: Map<string, JobInterviews[]>;
  participantsByInterview: Map<string, JobInterviewParticipants[]>;
}> {
  const response = await db.listRows<JobInterviews>(
    DATABASE_ID,
    "job_interviews",
    [
      Query.select(["*", "participants.*"]),
      Query.equal("job_id", jobId),
      Query.orderAsc("round"),
      Query.limit(BOARD_LIMIT),
    ]
  );
  const interviewsByApp = new Map<string, JobInterviews[]>();
  const participantsByInterview = new Map<string, JobInterviewParticipants[]>();
  for (const interview of response.rows) {
    const list = interviewsByApp.get(interview.application_id) ?? [];
    list.push(interview);
    interviewsByApp.set(interview.application_id, list);
    participantsByInterview.set(
      interview.$id,
      (interview.participants ?? []) as JobInterviewParticipants[]
    );
  }
  return {
    interviews: response.rows,
    interviewsByApp,
    participantsByInterview,
  };
}

async function loadScorecards(
  db: Db,
  jobId: string
): Promise<Map<string, JobInterviewScorecards[]>> {
  const map = new Map<string, JobInterviewScorecards[]>();
  try {
    const response = await db.listRows<JobInterviewScorecards>(
      DATABASE_ID,
      "job_interview_scorecards",
      [Query.equal("interview.job_id", jobId), Query.limit(BOARD_LIMIT)]
    );
    for (const scorecard of response.rows) {
      const list = map.get(scorecard.application_id) ?? [];
      list.push(scorecard);
      map.set(scorecard.application_id, list);
    }
  } catch {
    // Relationship-aware query may not be supported; scorecards degrade to empty.
  }
  return map;
}

export async function getRecruitmentWorkspace(
  jobId: string
): Promise<RecruitmentWorkspaceData | null> {
  const ctx = await requireCtx();
  const { db } = await createSessionClient();
  const scope = toRecruitmentAdminScope(ctx);
  const lookups = await loadRecruitmentLookups(db);

  const vacancy = await getRecruitmentJobById(db, jobId);
  if (!vacancy) {
    return null;
  }
  assertRecruitmentApplicationReviewAccess(scope, lookups, {
    campus_id: vacancy.campus_id,
    department_id: vacancy.department_id,
  });

  const [applicationsResponse, interviewData, scorecardsByApp, reviewerResult] =
    await Promise.all([
      db.listRows<JobApplications>(DATABASE_ID, "job_applications", [
        Query.select([...APPLICATION_BOARD_SELECT]),
        Query.equal("job_id", jobId),
        Query.orderDesc("$createdAt"),
        Query.limit(BOARD_LIMIT),
      ]),
      loadJobInterviews(db, jobId),
      loadScorecards(db, jobId),
      listRecruitmentReviewers(jobId).catch(() => ({ data: [] })),
    ]);

  const candidates = applicationsResponse.rows.map((application) =>
    mapCandidate(
      application,
      interviewData.interviewsByApp,
      interviewData.participantsByInterview,
      scorecardsByApp
    )
  );

  const nameByApp = new Map(
    applicationsResponse.rows.map((row) => [row.$id, row.applicant_name])
  );
  const interviews: WorkspaceInterview[] = interviewData.interviews.map(
    (interview) => ({
      applicationId: interview.application_id,
      candidateName: nameByApp.get(interview.application_id) ?? "Candidate",
      endsAt: interview.ends_at,
      id: interview.$id,
      panel: (interviewData.participantsByInterview.get(interview.$id) ?? [])
        .filter((p) => p.role === JobInterviewParticipantsRole.INTERVIEWER)
        .map((p) => initials(p.display_name ?? p.email)),
      round: interview.round,
      startsAt: interview.starts_at,
      status: interview.status,
      teams: Boolean(interview.teams_meeting_id),
      title: interview.title,
    })
  );
  const pendingScorecards: PendingScorecard[] = interviewData.interviews
    .filter(
      (interview) =>
        interview.status !== "cancelled" &&
        (scorecardsByApp.get(interview.application_id) ?? []).length === 0
    )
    .map((interview) => {
      const starts = interview.starts_at
        ? new Date(interview.starts_at).getTime()
        : null;
      return {
        applicationId: interview.application_id,
        candidateName: nameByApp.get(interview.application_id) ?? "Candidate",
        due: starts != null && starts < Date.now(),
        interviewId: interview.$id,
        round: interview.round,
      };
    });

  const titleNo =
    vacancy.translations.find((t) => t.locale === "no")?.title ??
    vacancy.translations[0]?.title ??
    "Vacancy";
  const titleEn =
    vacancy.translations.find((t) => t.locale === "en")?.title ?? titleNo;

  const webBase = (
    process.env.WEB_PUBLIC_BASE_URL ??
    process.env.NEXT_PUBLIC_WEB_BASE_URL ??
    "https://app.biso.no"
  ).replace(TRAILING_SLASH_RE, "");

  const job: WorkspaceJob = {
    audience: vacancy.metadata.audience ?? null,
    autoScreen: vacancy.auto_screen,
    campusColor: "#6b1e1e",
    campusName: vacancy.campus?.name ?? null,
    commitment: vacancy.metadata.commitment ?? null,
    customQuestions: vacancy.custom_questions ?? [],
    deadline: vacancy.application_deadline ?? null,
    departmentCrest: (vacancy.department?.Name ?? "B").charAt(0).toUpperCase(),
    departmentName: vacancy.department?.Name ?? null,
    id: vacancy.$id,
    publicUrl: `${webBase}/jobs/${vacancy.slug}`,
    screeningRubric: vacancy.screening_rubric ?? {
      criteria: [],
      must_have: [],
      nice_to_have: [],
    },
    slug: vacancy.slug,
    startDate: vacancy.metadata.start_date ?? null,
    status: vacancy.status,
    term: vacancy.metadata.term ?? null,
    titleEn,
    titleNo,
  };

  return {
    analytics: buildAnalytics(
      candidates,
      applicationsResponse.rows,
      interviewData.interviewsByApp
    ),
    candidates,
    currentUserId: ctx.userId,
    interviews,
    job,
    kpis: buildKpis(candidates, interviewData.interviews, job.deadline),
    pendingScorecards,
    panel: (reviewerResult.data ?? []).map((reviewer) => ({
      email: reviewer.email,
      id: reviewer.id,
      name: reviewer.name,
      role: "Reviewer",
    })),
  };
}

// ---------------------------------------------------------------------------
// Candidate detail (lazy-loaded when a drawer opens)
// ---------------------------------------------------------------------------

export interface CandidateAnswer {
  answer: string | null;
  answerType: string;
  questionId: string;
  questionLabel: string;
}

export interface CandidateScorecardDetail {
  concerns: string | null;
  criteria: {
    key: string;
    label: string;
    score: number | null;
    comment: string | null;
  }[];
  id: string;
  interviewerUserId: string;
  overall: number | null;
  recommendation: string | null;
  strengths: string | null;
  submittedAt: string | null;
}

export interface CandidateInterviewDetail {
  endsAt: string | null;
  id: string;
  location: string | null;
  meetingUrl: string | null;
  panel: {
    name: string;
    email: string;
    role: string;
    responseStatus: string;
  }[];
  round: number;
  startsAt: string | null;
  status: string;
  teams: boolean;
  title: string;
}

export interface CandidateDetail {
  answers: CandidateAnswer[];
  interviews: CandidateInterviewDetail[];
  scorecards: CandidateScorecardDetail[];
}

export async function getCandidateDetail(
  applicationId: string
): Promise<CandidateDetail> {
  const ctx = await requireCtx();
  const { db } = await createSessionClient();
  const scope = toRecruitmentAdminScope(ctx);
  const lookups = await loadRecruitmentLookups(db);

  const application = await db.getRow<JobApplications>(
    DATABASE_ID,
    "job_applications",
    applicationId,
    [Query.select(["$id", "job_id", "job.campus_id", "job.department_id"])]
  );
  const job = application.job as Jobs | null;
  if (!job) {
    throw new Error("Vacancy not found");
  }
  assertRecruitmentApplicationReviewAccess(scope, lookups, job);

  const [answersResponse, interviewsResponse] = await Promise.all([
    db.listRows<JobApplicationAnswers>(DATABASE_ID, "job_application_answers", [
      Query.equal("application_id", applicationId),
      Query.limit(50),
    ]),
    db.listRows<JobInterviews>(DATABASE_ID, "job_interviews", [
      Query.select(["*", "participants.*"]),
      Query.equal("application_id", applicationId),
      Query.orderAsc("round"),
      Query.limit(50),
    ]),
  ]);

  const interviewIds = interviewsResponse.rows.map((row) => row.$id);
  const scorecards =
    interviewIds.length > 0
      ? await db.listRows<JobInterviewScorecards>(
          DATABASE_ID,
          "job_interview_scorecards",
          [Query.equal("interview_id", interviewIds), Query.limit(100)]
        )
      : { rows: [] as JobInterviewScorecards[], total: 0 };

  return {
    answers: answersResponse.rows.map((row) => ({
      answer: row.answer ?? null,
      answerType: row.answer_type,
      questionId: row.question_id,
      questionLabel: row.question_label,
    })),
    interviews: interviewsResponse.rows.map((row) => ({
      endsAt: row.ends_at,
      id: row.$id,
      location: row.location,
      meetingUrl: row.meeting_url,
      panel: ((row.participants ?? []) as JobInterviewParticipants[]).map(
        (p) => ({
          email: p.email,
          name: p.display_name ?? p.email,
          responseStatus: p.response_status,
          role: p.role,
        })
      ),
      round: row.round,
      startsAt: row.starts_at,
      status: row.status,
      teams: Boolean(row.teams_meeting_id),
      title: row.title,
    })),
    scorecards: scorecards.rows.map((row) => ({
      concerns: row.concerns ?? null,
      criteria: parseScorecardCriteria(row.criteria).map((c) => ({
        comment: c.comment ?? null,
        key: c.key,
        label: c.label,
        score: c.score ?? null,
      })),
      id: row.$id,
      interviewerUserId: row.interviewer_user_id,
      overall: row.overall_score ?? null,
      recommendation: row.recommendation ?? null,
      strengths: row.strengths ?? null,
      submittedAt: row.submitted_at,
    })),
  };
}

// ---------------------------------------------------------------------------
// Candidate starring (persisted in review_metadata)
// ---------------------------------------------------------------------------

export async function setCandidateStarred(
  applicationId: string,
  starred: boolean
): Promise<{ data?: boolean; error?: string }> {
  const ctx = await requireCtx();
  try {
    const { db } = await createSessionClient();
    const scope = toRecruitmentAdminScope(ctx);
    const lookups = await loadRecruitmentLookups(db);
    const application = await db.getRow<JobApplications>(
      DATABASE_ID,
      "job_applications",
      applicationId,
      [
        Query.select([
          "$id",
          "review_metadata",
          "job.campus_id",
          "job.department_id",
        ]),
      ]
    );
    const job = application.job as Jobs | null;
    if (!job) {
      return { error: "Vacancy not found" };
    }
    assertRecruitmentApplicationReviewAccess(scope, lookups, job);

    const review = parseRecruitmentApplicationReviewMetadata(
      application.review_metadata
    );
    const next = { ...review, starred } as Record<string, unknown>;
    await db.updateRow(DATABASE_ID, "job_applications", applicationId, {
      review_metadata: JSON.stringify(next),
    });
    return { data: starred };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to update star",
    };
  }
}

// ---------------------------------------------------------------------------
// Resume URL (admin-signed) for the drawer
// ---------------------------------------------------------------------------

export async function getResumeViewUrl(
  applicationId: string
): Promise<{ url?: string; error?: string }> {
  await requireCtx();
  // The resume download is served by the existing API route which performs
  // its own scope check. We just hand the client the route.
  return { url: `/api/recruitment/applications/${applicationId}/resume` };
}

// ---------------------------------------------------------------------------
// Form & rubric persistence (updates only the relevant jobs columns)
// ---------------------------------------------------------------------------

async function assertJobWritable(db: Db, jobId: string): Promise<void> {
  const ctx = await requireCtx();
  const scope = toRecruitmentAdminScope(ctx);
  const lookups = await loadRecruitmentLookups(db);
  const vacancy = await getRecruitmentJobById(db, jobId);
  if (!vacancy) {
    throw new Error("Vacancy not found");
  }
  assertRecruitmentVacancyWriteAccess(scope, lookups, {
    campus_id: vacancy.campus_id,
    department_id: vacancy.department_id,
  });
}

export async function updateRecruitmentForm(
  jobId: string,
  input: {
    customQuestions: RecruitmentCustomQuestion[];
    screeningRubric: RecruitmentScreeningRubric;
  }
): Promise<{ data?: boolean; error?: string }> {
  const questions = recruitmentCustomQuestionsSchema.safeParse(
    input.customQuestions
  );
  const rubric = recruitmentScreeningRubricSchema.safeParse(
    input.screeningRubric
  );
  if (!(questions.success && rubric.success)) {
    return { error: "Invalid form or rubric payload" };
  }
  try {
    const { db } = await createSessionClient();
    await assertJobWritable(db, jobId);
    await db.updateRow(DATABASE_ID, "jobs", jobId, {
      custom_questions: JSON.stringify(questions.data),
      screening_rubric: JSON.stringify(rubric.data),
    });
    revalidatePath(`/jobs/${jobId}/applications`);
    return { data: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to save form",
    };
  }
}

export async function setAutoScreen(
  jobId: string,
  autoScreen: boolean
): Promise<{ data?: boolean; error?: string }> {
  try {
    const { db } = await createSessionClient();
    await assertJobWritable(db, jobId);
    await db.updateRow(DATABASE_ID, "jobs", jobId, { auto_screen: autoScreen });
    revalidatePath(`/jobs/${jobId}/applications`);
    return { data: autoScreen };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to update setting",
    };
  }
}

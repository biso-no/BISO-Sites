import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type {
  JobApplicationAnswers,
  JobApplications,
  JobInterviews,
  Jobs,
} from "@repo/api/types/appwrite";
import { isAuthenticatedAppwriteUser } from "@repo/shared/recruitment";
import { parseRecruitmentApplicationReviewMetadata } from "@repo/shared/types/recruitment";
import { type NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient, extractJwtFromRequest } from "@/lib/auth";
import { applyCorsHeaders, corsPreflightResponse } from "@/lib/cors";

export const runtime = "nodejs";

const MAX_APPLICATIONS = 50;
const MAX_ANSWER_ROWS = 200;
const INTERVIEWS_PER_APPLICATION = 3;

interface ApplicationAnswerView {
  answer: string | null;
  question_label: string;
}

interface ApplicationInterviewView {
  ends_at: string | null;
  id: string;
  location: string | null;
  meeting_url: string | null;
  starts_at: string | null;
  status: string;
  title: string;
}

interface ApplicationView {
  answers: ApplicationAnswerView[];
  cover_letter: string | null;
  created_at: string;
  data_retention_until: string;
  hr_assigned_name: string | null;
  id: string;
  job: {
    id: string;
    slug: string;
    title: string;
    campus_name: string | null;
  } | null;
  next_interview: ApplicationInterviewView | null;
  resume_file_id: string | null;
  status: string;
}

function pickJobTitle(job: Jobs | undefined, locale: "en" | "no"): string {
  const translations =
    (job?.translations as Array<{ locale?: string; title?: string }>) ?? [];
  return (
    translations.find((tr) => tr.locale === locale)?.title ??
    translations[0]?.title ??
    job?.slug ??
    "Vacancy"
  );
}

function selectUpcomingInterviews(
  interviews: JobInterviews[]
): Map<string, JobInterviews> {
  const nextByApp = new Map<string, JobInterviews>();
  const now = Date.now();
  for (const interview of interviews) {
    if (interview.status === "cancelled") {
      continue;
    }
    const startsAt = interview.starts_at
      ? new Date(interview.starts_at).getTime()
      : 0;
    if (startsAt && startsAt < now) {
      continue;
    }
    const existing = nextByApp.get(interview.application_id);
    if (
      !existing ||
      (startsAt &&
        (!existing.starts_at ||
          startsAt < new Date(existing.starts_at).getTime()))
    ) {
      nextByApp.set(interview.application_id, interview);
    }
  }
  return nextByApp;
}

function groupAnswers(
  answers: JobApplicationAnswers[]
): Map<string, ApplicationAnswerView[]> {
  const answersByApp = new Map<string, ApplicationAnswerView[]>();
  for (const answerRow of answers) {
    const list = answersByApp.get(answerRow.application_id) ?? [];
    list.push({
      answer: answerRow.answer ?? null,
      question_label: answerRow.question_label,
    });
    answersByApp.set(answerRow.application_id, list);
  }
  return answersByApp;
}

export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin");

  try {
    if (!extractJwtFromRequest(req)) {
      return applyCorsHeaders(
        NextResponse.json(
          { success: false, error: "Authentication required" },
          { status: 401 }
        ),
        origin
      );
    }

    const { account } = await createAuthenticatedClient(req);
    const user = await account.get().catch(() => null);
    if (!(user && isAuthenticatedAppwriteUser(user) && user.email)) {
      return applyCorsHeaders(
        NextResponse.json(
          { success: false, error: "Authentication required" },
          { status: 401 }
        ),
        origin
      );
    }

    const locale =
      req.nextUrl.searchParams.get("locale") === "en" ? "en" : "no";

    const { db } = await createAdminClient();
    const apps = await db.listRows<JobApplications>("app", "job_applications", [
      Query.equal("applicant_email", user.email),
      Query.orderDesc("$createdAt"),
      Query.limit(MAX_APPLICATIONS),
    ]);

    if (apps.rows.length === 0) {
      return applyCorsHeaders(
        NextResponse.json({ success: true, applications: [] }),
        origin
      );
    }

    const jobIds = Array.from(new Set(apps.rows.map((a) => a.job_id)));
    const appIds = apps.rows.map((a) => a.$id);

    const jobsResult = await db.listRows<Jobs>("app", "jobs", [
      Query.equal("$id", jobIds),
      Query.select([
        "$id",
        "slug",
        "campus.name",
        "translations.locale",
        "translations.title",
      ]),
      Query.limit(jobIds.length),
    ]);
    const jobById = new Map(jobsResult.rows.map((job) => [job.$id, job]));

    const interviews = await db.listRows<JobInterviews>(
      "app",
      "job_interviews",
      [
        Query.equal("application_id", appIds),
        Query.orderAsc("starts_at"),
        Query.limit(appIds.length * INTERVIEWS_PER_APPLICATION),
      ]
    );
    const nextByApp = selectUpcomingInterviews(interviews.rows);

    const answersResult = await db.listRows<JobApplicationAnswers>(
      "app",
      "job_application_answers",
      [Query.equal("application_id", appIds), Query.limit(MAX_ANSWER_ROWS)]
    );
    const answersByApp = groupAnswers(answersResult.rows);

    const applications: ApplicationView[] = apps.rows.map((app) => {
      const job = jobById.get(app.job_id);
      const next = nextByApp.get(app.$id) ?? null;
      const review = parseRecruitmentApplicationReviewMetadata(
        app.review_metadata
      );

      return {
        id: app.$id,
        created_at: app.$createdAt,
        status: app.status,
        cover_letter: app.cover_letter ?? null,
        resume_file_id: app.resume_file_id ?? null,
        data_retention_until: app.data_retention_until,
        hr_assigned_name: review.assigned_hr_user_name ?? null,
        answers: answersByApp.get(app.$id) ?? [],
        job: job
          ? {
              id: job.$id,
              slug: job.slug ?? "",
              title: pickJobTitle(job, locale),
              campus_name: job.campus?.name ?? null,
            }
          : null,
        next_interview: next
          ? {
              id: next.$id,
              title: next.title,
              starts_at: next.starts_at,
              ends_at: next.ends_at,
              location: next.location,
              meeting_url: next.meeting_url,
              status: next.status,
            }
          : null,
      };
    });

    return applyCorsHeaders(
      NextResponse.json({ success: true, applications }),
      origin
    );
  } catch (error) {
    console.error("[applications] Unexpected error:", error);
    return applyCorsHeaders(
      NextResponse.json(
        { success: false, error: "Failed to load applications" },
        { status: 500 }
      ),
      origin
    );
  }
}

export function OPTIONS(req: NextRequest) {
  return corsPreflightResponse(req.headers.get("origin"));
}

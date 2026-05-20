import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type {
  JobApplicationAnswers,
  JobApplications,
  JobInterviewParticipants,
  JobInterviews,
  Jobs,
} from "@repo/api/types/appwrite";
import { Locale } from "@repo/api/types/appwrite";
import { parseRecruitmentApplicationReviewMetadata } from "@repo/shared/types/recruitment";
import { type NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/lib/auth";
import { isAuthenticatedAppwriteUser } from "@/lib/recruitment";

interface MyApplicationView {
  $id: string;
  $createdAt: string;
  status: JobApplications["status"];
  data_retention_until: string;
  cover_letter: string | null;
  resume_file_id: string | null;
  job: {
    $id: string;
    slug: string;
    title: string;
    campus_name: string | null;
  } | null;
  next_interview: {
    $id: string;
    starts_at: string | null;
    ends_at: string | null;
    title: string;
    location: string | null;
    meeting_url: string | null;
    status: JobInterviews["status"];
  } | null;
  answers: Array<{
    question_label: string;
    answer: string | null;
  }>;
  hr_assigned_name: string | null;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { account } = await createAuthenticatedClient(request);
    const user = await account.get();
    if (!(isAuthenticatedAppwriteUser(user) && user.email)) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { db } = await createAdminClient();
    const apps = await db.listRows<JobApplications>(
      "app",
      "job_applications",
      [
        Query.equal("applicant_email", user.email),
        Query.orderDesc("$createdAt"),
        Query.limit(50),
      ]
    );
    if (apps.rows.length === 0) {
      return NextResponse.json({ rows: [] });
    }

    const jobIds = Array.from(
      new Set(apps.rows.map((application) => application.job_id))
    );
    const applicationIds = apps.rows.map((application) => application.$id);

    // Fetch vacancies + their preferred-locale translation via the new
    // Relationships GA dotted-path select so we get titles inline.
    const jobs = await db.listRows<Jobs>("app", "jobs", [
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
    const jobById = new Map(jobs.rows.map((job) => [job.$id, job]));

    const interviews = await db.listRows<JobInterviews>(
      "app",
      "job_interviews",
      [
        Query.equal("application_id", applicationIds),
        Query.orderAsc("starts_at"),
        Query.limit(applicationIds.length * 3),
      ]
    );
    const nextByApplication = new Map<string, JobInterviews>();
    const now = Date.now();
    for (const interview of interviews.rows) {
      if (interview.status === "cancelled") {
        continue;
      }
      const startsAt = interview.starts_at
        ? new Date(interview.starts_at).getTime()
        : 0;
      if (startsAt && startsAt < now) {
        continue;
      }
      const existing = nextByApplication.get(interview.application_id);
      if (
        !existing ||
        (startsAt &&
          (!existing.starts_at ||
            startsAt < new Date(existing.starts_at).getTime()))
      ) {
        nextByApplication.set(interview.application_id, interview);
      }
    }

    const answers = await db.listRows<JobApplicationAnswers>(
      "app",
      "job_application_answers",
      [Query.equal("application_id", applicationIds), Query.limit(200)]
    );
    const answersByApplication = new Map<
      string,
      Array<{ question_label: string; answer: string | null }>
    >();
    for (const answer of answers.rows) {
      const list = answersByApplication.get(answer.application_id) ?? [];
      list.push({
        answer: answer.answer ?? null,
        question_label: answer.question_label,
      });
      answersByApplication.set(answer.application_id, list);
    }

    const rows: MyApplicationView[] = apps.rows.map((application) => {
      const job = jobById.get(application.job_id);
      const localizedTitle = pickTitle(job, Locale.NO);
      const next = nextByApplication.get(application.$id) ?? null;
      const review = parseRecruitmentApplicationReviewMetadata(
        application.review_metadata
      );

      return {
        $createdAt: application.$createdAt,
        $id: application.$id,
        answers: answersByApplication.get(application.$id) ?? [],
        cover_letter: application.cover_letter ?? null,
        data_retention_until: application.data_retention_until,
        hr_assigned_name: review.assigned_hr_user_name ?? null,
        job: job
          ? {
              $id: job.$id,
              campus_name: job.campus?.name ?? null,
              slug: job.slug,
              title: localizedTitle,
            }
          : null,
        next_interview: next
          ? {
              $id: next.$id,
              ends_at: next.ends_at,
              location: next.location,
              meeting_url: next.meeting_url,
              starts_at: next.starts_at,
              status: next.status,
              title: next.title,
            }
          : null,
        resume_file_id: application.resume_file_id ?? null,
        status: application.status,
      };
    });

    return NextResponse.json({ rows });
  } catch (error) {
    console.error("Failed to list my applications", error);
    return NextResponse.json(
      { error: "Failed to load applications" },
      { status: 500 }
    );
  }
}

function pickTitle(
  job: Jobs | undefined,
  preferredLocale: Locale
): string {
  if (!job) {
    return "Vacancy";
  }
  const translations = (job.translations as
    | Array<{ locale?: string; title?: string }>
    | undefined) ?? [];
  const preferred = translations.find(
    (translation) => translation.locale === preferredLocale
  );
  return preferred?.title ?? translations[0]?.title ?? job.slug ?? "Vacancy";
}

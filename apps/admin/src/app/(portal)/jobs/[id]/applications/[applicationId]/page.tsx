import { ArrowLeft, Briefcase, FileText, Mail, Phone, UserRound } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  getJob,
  getJobApplication,
  listRecruitmentReviewers,
} from "../../../../_actions/jobs";
import {
  type InterviewWithParticipants,
  listInterviewsForApplication,
  listScorecardsForInterview,
  type ScorecardWithSummary,
} from "../../../../_actions/interviews";
import { PageHeader } from "../../../../_components/page-header";
import { StatusBadge } from "../../../../_components/status-badge";
import { StudioLinkButton } from "../../../../_components/studio";
import { JobInterviewPanel } from "../../../_components/job-interview-panel";
import { getUserAuthContext } from "@/lib/authorization";

interface PageProps {
  params: Promise<{ id: string; applicationId: string }>;
}

export default async function ApplicationDetailPage({ params }: PageProps) {
  const { id, applicationId } = await params;
  const ctx = await getUserAuthContext();
  if (!ctx) {
    redirect("/auth/login");
  }

  const [job, application] = await Promise.all([
    getJob(id),
    getJobApplication(applicationId).catch(() => null),
  ]);

  if (!(job && application) || application.job_id !== id) {
    notFound();
  }

  const title =
    job.translations.find((translation) => translation.locale === "no")
      ?.title ??
    job.translations[0]?.title ??
    "Vacancy";

  const [interviews, reviewerResult] = await Promise.all([
    listInterviewsForApplication(applicationId).catch(
      () => [] as InterviewWithParticipants[]
    ),
    listRecruitmentReviewers(id),
  ]);
  const reviewers = reviewerResult.data ?? [];

  const scorecardEntries = await Promise.all(
    interviews.map((entry) =>
      listScorecardsForInterview(entry.interview.$id).then(
        (scorecards) => [entry.interview.$id, scorecards] as const
      )
    )
  );
  const scorecardsByInterview = new Map<string, ScorecardWithSummary[]>(
    scorecardEntries
  );

  const screening = (application as unknown as {
    ai_screening?: string | null;
    screening_score?: number | null;
  });

  return (
    <div className="pb-12">
      <PageHeader
        description={`${application.applicant_name} · ${application.applicant_email}`}
        title={title}
      >
        <StudioLinkButton href={`/jobs/${id}/applications`}>
          <ArrowLeft size={14} />
          Back to applications
        </StudioLinkButton>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <div
            className="rounded-2xl p-5"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <h2
                className="font-light text-2xl tracking-tight"
                style={{ color: "#fff" }}
              >
                {application.applicant_name}
              </h2>
              <StatusBadge size="md" status={application.status} />
            </div>
            <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
              <p
                className="flex items-center gap-2"
                style={{ color: "rgba(255,255,255,0.65)" }}
              >
                <Mail size={14} />
                {application.applicant_email}
              </p>
              {application.applicant_phone ? (
                <p
                  className="flex items-center gap-2"
                  style={{ color: "rgba(255,255,255,0.65)" }}
                >
                  <Phone size={14} />
                  {application.applicant_phone}
                </p>
              ) : null}
              <p
                className="flex items-center gap-2"
                style={{ color: "rgba(255,255,255,0.65)" }}
              >
                <Briefcase size={14} />
                {title}
              </p>
              <p
                className="flex items-center gap-2"
                style={{ color: "rgba(255,255,255,0.65)" }}
              >
                <UserRound size={14} />
                Applied {new Date(application.$createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>

          {screening.ai_screening ? (
            <div
              className="rounded-2xl p-5"
              style={{
                background: "rgba(245,158,11,0.04)",
                border: "1px solid rgba(245,158,11,0.18)",
              }}
            >
              <div className="flex items-center justify-between">
                <p
                  className="text-xs uppercase tracking-[0.2em]"
                  style={{ color: "rgba(245,158,11,0.85)" }}
                >
                  AI screening summary
                </p>
                {typeof screening.screening_score === "number" ? (
                  <span
                    className="rounded-full px-2 py-0.5 text-xs"
                    style={{
                      background: "rgba(245,158,11,0.16)",
                      color: "#FCD34D",
                    }}
                  >
                    {screening.screening_score} / 100
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-sm" style={{ color: "#fff" }}>
                {application.review_metadata.ai_screening_summary ??
                  "AI screening complete. See the full report in the assistant pane."}
              </p>
            </div>
          ) : null}

          {application.cover_letter ? (
            <div
              className="rounded-2xl p-5"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <p
                className="mb-3 text-xs uppercase tracking-[0.2em]"
                style={{ color: "rgba(255,255,255,0.30)" }}
              >
                Cover letter
              </p>
              <p
                className="whitespace-pre-line text-sm"
                style={{ color: "rgba(255,255,255,0.8)" }}
              >
                {application.cover_letter}
              </p>
            </div>
          ) : null}

          {application.resume_file_id ? (
            <div
              className="flex items-center justify-between rounded-2xl p-5"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div className="flex items-center gap-3">
                <FileText size={20} style={{ color: "#7dd3fc" }} />
                <div>
                  <p className="font-medium text-sm" style={{ color: "#fff" }}>
                    Resume on file
                  </p>
                  <p
                    className="text-xs"
                    style={{ color: "rgba(255,255,255,0.45)" }}
                  >
                    Stored in recruitment_resumes bucket.
                  </p>
                </div>
              </div>
              <Link
                className="rounded-xl px-3 py-2 text-xs"
                href={`/jobs/applications?search=${encodeURIComponent(application.applicant_email)}`}
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "rgba(255,255,255,0.7)",
                }}
              >
                Download via list view
              </Link>
            </div>
          ) : null}

          <JobInterviewPanel
            applicantEmail={application.applicant_email}
            applicantName={application.applicant_name}
            applicationId={application.$id}
            currentUserId={ctx.userId}
            initialInterviews={interviews}
            reviewers={reviewers}
            scorecardsByInterview={scorecardsByInterview}
          />
        </div>

        <aside
          className="rounded-2xl p-5"
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <p
            className="mb-3 text-xs uppercase tracking-[0.2em]"
            style={{ color: "rgba(255,255,255,0.30)" }}
          >
            Quick links
          </p>
          <ul className="space-y-2 text-sm">
            <li>
              <Link
                className="block rounded-lg px-3 py-2 transition-colors"
                href={`/jobs/${id}`}
                style={{
                  background: "rgba(255,255,255,0.03)",
                  color: "#fff",
                }}
              >
                Open vacancy
              </Link>
            </li>
            <li>
              <Link
                className="block rounded-lg px-3 py-2 transition-colors"
                href={`/jobs/${id}/applications?view=kanban`}
                style={{
                  background: "rgba(255,255,255,0.03)",
                  color: "#fff",
                }}
              >
                Kanban pipeline
              </Link>
            </li>
            <li>
              <Link
                className="block rounded-lg px-3 py-2 transition-colors"
                href="/jobs/applications"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  color: "#fff",
                }}
              >
                All applications
              </Link>
            </li>
          </ul>
        </aside>
      </div>
    </div>
  );
}

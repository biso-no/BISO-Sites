import {
  ArrowLeft,
  Briefcase,
  FileText,
  Mail,
  Phone,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getUserAuthContext } from "@/lib/authorization";
import {
  type InterviewWithParticipants,
  listInterviewsForApplication,
  listScorecardsForInterview,
  type ScorecardWithSummary,
} from "../../../../_actions/interviews";
import {
  getJob,
  getJobApplication,
  listRecruitmentReviewers,
} from "../../../../_actions/jobs";
import { PageHeader } from "../../../../_components/page-header";
import { StatusBadge } from "../../../../_components/status-badge";
import { STUDIO, StudioLinkButton } from "../../../../_components/studio";
import { JobInterviewPanel } from "../../../_components/job-interview-panel";

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
              background: STUDIO.paper2,
              border: `1px solid ${STUDIO.rule}`,
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <h2
                className="font-light text-2xl tracking-tight"
                style={{ color: STUDIO.ink }}
              >
                {application.applicant_name}
              </h2>
              <StatusBadge size="md" status={application.status} />
            </div>
            <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
              <p
                className="flex items-center gap-2"
                style={{ color: STUDIO.ink3 }}
              >
                <Mail size={14} />
                {application.applicant_email}
              </p>
              {application.applicant_phone ? (
                <p
                  className="flex items-center gap-2"
                  style={{ color: STUDIO.ink3 }}
                >
                  <Phone size={14} />
                  {application.applicant_phone}
                </p>
              ) : null}
              <p
                className="flex items-center gap-2"
                style={{ color: STUDIO.ink3 }}
              >
                <Briefcase size={14} />
                {title}
              </p>
              <p
                className="flex items-center gap-2"
                style={{ color: STUDIO.ink3 }}
              >
                <UserRound size={14} />
                Applied {new Date(application.$createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>

          {application.ai_screening ? (
            <div
              className="rounded-2xl p-5"
              style={{
                background: "rgba(176,138,62,0.08)",
                border: "1px solid rgba(176,138,62,0.28)",
              }}
            >
              <div className="flex items-center justify-between">
                <p
                  className="text-xs uppercase tracking-[0.2em]"
                  style={{ color: STUDIO.gold }}
                >
                  AI screening summary
                </p>
                {typeof application.screening_score === "number" ? (
                  <span
                    className="rounded-full px-2 py-0.5 text-xs"
                    style={{
                      background: "rgba(176,138,62,0.12)",
                      color: STUDIO.gold,
                    }}
                  >
                    {application.screening_score} / 100
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-sm" style={{ color: STUDIO.ink2 }}>
                {application.review_metadata.ai_screening_summary ??
                  "AI screening complete. See the full report in the assistant pane."}
              </p>
            </div>
          ) : null}

          {application.cover_letter ? (
            <div
              className="rounded-2xl p-5"
              style={{
                background: STUDIO.paper2,
                border: `1px solid ${STUDIO.rule}`,
              }}
            >
              <p
                className="mb-3 text-xs uppercase tracking-[0.2em]"
                style={{ color: STUDIO.ink4 }}
              >
                Cover letter
              </p>
              <p
                className="whitespace-pre-line text-sm"
                style={{ color: STUDIO.ink2 }}
              >
                {application.cover_letter}
              </p>
            </div>
          ) : null}

          {application.resume_file_id ? (
            <div
              className="flex items-center justify-between rounded-2xl p-5"
              style={{
                background: STUDIO.paper2,
                border: `1px solid ${STUDIO.rule}`,
              }}
            >
              <div className="flex items-center gap-3">
                <FileText size={20} style={{ color: STUDIO.sky }} />
                <div>
                  <p
                    className="font-medium text-sm"
                    style={{ color: STUDIO.ink }}
                  >
                    Resume on file
                  </p>
                  <p className="text-xs" style={{ color: STUDIO.ink4 }}>
                    Stored in recruitment_resumes bucket.
                  </p>
                </div>
              </div>
              <Link
                className="rounded-xl px-3 py-2 text-xs"
                href={`/jobs/applications?search=${encodeURIComponent(application.applicant_email)}`}
                style={{
                  background: STUDIO.paper3,
                  border: `1px solid ${STUDIO.rule}`,
                  color: STUDIO.ink3,
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
            background: STUDIO.paper2,
            border: `1px solid ${STUDIO.rule}`,
          }}
        >
          <p
            className="mb-3 text-xs uppercase tracking-[0.2em]"
            style={{ color: STUDIO.ink4 }}
          >
            Quick links
          </p>
          <ul className="space-y-2 text-sm">
            <li>
              <Link
                className="block rounded-lg px-3 py-2 transition-colors"
                href={`/jobs/${id}`}
                style={{
                  background: STUDIO.paper3,
                  color: STUDIO.ink,
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
                  background: STUDIO.paper3,
                  color: STUDIO.ink,
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
                  background: STUDIO.paper3,
                  color: STUDIO.ink,
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

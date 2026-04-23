import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getJob, listJobApplications } from "../../../_actions/jobs";
import { PageHeader } from "../../../_components/page-header";
import { JobApplicationsClient } from "../../_components/job-applications-client";

interface VacancyApplicationsPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    page?: string;
    search?: string;
    status?: string;
  }>;
}

export default async function VacancyApplicationsPage({
  params,
  searchParams,
}: VacancyApplicationsPageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const [job, applications] = await Promise.all([
    getJob(id),
    listJobApplications({
      jobId: id,
      page: Math.max(1, Number(query.page) || 1),
      search: query.search,
      status: query.status,
    }),
  ]);

  if (!job) {
    notFound();
  }

  const title =
    job.translation_refs.find((translation) => translation.locale === "no")
      ?.title ??
    job.translation_refs[0]?.title ??
    "Vacancy";

  return (
    <div className="pb-12">
      <PageHeader
        description="Review applicants for this vacancy, update statuses, and download submitted CVs."
        title={`${title} Applications`}
      >
        <Link
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm transition-all"
          href="/jobs/applications"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.75)",
          }}
        >
          <ArrowLeft size={14} />
          All applications
        </Link>
      </PageHeader>

      <JobApplicationsClient
        initialApplications={applications.rows}
        page={Math.max(1, Number(query.page) || 1)}
        title={title}
        total={applications.total}
      />
    </div>
  );
}

import { FileText } from "lucide-react";
import { listJobApplications } from "../../_actions/jobs";
import { EmptyState } from "../../_components/empty-state";
import { PageHeader } from "../../_components/page-header";
import { JobApplicationsClient } from "../_components/job-applications-client";

interface JobApplicationsPageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
    status?: string;
  }>;
}

export default async function JobApplicationsPage({
  searchParams,
}: JobApplicationsPageProps) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const applications = await listJobApplications({
    page,
    search: params.search,
    status: params.status,
  });

  return (
    <div className="pb-12">
      <PageHeader
        description="Review applicants across all vacancies you are allowed to manage."
        title="Applications"
      />

      {applications.total === 0 && page === 1 ? (
        <EmptyState
          description="Applications will appear here once candidates start applying."
          icon={<FileText size={28} />}
          title="No applications yet"
        />
      ) : (
        <JobApplicationsClient
          initialApplications={applications.rows}
          page={page}
          title="Applications"
          total={applications.total}
        />
      )}
    </div>
  );
}

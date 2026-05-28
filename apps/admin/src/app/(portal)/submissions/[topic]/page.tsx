import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { requireNavAccess } from "@/lib/authorization";
import { listSubmissions } from "../../_actions/submissions";
import { PageHeader } from "../../_components/page-header";
import { SubmissionsList } from "./_components/submissions-list";

interface Props {
  params: Promise<{ topic: string }>;
  searchParams: Promise<{ page?: string; status?: string }>;
}

export default async function SubmissionsTopicPage({
  params,
  searchParams,
}: Props) {
  await requireNavAccess("portal.submissions");
  const { topic } = await params;
  const { page: pageParam, status } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const decodedTopic = decodeURIComponent(topic);

  const result = await listSubmissions({
    topic: decodedTopic,
    limit: 25,
    offset: (page - 1) * 25,
    status,
  });

  const formHeading = result.rows[0]?.formHeading ?? decodedTopic;

  return (
    <div className="pb-12">
      <div className="mb-2">
        <Link
          className="inline-flex items-center gap-1 text-muted-foreground text-xs transition-colors hover:text-foreground"
          href="/submissions"
        >
          <ArrowLeft size={12} />
          All forms
        </Link>
      </div>
      <PageHeader
        description={`${result.total} submission${result.total === 1 ? "" : "s"} · topic: ${decodedTopic}`}
        title={formHeading}
      />
      <SubmissionsList
        page={page}
        rows={result.rows}
        topic={decodedTopic}
        total={result.total}
      />
    </div>
  );
}

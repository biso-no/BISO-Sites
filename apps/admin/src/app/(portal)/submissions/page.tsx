import { Inbox } from "lucide-react";
import { listSubmissionTopics } from "../_actions/submissions";
import { PageHeader } from "../_components/page-header";
import { SubmissionTopicList } from "./_components/submission-topic-list";

export default async function SubmissionsPage() {
  const topics = await listSubmissionTopics();

  return (
    <div className="pb-12">
      <PageHeader
        description="Manage form submissions from your published pages."
        title="Form Submissions"
      />
      {topics.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-24 text-center text-muted-foreground">
          <Inbox size={40} strokeWidth={1} />
          <p className="text-sm">No submissions yet.</p>
          <p className="max-w-xs text-xs opacity-60">
            Submissions appear here when visitors fill out a form block on a
            published page.
          </p>
        </div>
      ) : (
        <SubmissionTopicList topics={topics} />
      )}
    </div>
  );
}

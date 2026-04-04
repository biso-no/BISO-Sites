import { getTranslations } from "next-intl/server";
import { FileStack } from "lucide-react";
import { listDrafts } from "../_actions/drafts";
import { PageHeader } from "../_components/page-header";
import { EmptyState } from "../_components/empty-state";
import { DraftsReviewClient } from "./_components/drafts-review-client";

export default async function DraftsPage() {
  const t = await getTranslations("adminPortal.drafts");

  const drafts = await listDrafts();

  return (
    <div className="pb-12">
      <PageHeader
        title={t("title")}
        description={t("description")}
      >
        {drafts.length > 0 && (
          <span
            className="px-3 py-1.5 rounded-full text-sm font-medium"
            style={{ background: "rgba(251,191,36,0.10)", border: "1px solid rgba(251,191,36,0.25)", color: "#fbbf24" }}
          >
            {t("pending", { count: drafts.length })}
          </span>
        )}
      </PageHeader>

      {drafts.length === 0 ? (
        <EmptyState
          icon={<FileStack size={28} />}
          title={t("empty")}
          description={t("emptyDescription")}
        />
      ) : (
        <DraftsReviewClient
          drafts={drafts}
          labels={{
            approve: t("actions.approve"),
            reject: t("actions.reject"),
            preview: t("actions.preview"),
            approveSuccess: t("approveSuccess"),
            approveError: t("approveError"),
            rejectSuccess: t("rejectSuccess"),
            rejectError: t("rejectError"),
            types: {
              job: t("types.job"),
              event: t("types.event"),
              news: t("types.news"),
            },
          }}
        />
      )}
    </div>
  );
}

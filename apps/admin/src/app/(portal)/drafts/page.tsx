import { FileStack } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireNavAccess } from "@/lib/authorization";
import { listDrafts } from "../_actions/drafts";
import { EmptyState } from "../_components/empty-state";
import { PageHeader } from "../_components/page-header";
import { DraftsReviewClient } from "./_components/drafts-review-client";

export default async function DraftsPage() {
  await requireNavAccess("portal.drafts");
  const t = await getTranslations("adminPortal.drafts");

  const drafts = await listDrafts();

  return (
    <div className="pb-12">
      <PageHeader description={t("description")} title={t("title")}>
        {drafts.length > 0 && (
          <span
            className="rounded-full px-3 py-1.5 font-medium text-sm"
            style={{
              background: "rgba(176,138,62,0.09)",
              border: "0.5px solid rgba(176,138,62,0.24)",
              color: "#6a5118",
            }}
          >
            {t("pending", { count: drafts.length })}
          </span>
        )}
      </PageHeader>

      {drafts.length === 0 ? (
        <EmptyState
          description={t("emptyDescription")}
          icon={<FileStack size={28} />}
          title={t("empty")}
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

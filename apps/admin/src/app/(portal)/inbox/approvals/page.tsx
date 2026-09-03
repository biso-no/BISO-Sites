import { ClipboardList } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireNavAccess } from "@/lib/authorization";
import { parseListParams } from "@/lib/list-params";
import { listPendingApprovals } from "../../_actions/approvals";
import { EmptyState } from "../../_components/empty-state";
import { PageHeader } from "../../_components/page-header";
import { ApprovalsReviewClient } from "./_components/approvals-review-client";

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireNavAccess("portal.inbox");
  const t = await getTranslations("adminPortal.approvals");

  const params = parseListParams(await searchParams);
  const result = await listPendingApprovals(params);
  const requests = "data" in result ? result.data.rows : [];
  const total = "data" in result ? result.data.total : 0;

  return (
    <div className="pb-12">
      <PageHeader description={t("description")} title={t("title")}>
        {total > 0 && (
          <span
            className="rounded-full px-3 py-1.5 font-medium text-sm"
            style={{
              background: "rgba(251,191,36,0.09)",
              border: "0.5px solid rgba(251,191,36,0.28)",
              color: "#92610a",
            }}
          >
            {t("pending", { count: total })}
          </span>
        )}
      </PageHeader>

      {requests.length === 0 ? (
        <EmptyState
          description={t("emptyDescription")}
          icon={<ClipboardList size={28} />}
          title={t("empty")}
        />
      ) : (
        <ApprovalsReviewClient
          labels={{
            approve: t("actions.approve"),
            reject: t("actions.reject"),
            approveSuccess: t("approveSuccess"),
            approveError: t("approveError"),
            rejectSuccess: t("rejectSuccess"),
            rejectError: t("rejectError"),
            reason: t("reason"),
            reasonPlaceholder: t("reasonPlaceholder"),
            requester: t("requester"),
            action: t("action"),
            resourceType: t("resourceType"),
          }}
          page={params.page}
          requests={requests}
          size={params.size}
          total={total}
        />
      )}
    </div>
  );
}

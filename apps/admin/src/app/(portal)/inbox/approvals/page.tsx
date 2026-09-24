import { ClipboardList } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireNavAccess } from "@/lib/authorization";
import { parseListParams } from "@/lib/list-params";
import { listPendingApprovals } from "../../_actions/approvals";
import { EmptyState } from "../../_components/empty-state";
import { PageHeader } from "../../_components/page-header";
import { PaginationBar } from "../../_components/pagination-bar";
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

  // A failed read must not render as "no pending requests" — approvers would
  // assume the queue is clear.
  if ("error" in result) {
    return (
      <div className="pb-12">
        <PageHeader description={t("description")} title={t("title")} />
        <div
          className="rounded-2xl p-5 text-sm"
          role="alert"
          style={{
            background: "rgba(248,113,113,0.08)",
            border: "1px solid rgba(248,113,113,0.20)",
            color: "#fca5a5",
          }}
        >
          {result.error}
        </div>
      </div>
    );
  }

  const requests = result.data.rows;
  const { total } = result.data;

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
          requests={requests}
        />
      )}

      <PaginationBar
        page={params.page}
        size={params.size}
        sizeSelectable
        total={total}
      />
    </div>
  );
}

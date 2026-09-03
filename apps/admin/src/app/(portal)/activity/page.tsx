import { Activity } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireNavAccess } from "@/lib/authorization";
import { parseListParams } from "@/lib/list-params";
import { listActivityLog } from "../_actions/activity";
import { EmptyState } from "../_components/empty-state";
import { PageHeader } from "../_components/page-header";
import { PaginationBar } from "../_components/pagination-bar";
import { STUDIO, StudioIconBox, StudioPanel } from "../_components/studio";

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireNavAccess("portal.activity");
  const t = await getTranslations("adminPortal.activity");

  const params = parseListParams(await searchParams);
  const { rows: logs, total } = await listActivityLog(params);

  return (
    <div className="pb-12">
      <PageHeader description={t("description")} title={t("title")} />

      {logs.length === 0 ? (
        <EmptyState icon={<Activity size={28} />} title={t("empty")} />
      ) : (
        <StudioPanel className="p-6">
          {logs.map((log, idx) => (
            <div
              className="relative flex items-start gap-4 py-5"
              key={log.$id}
              style={
                idx < logs.length - 1
                  ? { borderBottom: `0.5px solid ${STUDIO.rule}` }
                  : undefined
              }
            >
              <StudioIconBox color={STUDIO.claret}>
                <Activity size={13} />
              </StudioIconBox>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm" style={{ color: STUDIO.ink2 }}>
                      <span
                        className="font-medium"
                        style={{ color: STUDIO.ink }}
                      >
                        {log.actor_email ?? "System"}
                      </span>{" "}
                      <span
                        className="font-mono text-xs"
                        style={{ color: STUDIO.claret }}
                      >
                        {log.action}
                      </span>
                    </p>

                    {log.resource_type && (
                      <p
                        className="mt-0.5 text-xs"
                        style={{ color: STUDIO.ink4 }}
                      >
                        {log.resource_type}
                        {log.resource_id && (
                          <span
                            className="ml-2 font-mono"
                            style={{ color: STUDIO.ink4 }}
                          >
                            #{log.resource_id.slice(0, 8)}
                          </span>
                        )}
                      </p>
                    )}
                  </div>

                  <time
                    className="shrink-0 text-xs"
                    dateTime={log.$createdAt}
                    style={{ color: STUDIO.ink4 }}
                  >
                    {new Date(log.$createdAt).toLocaleString()}
                  </time>
                </div>
              </div>
            </div>
          ))}
        </StudioPanel>
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

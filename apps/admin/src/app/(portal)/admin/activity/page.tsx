import { Activity } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { listActivityLog } from "../_actions/activity";
import { EmptyState } from "../_components/empty-state";
import { PageHeader } from "../_components/page-header";

export default async function ActivityPage() {
  const t = await getTranslations("adminPortal.activity");

  const logs = await listActivityLog({ limit: 50 });

  return (
    <div className="pb-12">
      <PageHeader description={t("description")} title={t("title")} />

      {logs.length === 0 ? (
        <EmptyState icon={<Activity size={28} />} title={t("empty")} />
      ) : (
        <div
          className="space-y-0 rounded-3xl p-6"
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          {logs.map((log, idx) => (
            <div
              className="relative flex items-start gap-4 py-5"
              key={log.$id}
              style={
                idx < logs.length - 1
                  ? { borderBottom: "1px solid rgba(255,255,255,0.04)" }
                  : undefined
              }
            >
              {/* Timeline dot */}
              <div className="relative mt-0.5 flex-shrink-0">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full"
                  style={{
                    background: "rgba(61,169,224,0.10)",
                    border: "1px solid rgba(61,169,224,0.25)",
                  }}
                >
                  <Activity size={13} style={{ color: "#3DA9E0" }} />
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p
                      className="text-sm"
                      style={{ color: "rgba(255,255,255,0.80)" }}
                    >
                      <span className="font-medium" style={{ color: "#fff" }}>
                        {log.actor_email ?? "System"}
                      </span>{" "}
                      <span
                        className="font-mono text-xs"
                        style={{ color: "#3DA9E0" }}
                      >
                        {log.action}
                      </span>
                    </p>

                    {log.resource_type && (
                      <p
                        className="mt-0.5 text-xs"
                        style={{ color: "rgba(255,255,255,0.35)" }}
                      >
                        {log.resource_type}
                        {log.resource_id && (
                          <span
                            className="ml-2 font-mono"
                            style={{ color: "rgba(255,255,255,0.25)" }}
                          >
                            #{log.resource_id.slice(0, 8)}
                          </span>
                        )}
                      </p>
                    )}
                  </div>

                  <time
                    className="flex-shrink-0 text-xs"
                    dateTime={log.$createdAt}
                    style={{ color: "rgba(255,255,255,0.30)" }}
                  >
                    {new Date(log.$createdAt).toLocaleString()}
                  </time>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

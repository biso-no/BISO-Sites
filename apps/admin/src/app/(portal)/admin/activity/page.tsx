import { getTranslations } from "next-intl/server";
import { Activity } from "lucide-react";
import { listActivityLog } from "../_actions/activity";
import { PageHeader } from "../_components/page-header";
import { EmptyState } from "../_components/empty-state";

export default async function ActivityPage() {
  const t = await getTranslations("adminPortal.activity");

  const logs = await listActivityLog({ limit: 50 });

  return (
    <div className="pb-12">
      <PageHeader title={t("title")} description={t("description")} />

      {logs.length === 0 ? (
        <EmptyState icon={<Activity size={28} />} title={t("empty")} />
      ) : (
        <div
          className="rounded-3xl p-6 space-y-0"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
        >
          {logs.map((log, idx) => (
            <div
              key={log.$id}
              className="relative flex items-start gap-4 py-5"
              style={idx < logs.length - 1 ? { borderBottom: "1px solid rgba(255,255,255,0.04)" } : undefined}
            >
              {/* Timeline dot */}
              <div className="relative flex-shrink-0 mt-0.5">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(61,169,224,0.10)", border: "1px solid rgba(61,169,224,0.25)" }}
                >
                  <Activity size={13} style={{ color: "#3DA9E0" }} />
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm" style={{ color: "rgba(255,255,255,0.80)" }}>
                      <span className="font-medium" style={{ color: "#fff" }}>
                        {log.actor_email ?? "System"}
                      </span>{" "}
                      <span className="font-mono text-xs" style={{ color: "#3DA9E0" }}>
                        {log.action}
                      </span>
                    </p>

                    {log.resource_type && (
                      <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
                        {log.resource_type}
                        {log.resource_id && (
                          <span className="ml-2 font-mono" style={{ color: "rgba(255,255,255,0.25)" }}>
                            #{log.resource_id.slice(0, 8)}
                          </span>
                        )}
                      </p>
                    )}
                  </div>

                  <time
                    className="text-xs flex-shrink-0"
                    style={{ color: "rgba(255,255,255,0.30)" }}
                    dateTime={log.$createdAt}
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

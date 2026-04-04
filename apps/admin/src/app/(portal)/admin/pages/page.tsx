import { ExternalLink, Layers, Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { listPages } from "../_actions/pages";
import { EmptyState } from "../_components/empty-state";
import { PageHeader } from "../_components/page-header";
import { StatusBadge } from "../_components/status-badge";

export default async function PagesPage() {
  const t = await getTranslations("adminPortal.pages");
  const tc = await getTranslations("adminPortal.common");

  const pages = await listPages();

  return (
    <div className="pb-12">
      <PageHeader description={t("description")} title={t("title")}>
        <Link
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 font-medium text-sm"
          href="/editor/new"
          style={{
            background: "#3DA9E0",
            color: "#001731",
            boxShadow: "0 0 20px rgba(61,169,224,0.25)",
          }}
        >
          <Plus size={15} />
          {t("create")}
        </Link>
      </PageHeader>

      {pages.length === 0 ? (
        <EmptyState
          description={t("emptyDescription")}
          icon={<Layers size={28} />}
          title={t("empty")}
        >
          <Link
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 font-medium text-sm"
            href="/editor/new"
            style={{ background: "#3DA9E0", color: "#001731" }}
          >
            {t("create")}
          </Link>
        </EmptyState>
      ) : (
        <div className="space-y-2">
          {pages.map((page) => (
            <div
              className="group flex items-center gap-4 rounded-2xl px-5 py-4 transition-all"
              key={page.$id}
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.05)",
              }}
            >
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                style={{ background: "rgba(255,255,255,0.05)" }}
              >
                <Layers size={14} style={{ color: "rgba(255,255,255,0.40)" }} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p
                    className="truncate font-medium text-sm"
                    style={{ color: "#fff" }}
                  >
                    {page.title ?? "Untitled"}
                  </p>
                  <StatusBadge status={page.status} />
                </div>
                <p
                  className="mt-0.5 truncate font-mono text-xs"
                  style={{ color: "rgba(255,255,255,0.35)" }}
                >
                  {page.slug ?? "/"}
                </p>
              </div>

              <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                <Link
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs"
                  href={`/editor/${page.$id}`}
                  style={{
                    background: "rgba(61,169,224,0.10)",
                    color: "#3DA9E0",
                  }}
                >
                  <Pencil size={12} />
                  {tc("edit")}
                </Link>
                {page.slug && (
                  <a
                    className="flex h-8 w-8 items-center justify-center rounded-lg"
                    href={page.slug}
                    rel="noopener noreferrer"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      color: "rgba(255,255,255,0.50)",
                    }}
                    target="_blank"
                  >
                    <ExternalLink size={13} />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

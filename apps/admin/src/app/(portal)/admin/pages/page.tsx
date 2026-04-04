import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Plus, Layers, Pencil, ExternalLink } from "lucide-react";
import { listPages } from "../_actions/pages";
import { PageHeader } from "../_components/page-header";
import { StatusBadge } from "../_components/status-badge";
import { EmptyState } from "../_components/empty-state";

export default async function PagesPage() {
  const t = await getTranslations("adminPortal.pages");
  const tc = await getTranslations("adminPortal.common");

  const pages = await listPages();

  return (
    <div className="pb-12">
      <PageHeader title={t("title")} description={t("description")}>
        <Link
          href="/editor/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium"
          style={{ background: "#3DA9E0", color: "#001731", boxShadow: "0 0 20px rgba(61,169,224,0.25)" }}
        >
          <Plus size={15} />
          {t("create")}
        </Link>
      </PageHeader>

      {pages.length === 0 ? (
        <EmptyState icon={<Layers size={28} />} title={t("empty")} description={t("emptyDescription")}>
          <Link href="/editor/new" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium" style={{ background: "#3DA9E0", color: "#001731" }}>
            {t("create")}
          </Link>
        </EmptyState>
      ) : (
        <div className="space-y-2">
          {pages.map((page) => (
            <div
              key={page.$id}
              className="group flex items-center gap-4 px-5 py-4 rounded-2xl transition-all"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,255,255,0.05)" }}>
                <Layers size={14} style={{ color: "rgba(255,255,255,0.40)" }} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate" style={{ color: "#fff" }}>
                    {page.title ?? "Untitled"}
                  </p>
                  <StatusBadge status={page.status} />
                </div>
                <p className="text-xs mt-0.5 font-mono truncate" style={{ color: "rgba(255,255,255,0.35)" }}>
                  {page.slug ?? "/"}
                </p>
              </div>

              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Link
                  href={`/editor/${page.$id}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
                  style={{ background: "rgba(61,169,224,0.10)", color: "#3DA9E0" }}
                >
                  <Pencil size={12} />
                  {tc("edit")}
                </Link>
                {page.slug && (
                  <a
                    href={page.slug}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center w-8 h-8 rounded-lg"
                    style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.50)" }}
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

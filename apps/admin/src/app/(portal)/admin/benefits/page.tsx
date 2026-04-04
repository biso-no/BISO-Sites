import { ExternalLink, Gift, Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { listBenefits } from "../_actions/benefits";
import { EmptyState } from "../_components/empty-state";
import { PageHeader } from "../_components/page-header";
import { StatusBadge } from "../_components/status-badge";

export default async function BenefitsPage() {
  const t = await getTranslations("adminPortal.benefits");
  const _tc = await getTranslations("adminPortal.common");

  const benefits = await listBenefits();

  return (
    <div className="pb-12">
      <PageHeader description={t("description")} title={t("title")}>
        <Link
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 font-medium text-sm"
          href="/admin/benefits/partners"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.10)",
            color: "rgba(255,255,255,0.80)",
          }}
        >
          <ExternalLink size={14} />
          {t("actions.viewPartners")}
        </Link>
        <Link
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 font-medium text-sm"
          href="/admin/benefits/new"
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

      {benefits.length === 0 ? (
        <EmptyState
          description={t("emptyDescription")}
          icon={<Gift size={28} />}
          title={t("empty")}
        >
          <Link
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 font-medium text-sm"
            href="/admin/benefits/new"
            style={{ background: "#3DA9E0", color: "#001731" }}
          >
            {t("create")}
          </Link>
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {benefits.map((benefit) => (
            <Link
              className="group overflow-hidden rounded-3xl transition-all"
              href={`/admin/benefits/${benefit.$id}`}
              key={benefit.$id}
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.05)",
              }}
            >
              {/* Hero image */}
              <div
                className="relative h-32 overflow-hidden"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(61,169,224,0.08) 0%, rgba(0,23,49,0.50) 100%)",
                }}
              >
                {benefit.image_url ? (
                  <Image
                    alt={benefit.title_en}
                    className="h-full w-full object-cover opacity-80"
                    fill
                    src={benefit.image_url}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-3xl">
                    🎁
                  </div>
                )}
                <div className="absolute top-3 left-3 flex items-center gap-2">
                  <StatusBadge status={benefit.status} />
                  <span
                    className="inline-flex items-center rounded-full px-2 py-0.5 font-medium text-[10px] uppercase tracking-wide"
                    style={{
                      background: "rgba(0,0,0,0.50)",
                      color: "rgba(255,255,255,0.70)",
                    }}
                  >
                    {benefit.kind}
                  </span>
                </div>
              </div>

              <div className="p-4">
                <p className="font-medium text-sm" style={{ color: "#fff" }}>
                  {benefit.title_en}
                </p>
                {benefit.partner_name && (
                  <p
                    className="mt-1 text-xs"
                    style={{ color: "rgba(255,255,255,0.40)" }}
                  >
                    {benefit.partner_name}
                  </p>
                )}
                <div className="mt-3 flex items-center justify-between">
                  <span
                    className="font-mono text-[11px] uppercase tracking-wide"
                    style={{ color: "rgba(255,255,255,0.30)" }}
                  >
                    {benefit.category}
                  </span>
                  <span className="text-[#3DA9E0] text-xs">Configure →</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

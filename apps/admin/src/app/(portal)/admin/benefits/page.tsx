import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Plus, Gift, ExternalLink } from "lucide-react";
import { listBenefits } from "../_actions/benefits";
import { PageHeader } from "../_components/page-header";
import { StatusBadge } from "../_components/status-badge";
import { EmptyState } from "../_components/empty-state";

export default async function BenefitsPage() {
  const t = await getTranslations("adminPortal.benefits");
  const tc = await getTranslations("adminPortal.common");

  const benefits = await listBenefits();

  return (
    <div className="pb-12">
      <PageHeader title={t("title")} description={t("description")}>
        <Link
          href="/admin/benefits/partners"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.80)" }}
        >
          <ExternalLink size={14} />
          {t("actions.viewPartners")}
        </Link>
        <Link
          href="/admin/benefits/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium"
          style={{ background: "#3DA9E0", color: "#001731", boxShadow: "0 0 20px rgba(61,169,224,0.25)" }}
        >
          <Plus size={15} />
          {t("create")}
        </Link>
      </PageHeader>

      {benefits.length === 0 ? (
        <EmptyState icon={<Gift size={28} />} title={t("empty")} description={t("emptyDescription")}>
          <Link href="/admin/benefits/new" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium" style={{ background: "#3DA9E0", color: "#001731" }}>
            {t("create")}
          </Link>
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {benefits.map((benefit) => (
            <Link
              key={benefit.$id}
              href={`/admin/benefits/${benefit.$id}`}
              className="group rounded-3xl overflow-hidden transition-all"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
            >
              {/* Hero image */}
              <div className="relative h-32 overflow-hidden" style={{ background: "linear-gradient(135deg, rgba(61,169,224,0.08) 0%, rgba(0,23,49,0.50) 100%)" }}>
                {benefit.image_url ? (
                  <img src={benefit.image_url} alt={benefit.title_en} className="w-full h-full object-cover opacity-80" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl">🎁</div>
                )}
                <div className="absolute top-3 left-3 flex items-center gap-2">
                  <StatusBadge status={benefit.status} />
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide" style={{ background: "rgba(0,0,0,0.50)", color: "rgba(255,255,255,0.70)" }}>
                    {benefit.kind}
                  </span>
                </div>
              </div>

              <div className="p-4">
                <p className="font-medium text-sm" style={{ color: "#fff" }}>{benefit.title_en}</p>
                {benefit.partner_name && (
                  <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.40)" }}>{benefit.partner_name}</p>
                )}
                <div className="flex items-center justify-between mt-3">
                  <span className="text-[11px] uppercase tracking-wide font-mono" style={{ color: "rgba(255,255,255,0.30)" }}>
                    {benefit.category}
                  </span>
                  <span className="text-xs text-[#3DA9E0]">Configure →</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

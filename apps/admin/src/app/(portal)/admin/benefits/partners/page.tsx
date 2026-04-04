import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";
import { listPartners } from "../../_actions/benefits";
import { PageHeader } from "../../_components/page-header";
import { EmptyState } from "../../_components/empty-state";
import { StatusBadge } from "../../_components/status-badge";

export default async function BenefitPartnersPage() {
  const t = await getTranslations("adminPortal.benefits");

  const partners = await listPartners();

  return (
    <div className="pb-12">
      <div className="flex items-center gap-3 mb-2">
        <Link
          href="/admin/benefits"
          className="flex items-center justify-center w-8 h-8 rounded-full"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.60)" }}
        >
          <ArrowLeft size={15} />
        </Link>
        <span className="text-sm" style={{ color: "rgba(255,255,255,0.40)" }}>{t("title")}</span>
      </div>

      <PageHeader title={t("partners.title")} description={t("partners.description")}>
        <span
          className="px-2.5 py-1 rounded-full text-xs font-mono"
          style={{ background: "rgba(61,169,224,0.10)", color: "#3DA9E0", border: "1px solid rgba(61,169,224,0.25)" }}
        >
          API Beta
        </span>
      </PageHeader>

      {partners.length === 0 ? (
        <EmptyState
          icon={<Users size={28} />}
          title={t("partners.empty")}
          description="Partners are added via invitation."
        />
      ) : (
        <div className="space-y-3">
          {partners.map((partner) => (
            <div
              key={partner.$id}
              className="flex items-center gap-4 px-5 py-4 rounded-2xl"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
            >
              {partner.image_url ? (
                <img src={partner.image_url} alt={partner.name} className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(61,169,224,0.10)" }}>
                  <Users size={16} style={{ color: "#3DA9E0" }} />
                </div>
              )}

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: "#fff" }}>{partner.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.35)" }}>
                    {partner.level}
                  </span>
                  {partner.url && (
                    <a href={partner.url} target="_blank" rel="noopener noreferrer" className="text-xs hover:text-[#3DA9E0] transition-colors" style={{ color: "rgba(255,255,255,0.30)" }}>
                      {partner.url}
                    </a>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.40)" }}>
                  {partner.$id.slice(0, 8)}...
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

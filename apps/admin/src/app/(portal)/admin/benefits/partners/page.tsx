import { ArrowLeft, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { listPartners } from "../../_actions/benefits";
import { EmptyState } from "../../_components/empty-state";
import { PageHeader } from "../../_components/page-header";

export default async function BenefitPartnersPage() {
  const t = await getTranslations("adminPortal.benefits");

  const partners = await listPartners();

  return (
    <div className="pb-12">
      <div className="mb-2 flex items-center gap-3">
        <Link
          className="flex h-8 w-8 items-center justify-center rounded-full"
          href="/admin/benefits"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.10)",
            color: "rgba(255,255,255,0.60)",
          }}
        >
          <ArrowLeft size={15} />
        </Link>
        <span className="text-sm" style={{ color: "rgba(255,255,255,0.40)" }}>
          {t("title")}
        </span>
      </div>

      <PageHeader
        description={t("partners.description")}
        title={t("partners.title")}
      >
        <span
          className="rounded-full px-2.5 py-1 font-mono text-xs"
          style={{
            background: "rgba(61,169,224,0.10)",
            color: "#3DA9E0",
            border: "1px solid rgba(61,169,224,0.25)",
          }}
        >
          API Beta
        </span>
      </PageHeader>

      {partners.length === 0 ? (
        <EmptyState
          description="Partners are added via invitation."
          icon={<Users size={28} />}
          title={t("partners.empty")}
        />
      ) : (
        <div className="space-y-3">
          {partners.map((partner) => (
            <div
              className="flex items-center gap-4 rounded-2xl px-5 py-4"
              key={partner.$id}
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.05)",
              }}
            >
              {partner.image_url ? (
                <Image
                  alt={partner.name}
                  className="h-10 w-10 shrink-0 rounded-xl object-cover"
                  height={40}
                  src={partner.image_url}
                  width={40}
                />
              ) : (
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: "rgba(61,169,224,0.10)" }}
                >
                  <Users size={16} style={{ color: "#3DA9E0" }} />
                </div>
              )}

              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm" style={{ color: "#fff" }}>
                  {partner.name}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <span
                    className="font-mono text-xs"
                    style={{ color: "rgba(255,255,255,0.35)" }}
                  >
                    {partner.level}
                  </span>
                  {partner.url && (
                    <a
                      className="text-xs transition-colors hover:text-[#3DA9E0]"
                      href={partner.url}
                      rel="noopener noreferrer"
                      style={{ color: "rgba(255,255,255,0.30)" }}
                      target="_blank"
                    >
                      {partner.url}
                    </a>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span
                  className="rounded px-2 py-0.5 font-mono text-xs"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    color: "rgba(255,255,255,0.40)",
                  }}
                >
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

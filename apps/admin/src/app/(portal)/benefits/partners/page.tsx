import { ArrowLeft, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireNavAccess } from "@/lib/authorization";
import { parseListParams } from "@/lib/list-params";
import { listPartners } from "../../_actions/benefits";
import { EmptyState } from "../../_components/empty-state";
import { PageHeader } from "../../_components/page-header";
import { PaginationBar } from "../../_components/pagination-bar";
import { SERIF_STACK, STUDIO, StudioIconBox } from "../../_components/studio";
import { PartnersSearch } from "./_components/partners-search";

export default async function BenefitPartnersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireNavAccess("portal.benefitsPartners");
  const t = await getTranslations("adminPortal.benefits");
  const tc = await getTranslations("adminPortal.common");

  const params = parseListParams(await searchParams);
  const { rows: partners, total } = await listPartners(params);

  return (
    <div className="pb-12">
      <div className="mb-2 flex items-center gap-3">
        <Link
          className="flex h-8 w-8 items-center justify-center rounded-full"
          href="/benefits"
          style={{
            background: "rgba(255,255,255,0.55)",
            border: `0.5px solid ${STUDIO.rule2}`,
            color: STUDIO.ink3,
          }}
        >
          <ArrowLeft size={15} />
        </Link>
        <span className="text-sm" style={{ color: STUDIO.ink3 }}>
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
            background: "rgba(176,138,62,0.09)",
            color: "#6a5118",
            border: "0.5px solid rgba(176,138,62,0.24)",
          }}
        >
          API Beta
        </span>
      </PageHeader>

      <PartnersSearch />

      {partners.length === 0 && !params.q ? (
        <EmptyState
          description="Partners are added via invitation."
          icon={<Users size={28} />}
          title={t("partners.empty")}
        />
      ) : null}

      {partners.length === 0 && params.q ? (
        <EmptyState icon={<Users size={28} />} title={tc("empty")} />
      ) : null}

      {partners.length > 0 && (
        <div className="space-y-3">
          {partners.map((partner) => (
            <div
              className="flex items-center gap-4 rounded-2xl border px-5 py-4"
              key={partner.$id}
              style={{
                background: "rgba(255,255,255,0.46)",
                borderColor: STUDIO.rule,
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
                <StudioIconBox color={STUDIO.claret}>
                  <Users size={16} />
                </StudioIconBox>
              )}

              <div className="min-w-0 flex-1">
                <p
                  className="text-2xl leading-7"
                  style={{ color: STUDIO.ink, fontFamily: SERIF_STACK }}
                >
                  {partner.name}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <span
                    className="font-mono text-xs"
                    style={{ color: STUDIO.ink4 }}
                  >
                    {partner.level}
                  </span>
                  {partner.url && (
                    <a
                      className="text-xs transition-colors"
                      href={partner.url}
                      rel="noopener noreferrer"
                      style={{ color: STUDIO.claret }}
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
                    background: STUDIO.paper2,
                    color: STUDIO.ink4,
                  }}
                >
                  {partner.$id.slice(0, 8)}...
                </span>
              </div>
            </div>
          ))}
        </div>
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

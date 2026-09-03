import { ExternalLink, Gift, Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireNavAccess } from "@/lib/authorization";
import { parseListParams } from "@/lib/list-params";
import { hasNavAccess } from "@/lib/roles";
import { listBenefits } from "../_actions/benefits";
import { EmptyState } from "../_components/empty-state";
import { PaginationBar } from "../_components/pagination-bar";
import { StatusBadge } from "../_components/status-badge";
import {
  SERIF_STACK,
  STUDIO,
  StudioLinkButton,
  StudioPageHeader,
} from "../_components/studio";
import { BenefitsSearch } from "./_components/benefits-search";

export default async function BenefitsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireNavAccess("portal.benefits");
  const t = await getTranslations("adminPortal.benefits");
  const tc = await getTranslations("adminPortal.common");

  const params = parseListParams(await searchParams);
  const { rows: benefits, total } = await listBenefits(params);
  // Partner administration keeps its narrower gate — department-only benefit
  // authors never see the partner surface.
  const canViewPartners = hasNavAccess(
    "portal.benefitsPartners",
    ctx.roles,
    ctx.departmentTeamIds.length > 0
  );

  return (
    <div className="pb-12">
      <StudioPageHeader description={t("description")} title={t("title")}>
        {canViewPartners && (
          <StudioLinkButton href="/benefits/partners">
            <ExternalLink size={14} />
            {t("actions.viewPartners")}
          </StudioLinkButton>
        )}
        <StudioLinkButton href="/benefits/new" variant="primary">
          <Plus size={15} />
          {t("create")}
        </StudioLinkButton>
      </StudioPageHeader>

      <BenefitsSearch />

      {benefits.length === 0 && !params.q ? (
        <EmptyState
          description={t("emptyDescription")}
          icon={<Gift size={28} />}
          title={t("empty")}
        >
          <StudioLinkButton href="/benefits/new" variant="primary">
            {t("create")}
          </StudioLinkButton>
        </EmptyState>
      ) : null}

      {benefits.length === 0 && params.q ? (
        <EmptyState icon={<Gift size={28} />} title={tc("empty")} />
      ) : null}

      {benefits.length > 0 && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {benefits.map((benefit) => (
            <Link
              className="group overflow-hidden rounded-2xl border transition hover:bg-white/70"
              href={`/benefits/${benefit.$id}`}
              key={benefit.$id}
              style={{
                background: "rgba(255,255,255,0.46)",
                borderColor: STUDIO.rule,
                color: STUDIO.ink,
              }}
            >
              <div
                className="relative h-36 overflow-hidden"
                style={{ background: STUDIO.paper2 }}
              >
                {benefit.image_url ? (
                  <Image
                    alt={benefit.title_en}
                    className="h-full w-full object-cover"
                    fill
                    src={benefit.image_url}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Gift size={30} style={{ color: STUDIO.claret }} />
                  </div>
                )}
                <div className="absolute top-3 left-3 flex items-center gap-2">
                  <StatusBadge status={benefit.status} />
                  <span
                    className="inline-flex items-center rounded-full border px-2 py-0.5 font-medium text-[10px] uppercase tracking-[0.05em]"
                    style={{
                      background: "rgba(250,247,242,0.9)",
                      borderColor: STUDIO.rule2,
                      color: STUDIO.ink3,
                    }}
                  >
                    {benefit.kind}
                  </span>
                </div>
              </div>

              <div className="p-4">
                <p
                  className="text-2xl leading-7"
                  style={{ color: STUDIO.ink, fontFamily: SERIF_STACK }}
                >
                  {benefit.title_en}
                </p>
                {benefit.partner_name && (
                  <p className="mt-1 text-sm" style={{ color: STUDIO.ink3 }}>
                    {benefit.partner_name}
                  </p>
                )}
                <div className="mt-4 flex items-center justify-between">
                  <span
                    className="font-mono text-[11px] uppercase tracking-[0.05em]"
                    style={{ color: STUDIO.ink4 }}
                  >
                    {benefit.category}
                  </span>
                  <span className="text-xs" style={{ color: STUDIO.claret }}>
                    Configure →
                  </span>
                </div>
              </div>
            </Link>
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

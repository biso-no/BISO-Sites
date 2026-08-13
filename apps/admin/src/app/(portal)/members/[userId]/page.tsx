import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getMemberDetail } from "../../_actions/members";
import { PageHeader } from "../../_components/page-header";
import {
  STUDIO,
  StudioPanel,
  StudioStatusPill,
} from "../../_components/studio";

interface MemberDetailPageProps {
  params: Promise<{ userId: string }>;
}

function formatDate(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  return new Date(value).toLocaleDateString();
}

export default async function MemberDetailPage({
  params,
}: MemberDetailPageProps) {
  const { userId } = await params;
  const t = await getTranslations("adminPortal.members");
  const member = await getMemberDetail(userId);

  if (!member) {
    notFound();
  }

  const expiry = formatDate(member.expiryDate);

  return (
    <div className="pb-12">
      <Link
        className="mb-6 inline-flex items-center gap-2 text-sm transition-colors hover:opacity-70"
        href="/members"
        style={{ color: STUDIO.ink3 }}
      >
        <ArrowLeft size={14} />
        {t("detail.back")}
      </Link>

      <PageHeader
        description={member.email ?? undefined}
        title={member.name || t("unnamed")}
      >
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium text-xs"
          style={{
            background: member.isMember ? "rgba(47,93,58,0.08)" : STUDIO.paper2,
            color: member.isMember ? STUDIO.leaf : STUDIO.ink3,
          }}
        >
          {member.isMember ? t("status.active") : t("status.inactive")}
        </span>
      </PageHeader>

      <div className="grid gap-6 md:grid-cols-3">
        <StudioPanel className="space-y-4 p-5 md:col-span-1">
          <div>
            <p
              className="font-medium text-[11px] uppercase tracking-[0.06em]"
              style={{ color: STUDIO.ink3 }}
            >
              {t("detail.contact")}
            </p>
            <p className="mt-1 text-sm" style={{ color: STUDIO.ink }}>
              {member.email ?? "—"}
            </p>
            {member.phone ? (
              <p className="mt-1 text-sm" style={{ color: STUDIO.ink }}>
                {member.phone}
              </p>
            ) : null}
          </div>
          <div>
            <p
              className="font-medium text-[11px] uppercase tracking-[0.06em]"
              style={{ color: STUDIO.ink3 }}
            >
              {t("detail.campus")}
            </p>
            <p className="mt-1 text-sm" style={{ color: STUDIO.ink }}>
              {member.campusName ?? t("noCampus")}
            </p>
          </div>
          <div>
            <p
              className="font-medium text-[11px] uppercase tracking-[0.06em]"
              style={{ color: STUDIO.ink3 }}
            >
              {t("detail.expiry")}
            </p>
            <p className="mt-1 text-sm" style={{ color: STUDIO.ink }}>
              {expiry ?? t("noExpiry")}
            </p>
          </div>
        </StudioPanel>

        <div className="md:col-span-2">
          <h2
            className="mb-4 text-2xl"
            style={{
              color: STUDIO.ink,
              fontFamily:
                '"Cormorant Garamond", "EB Garamond", "Times New Roman", Georgia, serif',
            }}
          >
            {t("detail.membershipHistory")}
          </h2>

          {member.memberships.length === 0 ? (
            <p className="text-sm" style={{ color: STUDIO.ink3 }}>
              {t("detail.noHistory")}
            </p>
          ) : (
            <div className="space-y-2">
              {member.memberships.map((membership) => (
                <StudioPanel
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
                  key={`${membership.name}-${membership.startDate}`}
                >
                  <div className="min-w-0">
                    <p
                      className="font-medium text-sm"
                      style={{ color: STUDIO.ink }}
                    >
                      {membership.name}
                    </p>
                    <p className="mt-1 text-xs" style={{ color: STUDIO.ink4 }}>
                      {formatDate(membership.startDate)} –{" "}
                      {formatDate(membership.expiryDate)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm" style={{ color: STUDIO.ink2 }}>
                      {t("detail.planPrice", { price: membership.price })}
                    </span>
                    <StudioStatusPill
                      label={
                        membership.status
                          ? t("status.active")
                          : t("status.inactive")
                      }
                      status={membership.status ? "published" : "archived"}
                    />
                  </div>
                </StudioPanel>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

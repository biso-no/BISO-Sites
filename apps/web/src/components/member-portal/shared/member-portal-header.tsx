import { ArrowRight, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Pill } from "@/components/ui/pill";
import { statusPanelPrimaryAction } from "@/components/ui/status-panel";

interface MemberPortalHeaderProps {
  campus: string;
  /** The live membership check failed: claim nothing either way. */
  checkFailed?: boolean;
  isMember?: boolean;
  /** ISO date; empty when there is no current membership. */
  membershipExpiry: string;
  userName: string;
}

/**
 * The member portal's navy band — the page's `PageHeader` and its only
 * `<h1>`. A Server Component: the previous header was a client component only
 * to animate itself in, behind a gradient, three blur orbs and a wave.
 *
 * Members see their status and how long it runs; everyone else a way in. The
 * benefit count and days remaining live in the overview tab, which already
 * showed them a second time.
 */
export async function MemberPortalHeader({
  campus,
  checkFailed = false,
  isMember = true,
  membershipExpiry,
  userName,
}: MemberPortalHeaderProps) {
  const [t, tBreadcrumbs, format] = await Promise.all([
    getTranslations("memberPortal"),
    getTranslations("common.breadcrumbs"),
    getFormatter(),
  ]);
  const firstName = userName.split(" ")[0];
  const validUntil =
    isMember && membershipExpiry
      ? format.dateTime(new Date(`${membershipExpiry}T12:00:00Z`), {
          dateStyle: "long",
          timeZone: "Europe/Oslo",
        })
      : null;

  let meta: ReactNode = null;
  if (isMember) {
    meta = (
      <>
        <Pill tone="accent">
          <ShieldCheck aria-hidden="true" className="size-3.5 shrink-0" />
          {t("common.member")}
        </Pill>
        {validUntil ? (
          <Pill>{t("membership.validUntilDate", { date: validUntil })}</Pill>
        ) : null}
      </>
    );
  } else if (!checkFailed) {
    meta = <Pill>{t("header.nonMemberBadge")}</Pill>;
  }

  return (
    <PageHeader
      actions={
        isMember || checkFailed ? null : (
          <Link className={statusPanelPrimaryAction} href="/membership">
            {t("header.becomeMember")}
            <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
          </Link>
        )
      }
      breadcrumbs={[
        { label: tBreadcrumbs("home"), href: "/" },
        { label: t("title") },
      ]}
      eyebrow={campus}
      meta={meta}
      title={t("welcome", { name: firstName })}
    />
  );
}

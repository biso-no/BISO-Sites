"use client";

import { clientAccount, OAuthProvider } from "@repo/api/client";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useTransition } from "react";

function StateCard({
  title,
  body,
  children,
}: {
  body: string;
  children?: React.ReactNode;
  title: string;
}) {
  return (
    <Card className="mx-auto max-w-xl p-8 text-center">
      <h2 className="mb-2 font-bold text-foreground text-xl">{title}</h2>
      <p className="mb-6 text-muted-foreground text-sm">{body}</p>
      <div className="flex flex-wrap justify-center gap-3">{children}</div>
    </Card>
  );
}

export function SignedOutState() {
  const t = useTranslations("membership.join.signedOut");
  return (
    <StateCard body={t("body")} title={t("title")}>
      <Button asChild>
        <Link href="/auth/login?redirectTo=/membership/join">{t("cta")}</Link>
      </Button>
    </StateCard>
  );
}

export function NeedsBiLinkState() {
  const t = useTranslations("membership.join.needsBiLink");
  const [isLinking, startLink] = useTransition();

  const link = () => {
    startLink(async () => {
      const base = window.location.origin;
      await clientAccount.createOAuth2Session(
        OAuthProvider.Oidc,
        `${base}/membership/join?linked=1`,
        `${base}/membership/join?oidc_failed=1`,
        ["openid", "email", "profile"]
      );
    });
  };

  return (
    <StateCard body={t("body")} title={t("title")}>
      <Button disabled={isLinking} onClick={link}>
        {t("cta")}
      </Button>
    </StateCard>
  );
}

export function NeedsDirectoryRecordState({
  isRetrying = false,
  onRetry,
}: {
  isRetrying?: boolean;
  onRetry: () => void;
}) {
  const t = useTranslations("membership.join.needsDirectoryRecord");
  return (
    <StateCard body={t("body")} title={t("title")}>
      <Button disabled={isRetrying} onClick={onRetry} variant="outline">
        {t("retry")}
      </Button>
      <Button asChild>
        <Link href="/contact">{t("contact")}</Link>
      </Button>
    </StateCard>
  );
}

export function AlreadyMemberState({ expiry }: { expiry: string | null }) {
  const t = useTranslations("membership.join.alreadyMember");
  return (
    <StateCard body={t("body", { expiry: expiry ?? "—" })} title={t("title")}>
      <Button asChild>
        <Link href="/member">{t("cta")}</Link>
      </Button>
    </StateCard>
  );
}

/**
 * Sixth gate state: authenticated, linked, and directory-verified, but the
 * catalog currently has no plan on offer and the student is NOT already a
 * member. Distinct from `AlreadyMemberState` — reusing that copy here would
 * tell a non-member they already have membership, which is false.
 */
export function NoPlansAvailableState() {
  const t = useTranslations("membership.join.noPlansAvailable");
  return (
    <StateCard body={t("body")} title={t("title")}>
      <Button asChild>
        <Link href="/contact">{t("cta")}</Link>
      </Button>
    </StateCard>
  );
}

"use client";

import { clientAccount, OAuthProvider } from "@repo/api/client";
import { Alert, AlertDescription } from "@repo/ui/components/ui/alert";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import {
  AlertTriangle,
  CheckCircle2,
  Link2,
  LogIn,
  RefreshCw,
  UserSearch,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ComponentType } from "react";
import { useTransition } from "react";

// The page's <h1> lives in the branded hero shell above (join/page.tsx); this
// is the state's own secondary heading.
function StateCard({
  icon: Icon,
  title,
  body,
  alert,
  children,
}: {
  alert?: React.ReactNode;
  body: string;
  children?: React.ReactNode;
  icon: ComponentType<{ className?: string }>;
  title: string;
}) {
  return (
    <Card className="mx-auto max-w-xl rounded-3xl border-border/60 p-8 text-center shadow-sm sm:p-10">
      <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-brand-muted">
        <Icon className="h-6 w-6 text-brand-dark dark:text-brand" />
      </div>
      <h2 className="mb-2 font-bold text-foreground text-xl">{title}</h2>
      <p className="mb-6 text-muted-foreground text-sm">{body}</p>
      {alert ? <div className="mb-6">{alert}</div> : null}
      <div className="flex flex-wrap justify-center gap-3">{children}</div>
    </Card>
  );
}

export function SignedOutState() {
  const t = useTranslations("membership.join.signedOut");
  return (
    <StateCard body={t("body")} icon={LogIn} title={t("title")}>
      <Button asChild>
        <Link href="/auth/login?redirectTo=/membership/join">{t("cta")}</Link>
      </Button>
    </StateCard>
  );
}

export function NeedsBiLinkState({
  linkFailed = false,
}: {
  linkFailed?: boolean;
}) {
  const t = useTranslations("membership.join.needsBiLink");
  const [isLinking, startLink] = useTransition();

  const link = () => {
    startLink(async () => {
      const base = window.location.origin;
      // Success routes through /api/auth/bi-link, which runs the sync +
      // cache invalidation outside the render path and only then redirects
      // back here — see that route's doc comment for why.
      await clientAccount.createOAuth2Session(
        OAuthProvider.Oidc,
        `${base}/api/auth/bi-link?returnTo=/membership/join`,
        `${base}/membership/join?oidc_failed=1`,
        ["openid", "email", "profile"]
      );
    });
  };

  return (
    <StateCard
      alert={
        linkFailed ? (
          <Alert className="text-left" variant="destructive">
            <AlertDescription>{t("linkFailed")}</AlertDescription>
          </Alert>
        ) : null
      }
      body={t("body")}
      icon={Link2}
      title={t("title")}
    >
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
    <StateCard body={t("body")} icon={UserSearch} title={t("title")}>
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
    <StateCard
      body={expiry ? t("body", { expiry }) : t("bodyUnknownExpiry")}
      icon={CheckCircle2}
      title={t("title")}
    >
      <Button asChild>
        <Link href="/member">{t("cta")}</Link>
      </Button>
    </StateCard>
  );
}

/**
 * Authenticated, linked, and directory-verified, but the live Finago
 * membership read itself failed transiently — never fall through to the
 * catalog here: an existing member shown the full catalog during an outage
 * could pay for cover they already have. `Link href` is a plain navigation
 * (not a client refresh) so the retry always starts a genuinely fresh
 * request rather than re-reading anything cached client-side.
 */
export function MembershipCheckUnavailableState() {
  const t = useTranslations("membership.join.checkUnavailable");
  return (
    <StateCard body={t("body")} icon={RefreshCw} title={t("title")}>
      <Button asChild>
        <Link href="/membership/join">{t("cta")}</Link>
      </Button>
    </StateCard>
  );
}

/**
 * Authenticated, linked, and directory-verified, but the catalog currently
 * has no plan on offer and the student is NOT already a member. Distinct
 * from `AlreadyMemberState` — reusing that copy here would tell a non-member
 * they already have membership, which is false.
 */
export function NoPlansAvailableState() {
  const t = useTranslations("membership.join.noPlansAvailable");
  return (
    <StateCard body={t("body")} icon={AlertTriangle} title={t("title")}>
      <Button asChild>
        <Link href="/contact">{t("cta")}</Link>
      </Button>
    </StateCard>
  );
}

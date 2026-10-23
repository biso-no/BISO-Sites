"use client";

import {
  AlertTriangle,
  CheckCircle2,
  GraduationCap,
  LogIn,
  RefreshCw,
  UserSearch,
} from "lucide-react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import type { ComponentType } from "react";
import { useState, useTransition } from "react";
import {
  statusPanelPrimaryAction,
  statusPanelSecondaryAction,
} from "@/components/ui/status-panel";
import { clearBrowserAppwriteSession } from "@/lib/bi-sign-in-client";
import { switchToBiSignIn } from "@/lib/server";

// The page's <h1> lives in the `PageHeader` band above (join/page.tsx); this
// is the state's own secondary heading. Same shape as `<StatusPanel>`'s body.
export function StateCard({
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
    <div className="flex flex-col items-start gap-4 rounded-biso-md border border-edge p-8 sm:p-10">
      <span aria-hidden="true" className="text-ink-muted">
        <Icon className="size-8" />
      </span>
      <h2 className="type-display-sm break-words text-ink">{title}</h2>
      <p className="type-body text-ink-muted">{body}</p>
      {alert ? <div className="w-full">{alert}</div> : null}
      <div className="mt-2 flex flex-wrap gap-3">{children}</div>
    </div>
  );
}

/** A failure the visitor needs to read, inside a state card. */
function StateAlert({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="type-body-sm rounded-biso-md border border-danger/40 bg-danger/5 p-4 text-danger"
      role="alert"
    >
      {children}
    </p>
  );
}

export function SignedOutState({
  redirectTo = "/membership/join",
}: {
  redirectTo?: string;
}) {
  const t = useTranslations("membership.join.signedOut");
  return (
    <StateCard body={t("body")} icon={LogIn} title={t("title")}>
      <Link
        className={statusPanelPrimaryAction}
        href={`/auth/login?redirectTo=${redirectTo}`}
      >
        {t("cta")}
      </Link>
    </StateCard>
  );
}

/**
 * Signed in, but not with a BI account. There is no linking any more: the
 * student signs out of this account and in with BI, and the membership
 * follows the student number.
 */
export function NeedsBiSignInState({
  returnTo = "/membership/join",
}: {
  returnTo?: string;
}) {
  const t = useTranslations("membership.join.needsBiLink");
  const [isStarting, start] = useTransition();
  const [startFailed, setStartFailed] = useState(false);

  const signIn = () => {
    setStartFailed(false);
    start(async () => {
      try {
        await clearBrowserAppwriteSession();
        await switchToBiSignIn(returnTo);
      } catch {
        setStartFailed(true);
      }
    });
  };

  return (
    <StateCard
      alert={startFailed ? <StateAlert>{t("linkFailed")}</StateAlert> : null}
      body={t("body")}
      icon={GraduationCap}
      title={t("title")}
    >
      <button
        aria-busy={isStarting}
        className={`${statusPanelPrimaryAction} disabled:opacity-60`}
        disabled={isStarting}
        onClick={signIn}
        type="button"
      >
        {t("cta")}
      </button>
    </StateCard>
  );
}

/**
 * Signed in with BI, yet no student number on the profile. Not a sign-in
 * problem, so no sign-in button: retry the sync, or get help.
 */
export function BiSyncFailedState({
  isRetrying = false,
  onRetry,
}: {
  isRetrying?: boolean;
  onRetry: () => void;
}) {
  const t = useTranslations("membership.join.biSyncFailed");
  return (
    <StateCard body={t("body")} icon={AlertTriangle} title={t("title")}>
      <button
        aria-busy={isRetrying}
        className={`${statusPanelSecondaryAction} disabled:opacity-60`}
        disabled={isRetrying}
        onClick={onRetry}
        type="button"
      >
        {t("retry")}
      </button>
      <Link className={statusPanelPrimaryAction} href="/contact">
        {t("contact")}
      </Link>
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
      <button
        aria-busy={isRetrying}
        className={`${statusPanelSecondaryAction} disabled:opacity-60`}
        disabled={isRetrying}
        onClick={onRetry}
        type="button"
      >
        {t("retry")}
      </button>
      <Link className={statusPanelPrimaryAction} href="/contact">
        {t("contact")}
      </Link>
    </StateCard>
  );
}

/**
 * Nothing left to buy. `startsOn` is set when the student is not a member yet
 * but has bought a plan that starts later (next season): say when it starts
 * rather than "you're already a member".
 */
export function AlreadyMemberState({
  expiry,
  startsOn = null,
}: {
  expiry: string | null;
  startsOn?: string | null;
}) {
  const t = useTranslations("membership.join.alreadyMember");
  const format = useFormatter();
  const date = (value: string) =>
    format.dateTime(new Date(`${value}T12:00:00Z`), {
      dateStyle: "long",
      timeZone: "Europe/Oslo",
    });
  if (startsOn && expiry) {
    return (
      <StateCard
        body={t("upcomingBody", { end: date(expiry), start: date(startsOn) })}
        icon={CheckCircle2}
        title={t("upcomingTitle")}
      >
        <Link className={statusPanelPrimaryAction} href="/member">
          {t("cta")}
        </Link>
      </StateCard>
    );
  }
  return (
    <StateCard
      body={
        expiry ? t("body", { expiry: date(expiry) }) : t("bodyUnknownExpiry")
      }
      icon={CheckCircle2}
      title={t("title")}
    >
      <Link className={statusPanelPrimaryAction} href="/member">
        {t("cta")}
      </Link>
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
      <Link className={statusPanelPrimaryAction} href="/membership/join">
        {t("cta")}
      </Link>
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
      <Link className={statusPanelPrimaryAction} href="/contact">
        {t("cta")}
      </Link>
    </StateCard>
  );
}

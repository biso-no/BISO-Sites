"use client";

import { CircleAlert, Loader2, LogIn, RefreshCw, Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { useState, useTransition } from "react";
import {
  statusPanelPrimaryAction,
  statusPanelSecondaryAction,
} from "@/components/ui/status-panel";
import { clearBrowserAppwriteSession } from "@/lib/bi-sign-in-client";
import { switchToBiSignIn } from "@/lib/server";
import { MemberPassCard } from "./member-pass-card";
import { useMemberPass } from "./use-member-pass";

/**
 * The pass's surrounding states — loading, not a member, no BI sign-in,
 * unavailable — in the site's panel style. The pass itself (`MemberPassCard`)
 * keeps its own look: colour of the day, the moving band and the live clock
 * are what staff check it by.
 */
function StateCard({
  action,
  busy = false,
  description,
  icon,
  title,
}: {
  action?: ReactNode;
  busy?: boolean;
  description?: string;
  icon: ReactNode;
  title: string;
}) {
  return (
    <div
      aria-busy={busy}
      className="flex flex-col items-start gap-3 rounded-biso-md border border-edge p-6"
      role="status"
    >
      <span aria-hidden="true" className="text-ink-muted">
        {icon}
      </span>
      <p className="type-heading-card text-ink">{title}</p>
      {description ? (
        <p className="type-body-sm max-w-sm text-ink-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

/**
 * No BI identity on this account, so no student number and no pass. There is
 * no linking any more: the student signs out of this account and in with BI
 * (clearing any leftover browser-side Appwrite session first), and comes back
 * to this page with the pass.
 */
function SignInWithBi({ returnTo }: { returnTo: string }) {
  const t = useTranslations("memberPass.states.noBiIdentity");
  const [isStarting, start] = useTransition();
  const [failed, setFailed] = useState(false);

  const signIn = () => {
    setFailed(false);
    start(async () => {
      try {
        await clearBrowserAppwriteSession();
        await switchToBiSignIn(returnTo);
      } catch {
        setFailed(true);
      }
    });
  };

  return (
    <StateCard
      action={
        <div className="flex flex-col items-start gap-3">
          <button
            aria-busy={isStarting}
            className={`${statusPanelPrimaryAction} disabled:opacity-60`}
            disabled={isStarting}
            onClick={signIn}
            type="button"
          >
            <LogIn aria-hidden="true" className="size-4 shrink-0" />
            {t("action")}
          </button>
          {failed ? (
            <p className="type-body-sm text-danger" role="alert">
              {t("failed")}
            </p>
          ) : null}
        </div>
      }
      description={t("description")}
      icon={<LogIn className="size-6" />}
      title={t("title")}
    />
  );
}

/** The signed-in member's live pass, or the next step toward one. */
export function MemberPass() {
  const t = useTranslations("memberPass");
  const pathname = usePathname();
  const pass = useMemberPass();

  if (pass.loading && !pass.data) {
    return (
      <StateCard
        busy
        icon={<Loader2 className="size-6 animate-spin" />}
        title={t("states.loading")}
      />
    );
  }

  const data = pass.data;
  if (data?.state === "active") {
    return (
      <MemberPassCard
        current={pass.current}
        now={pass.now}
        offline={pass.offline && !pass.current}
        onRetry={pass.refresh}
        pass={data}
        secondsLeft={pass.secondsLeft}
      />
    );
  }

  if (data?.state === "no_bi_identity") {
    return <SignInWithBi returnTo={pathname || "/profile"} />;
  }

  if (data?.state === "not_member" || data?.state === "expired") {
    const key = data.state === "expired" ? "expired" : "notMember";
    return (
      <StateCard
        action={
          <Link className={statusPanelPrimaryAction} href="/membership/join">
            {t(`states.${key}.action`)}
          </Link>
        }
        description={t(`states.${key}.description`)}
        icon={<Sparkles className="size-6" />}
        title={t(`states.${key}.title`)}
      />
    );
  }

  return (
    <StateCard
      action={
        <button
          className={statusPanelSecondaryAction}
          onClick={pass.refresh}
          type="button"
        >
          <RefreshCw aria-hidden="true" className="size-4 shrink-0" />
          {t("states.unavailable.action")}
        </button>
      }
      description={t("states.unavailable.description")}
      icon={<CircleAlert className="size-6" />}
      title={t("states.unavailable.title")}
    />
  );
}

"use client";

import { termLabel } from "@repo/shared/member-pass/term-label";
import type {
  MemberPassHolder,
  MemberPassResponse,
} from "@repo/shared/member-pass/types";
import type { MemberPassCode } from "@repo/shared/utils/member-pass-slots";
import { cn } from "@repo/ui/lib/utils";
import { RefreshCw, Smartphone, Wallet, X } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { statusPanelSecondaryAction } from "@/components/ui/status-panel";
import "./member-pass.css";
import { QrCode } from "./qr-code";

type ActivePass = Extract<MemberPassResponse, { state: "active" }>;

interface MemberPassCardProps {
  current: MemberPassCode | null;
  now: number;
  offline: boolean;
  onRetry: () => void;
  pass: ActivePass;
  secondsLeft: number;
}

const SLOT_SECONDS = 30;
const RING_RADIUS = 16;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function useTermLabel(holder: MemberPassHolder): string {
  const t = useTranslations("memberPass");
  return termLabel(t, holder);
}

/** Minimal ambient type: `WakeLockSentinel` is not in every DOM lib target. */
interface WakeLockSentinel {
  release: () => Promise<void>;
}

function useWakeLock(active: boolean) {
  useEffect(() => {
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinel> };
    };
    if (!(active && nav.wakeLock)) {
      return;
    }
    let sentinel: WakeLockSentinel | null = null;
    nav.wakeLock
      .request("screen")
      .then((lock) => {
        sentinel = lock;
      })
      .catch(() => undefined);
    return () => {
      sentinel?.release().catch(() => undefined);
    };
  }, [active]);
}

function CountdownRing({ secondsLeft }: { secondsLeft: number }) {
  const offset = RING_CIRCUMFERENCE * (1 - secondsLeft / SLOT_SECONDS);
  return (
    <svg
      aria-hidden="true"
      className="h-10 w-10 -rotate-90"
      viewBox="0 0 40 40"
    >
      <circle
        cx="20"
        cy="20"
        fill="none"
        r={RING_RADIUS}
        stroke="currentColor"
        strokeOpacity={0.2}
        strokeWidth={4}
      />
      <circle
        cx="20"
        cy="20"
        fill="none"
        r={RING_RADIUS}
        stroke="currentColor"
        strokeDasharray={RING_CIRCUMFERENCE}
        strokeDashoffset={offset}
        strokeLinecap="round"
        strokeWidth={4}
      />
    </svg>
  );
}

function PassBody({
  current,
  now,
  offline,
  pass,
  secondsLeft,
}: MemberPassCardProps) {
  const t = useTranslations("memberPass");
  const format = useFormatter();
  const termLabel = useTermLabel(pass.holder);
  const clock = format.dateTime(new Date(now), {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Europe/Oslo",
  });
  const validUntil = format.dateTime(
    new Date(`${pass.holder.expiryDate}T12:00:00Z`),
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  );

  return (
    <div className="overflow-hidden rounded-3xl bg-linear-to-br from-brand-gradient-from to-brand-gradient-to text-white shadow-xl">
      <div className="flex items-start justify-between px-6 pt-6">
        <div>
          <p className="font-semibold text-sm text-white/70 tracking-widest">
            BISO
          </p>
          <p className="font-black text-4xl uppercase tracking-tight">
            {t("member")}
          </p>
        </div>
        <p className="rounded-full bg-white/15 px-3 py-1 font-semibold text-sm">
          {termLabel}
        </p>
      </div>

      <div className="member-pass-holo mt-5 h-3" />

      <div className="flex items-center justify-between px-6 pt-5">
        <p className="truncate font-semibold text-2xl">{pass.holder.name}</p>
        <p className="flex items-center gap-2 font-semibold text-lg tabular-nums">
          <span className="member-pass-live-dot inline-block h-2.5 w-2.5 rounded-full bg-green-400" />
          <span className="sr-only">{t("live")}</span>
          {clock}
        </p>
      </div>

      <div
        className="mx-6 mt-4 flex items-center justify-between rounded-xl px-4 py-3 font-bold text-lg"
        style={{ backgroundColor: pass.dayColor.hex }}
      >
        <span className="text-white/90 text-xs uppercase tracking-widest">
          {t("todaysColor")}
        </span>
        <span className="uppercase tracking-wider">
          {t(`colors.${pass.dayColor.name}` as "colors.red")}
        </span>
      </div>

      <div className="flex items-center gap-5 p-6">
        <div className="w-40 shrink-0 overflow-hidden rounded-xl bg-white p-2">
          {current && !offline ? (
            <QrCode
              className="h-full w-full"
              label={t("showToStaff")}
              value={current.code}
            />
          ) : (
            <div className="flex aspect-square items-center justify-center p-2 text-center text-black text-xs">
              {t("states.offline.title")}
            </div>
          )}
        </div>
        <div className="space-y-3">
          <p className="text-sm text-white/80">
            {t("validUntil", { date: validUntil })}
          </p>
          <div className="flex items-center gap-2 text-sm text-white/80">
            <CountdownRing secondsLeft={secondsLeft} />
            {t("refreshesIn", { seconds: secondsLeft })}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Compact secondary action for the row under the pass. */
const passActionClass = cn(statusPanelSecondaryAction, "px-4 py-2");

/**
 * The pass plus its chrome: the tap-to-present button, retry, wallet links and
 * the full-screen view. Only the chrome follows the site's panel style — the
 * pass itself (`PassBody`) keeps its own look, since staff read it by the
 * colour of the day, the moving band and the live clock.
 */
export function MemberPassCard(props: MemberPassCardProps) {
  const t = useTranslations("memberPass");
  const [presenting, setPresenting] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  useWakeLock(presenting);
  const { wallets } = props.pass;

  // The full-screen view is a modal: focus moves into it, Escape leaves it.
  useEffect(() => {
    if (!presenting) {
      return;
    }
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPresenting(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [presenting]);

  return (
    <div className="flex flex-col gap-3">
      <button
        aria-label={t("tapToShow")}
        className="block w-full rounded-3xl text-left focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-solid focus-visible:outline-offset-4"
        onClick={() => setPresenting(true)}
        type="button"
      >
        <PassBody {...props} />
      </button>
      <p className="type-body-sm text-center text-ink-muted">
        {t("tapToShow")}
      </p>
      {props.offline ? (
        <div className="flex justify-center">
          <button
            className={passActionClass}
            onClick={props.onRetry}
            type="button"
          >
            <RefreshCw aria-hidden="true" className="size-4 shrink-0" />
            {t("states.unavailable.action")}
          </button>
        </div>
      ) : null}

      {wallets.apple || wallets.google ? (
        <div className="flex flex-wrap justify-center gap-2">
          {wallets.apple ? (
            <a className={passActionClass} href="/api/member-pass/apple">
              <Wallet aria-hidden="true" className="size-4 shrink-0" />
              {t("wallet.apple")}
            </a>
          ) : null}
          {wallets.google ? (
            <a className={passActionClass} href="/api/member-pass/google">
              <Smartphone aria-hidden="true" className="size-4 shrink-0" />
              {t("wallet.google")}
            </a>
          ) : null}
        </div>
      ) : null}

      {presenting ? (
        <div
          aria-label={t("showToStaff")}
          aria-modal="true"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black p-4"
          role="dialog"
        >
          <div className="w-full max-w-md">
            <PassBody {...props} />
          </div>
          <p className="type-body-sm max-w-md text-center text-white/70">
            {t("showToStaff")}
          </p>
          <button
            className="type-label inline-flex items-center gap-2 rounded-biso-pill bg-white px-5 py-3 text-deep transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-white focus-visible:outline-offset-2"
            onClick={() => setPresenting(false)}
            ref={closeRef}
            type="button"
          >
            <X aria-hidden="true" className="size-4 shrink-0" />
            {t("close")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

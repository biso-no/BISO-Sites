"use client";

import type { MemberPassCode } from "@repo/shared/utils/member-pass-slots";
import { Button } from "@repo/ui/components/ui/button";
import { RefreshCw, Smartphone, Wallet, X } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { termLabel } from "@/lib/member-pass/term-label";
import type {
  MemberPassHolder,
  MemberPassResponse,
} from "@/lib/member-pass/types";
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
        <p className="flex items-center gap-2 font-mono text-lg tabular-nums">
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

export function MemberPassCard(props: MemberPassCardProps) {
  const t = useTranslations("memberPass");
  const [presenting, setPresenting] = useState(false);
  useWakeLock(presenting);
  const { wallets } = props.pass;

  return (
    <div className="space-y-3">
      <button
        aria-label={t("tapToShow")}
        className="block w-full text-left"
        onClick={() => setPresenting(true)}
        type="button"
      >
        <PassBody {...props} />
      </button>
      <p className="text-center text-muted-foreground text-xs">
        {t("tapToShow")}
      </p>
      {props.offline ? (
        <div className="flex justify-center">
          <Button onClick={props.onRetry} size="sm" variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            {t("states.unavailable.action")}
          </Button>
        </div>
      ) : null}

      {wallets.apple || wallets.google ? (
        <div className="flex flex-wrap justify-center gap-2">
          {wallets.apple ? (
            <Button asChild size="sm" variant="outline">
              <a href="/api/member-pass/apple">
                <Wallet className="mr-2 h-4 w-4" />
                {t("wallet.apple")}
              </a>
            </Button>
          ) : null}
          {wallets.google ? (
            <Button asChild size="sm" variant="outline">
              <a href="/api/member-pass/google">
                <Smartphone className="mr-2 h-4 w-4" />
                {t("wallet.google")}
              </a>
            </Button>
          ) : null}
        </div>
      ) : null}

      {presenting ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black p-4"
          role="dialog"
        >
          <div className="w-full max-w-md">
            <PassBody {...props} />
          </div>
          <p className="max-w-md text-center text-sm text-white/70">
            {t("showToStaff")}
          </p>
          <Button onClick={() => setPresenting(false)} variant="secondary">
            <X className="mr-2 h-4 w-4" />
            {t("close")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

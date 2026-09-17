"use client";

import type { DayColor } from "@repo/shared/utils/member-pass";
import {
  AlertTriangle,
  CheckCircle2,
  CircleSlash,
  Loader2,
  RotateCw,
  ShieldAlert,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ScanOutcome } from "@/lib/member-pass/types";
import { SCAN_TONE_CLASSES, type ScanTone, scanTone } from "./scan-tone";

type ScanAction = (
  code: string
) => Promise<
  { data: ScanOutcome; success: true } | { error: string; success: false }
>;

interface ScannerScreenProps {
  dayColor: DayColor | null;
  onScan: ScanAction;
  subtitle?: string;
  title: string;
}

type CameraState = "starting" | "ready" | "error";

const RESULT_DISMISS_MS = 3000;
const SAME_CODE_COOLDOWN_MS = 4000;
const VIBRATION: Record<ScanTone, number[]> = {
  amber: [80, 60, 80],
  green: [120],
  grey: [40, 40, 40],
  orange: [80, 60, 80],
  red: [300],
};

const ICONS: Record<ScanTone, typeof CheckCircle2> = {
  amber: ShieldAlert,
  green: CheckCircle2,
  grey: RotateCw,
  orange: AlertTriangle,
  red: CircleSlash,
};

interface QrScannerInstance {
  destroy: () => void;
  start: () => Promise<void>;
}

/**
 * Starts the qr-scanner camera against `video` once mounted, and tears it
 * down on unmount. Kept out of ScannerScreen to keep the component's
 * cognitive complexity down.
 */
function useCameraScanner(
  video: RefObject<HTMLVideoElement | null>,
  onDecode: (code: string) => void
): CameraState {
  const [cameraState, setCameraState] = useState<CameraState>("starting");

  useEffect(() => {
    const element = video.current;
    if (!element) {
      return;
    }
    let scanner: QrScannerInstance | null = null;
    let cancelled = false;

    const start = async () => {
      try {
        const { default: QrScanner } = await import("qr-scanner");
        if (cancelled) {
          return;
        }
        scanner = new QrScanner(element, (result) => onDecode(result.data), {
          highlightScanRegion: true,
          preferredCamera: "environment",
          returnDetailedScanResult: true,
        });
        await scanner.start();
        if (!cancelled) {
          setCameraState("ready");
        }
      } catch {
        if (!cancelled) {
          setCameraState("error");
        }
      }
    };

    start();

    return () => {
      cancelled = true;
      scanner?.destroy();
    };
  }, [video, onDecode]);

  return cameraState;
}

function isSameCodeInCooldown(
  recent: { at: number; code: string } | null,
  code: string,
  now: number
): boolean {
  return (
    recent !== null &&
    recent.code === code &&
    now - recent.at < SAME_CODE_COOLDOWN_MS
  );
}

type Translator = ReturnType<typeof useTranslations<"adminPortal.memberPass">>;

function DayColorBadge({ dayColor, t }: { dayColor: DayColor; t: Translator }) {
  return (
    <div
      className="flex items-center gap-2 rounded-full px-3 py-1 font-bold text-sm uppercase"
      style={{ backgroundColor: dayColor.hex }}
    >
      <span className="sr-only">{t("todaysColor")}</span>
      {t(`colors.${dayColor.name}` as "colors.red")}
    </div>
  );
}

function CameraOverlay({
  cameraState,
  t,
}: {
  cameraState: CameraState;
  t: Translator;
}) {
  if (cameraState === "ready") {
    return null;
  }
  return (
    <div className="z-10 m-auto flex flex-col items-center gap-3 p-6 text-center">
      {cameraState === "starting" ? (
        <Loader2 className="h-8 w-8 animate-spin" />
      ) : (
        <AlertTriangle className="h-8 w-8" />
      )}
      <p>{cameraState === "starting" ? t("starting") : t("cameraError")}</p>
    </div>
  );
}

function OutcomePanel({
  format,
  onDismiss,
  outcome,
  t,
}: {
  format: ReturnType<typeof useFormatter>;
  onDismiss: () => void;
  outcome: ScanOutcome;
  t: Translator;
}) {
  const tone = scanTone(outcome);
  const Icon = ICONS[tone];
  return (
    <button
      className={`absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 p-6 text-center ${SCAN_TONE_CLASSES[tone]}`}
      onClick={onDismiss}
      type="button"
    >
      <Icon className="h-24 w-24" />
      <p className="font-black text-3xl uppercase">
        {t(`results.${outcome.result}`, {
          seconds: outcome.secondsSincePrevious ?? 0,
        })}
      </p>
      {outcome.name ? (
        <p className="font-bold text-4xl">{outcome.name}</p>
      ) : null}
      {outcome.reason ? (
        <p className="text-xl">{t(`reasons.${outcome.reason}`)}</p>
      ) : null}
      {outcome.membershipName ? (
        <p className="text-xl">{outcome.membershipName}</p>
      ) : null}
      {outcome.expiryDate ? (
        <p className="text-lg opacity-80">
          {t("validUntil", {
            date: format.dateTime(new Date(`${outcome.expiryDate}T12:00:00Z`), {
              day: "numeric",
              month: "short",
              year: "numeric",
            }),
          })}
        </p>
      ) : null}
      <p className="mt-6 text-sm opacity-70">{t("tapToContinue")}</p>
    </button>
  );
}

function ErrorBanner({ error, t }: { error: string; t: Translator }) {
  return (
    <div className="absolute inset-x-4 bottom-4 z-20 rounded-xl bg-red-600 p-4 text-center font-semibold">
      {error === "rate_limited"
        ? t("guest.rateLimited")
        : t(`links.errors.${error}` as "links.errors.failed")}
    </div>
  );
}

export function ScannerScreen({
  dayColor,
  onScan,
  subtitle,
  title,
}: ScannerScreenProps) {
  const t = useTranslations("adminPortal.memberPass");
  const format = useFormatter();
  const video = useRef<HTMLVideoElement>(null);
  const busy = useRef(false);
  const lastCode = useRef<{ at: number; code: string } | null>(null);
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCode = useCallback(
    async (code: string) => {
      const now = Date.now();
      if (busy.current || isSameCodeInCooldown(lastCode.current, code, now)) {
        return;
      }
      busy.current = true;
      lastCode.current = { at: now, code };
      try {
        const response = await onScan(code);
        if (response.success) {
          setOutcome(response.data);
          navigator.vibrate?.(VIBRATION[scanTone(response.data)]);
        } else {
          setError(response.error);
        }
      } catch {
        setOutcome({ result: "unavailable" });
      } finally {
        busy.current = false;
      }
    },
    [onScan]
  );

  const cameraState = useCameraScanner(video, handleCode);

  useEffect(() => {
    if (!(outcome || error)) {
      return;
    }
    const timer = setTimeout(() => {
      setOutcome(null);
      setError(null);
    }, RESULT_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [outcome, error]);

  return (
    <div className="relative flex min-h-[calc(100dvh-4rem)] flex-col overflow-hidden rounded-2xl bg-black text-white">
      <div className="z-10 flex items-center justify-between gap-3 bg-black/70 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{title}</p>
          {subtitle ? (
            <p className="truncate text-sm text-white/60">{subtitle}</p>
          ) : null}
        </div>
        {dayColor ? <DayColorBadge dayColor={dayColor} t={t} /> : null}
      </div>

      <video
        className="absolute inset-0 h-full w-full object-cover"
        muted
        playsInline
        ref={video}
      />

      <CameraOverlay cameraState={cameraState} t={t} />

      {outcome ? (
        <OutcomePanel
          format={format}
          onDismiss={() => setOutcome(null)}
          outcome={outcome}
          t={t}
        />
      ) : null}

      {error ? <ErrorBanner error={error} t={t} /> : null}
    </div>
  );
}

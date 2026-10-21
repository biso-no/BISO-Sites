"use client";

import {
  broadcastChannelFor,
  GENERAL_TOPIC_ID,
} from "@repo/shared/utils/notification-topics";
import {
  formatOsloDate,
  isoToOsloWallClock,
  osloWallClockToIso,
} from "@repo/shared/utils/oslo-time";
import { Moon, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { TranslationReviewCard } from "@/app/_components/content-translation-controls";
import { getAudienceReach } from "@/app/(portal)/_actions/composer";
import { phoneCount } from "@/lib/announcements/audience-names";
import type { AnnouncementFormValues } from "../../../_actions/schemas";
import {
  type ComposerStepIndex,
  canContinue,
  TYPE_CARDS,
} from "./composer-state";
import { isQuietHoursOslo, nextMorningOslo } from "./quiet-hours";
import {
  BRAND,
  FieldLabel,
  fieldInputStyle,
  type LocaleCode,
  Pill,
  SERIF,
  StepIntro,
} from "./ui";
import {
  type GetReach,
  isChannelAudience,
  REACH_UNAVAILABLE,
  reachHeadline,
  useAudienceReach,
} from "./use-audience-reach";
import { reachRequest } from "./who-step";

interface CampusOption {
  label: string;
  value: string;
}

interface CheckStepProps {
  /** The notification has gone out; it can be edited but not sent again. */
  alreadySent?: boolean;
  campusOptions: CampusOption[];
  confirmTranslationOverwrite: boolean;
  getReach?: GetReach;
  /** The linked content as the What step shows it, or null when unlinked. */
  link: { label?: string; title: string } | null;
  locale: LocaleCode;
  /** Injected so the late-night offer can be tested at a fixed time. */
  now?: () => Date;
  onEdit: (step: ComposerStepIndex) => void;
  /** Runs the send. Called once any needed confirmation has been given. */
  onSend: () => void;
  onTranslate: () => void;
  /** A draft save is in flight; sending waits for it. */
  saving?: boolean;
  sending: boolean;
  set: <K extends keyof AnnouncementFormValues>(
    key: K,
    value: AnnouncementFormValues[K]
  ) => void;
  translating: boolean;
  values: AnnouncementFormValues;
}

const ALREADY_SENT_NOTE = "This notification has already been sent.";

const WHAT_STEP = 0;
const MESSAGE_STEP = 1;
const WHO_STEP = 2;

type TimingMode = "now" | "schedule";

/**
 * The campus an Everyone announcement is limited to, or `null` when it reaches
 * every app user. Same rule as dispatch (`broadcastChannelFor`): a real campus
 * scopes it to that campus; National or no campus means everyone.
 */
function broadcastCampusName(
  campusId: string | null | undefined,
  campusOptions: CampusOption[]
): string | null {
  if (broadcastChannelFor(campusId) === GENERAL_TOPIC_ID) {
    return null;
  }
  return (
    campusOptions.find((campus) => campus.value === campusId)?.label ??
    "the selected campus"
  );
}

/** A language counts when its title is written; the message is optional. */
function languagesSentence(values: AnnouncementFormValues): string {
  const hasNorwegian = Boolean(values.title_no?.trim());
  const hasEnglish = Boolean(values.title_en.trim());
  if (hasNorwegian && hasEnglish) {
    return "Norwegian and English";
  }
  const one = hasNorwegian ? "Norwegian" : "English";
  return `${one} only — students get it in ${one}`;
}

function timingSentence(
  scheduledAt: string | null | undefined,
  now: Date
): string {
  const at = scheduledAt ? new Date(scheduledAt) : null;
  if (!at || Number.isNaN(at.getTime()) || at.getTime() <= now.getTime()) {
    return "Sends right away";
  }
  const day = formatOsloDate(
    at,
    { day: "numeric", month: "short", weekday: "short" },
    "en-GB"
  );
  const time = formatOsloDate(
    at,
    { hour: "2-digit", hourCycle: "h23", minute: "2-digit" },
    "en-GB"
  );
  return `Sends ${day}, ${time} (Oslo time)`;
}

function categoryLabel(category: AnnouncementFormValues["category"]): string {
  return TYPE_CARDS.find((card) => card.id === category)?.label ?? "General";
}

function whoSentence(
  values: AnnouncementFormValues,
  reach: ReturnType<typeof useAudienceReach>
): { main: string; sub: string | null } {
  const request = reachRequest(values);
  if (reach.hint) {
    return { main: reach.hint, sub: null };
  }
  if (reach.unavailable) {
    return { main: REACH_UNAVAILABLE, sub: null };
  }
  if (!reach.result) {
    return { main: "Counting…", sub: null };
  }
  return {
    main: reachHeadline(request, reach.result),
    sub: isChannelAudience(request) ? reach.result.sentence : null,
  };
}

function SummaryRow({
  children,
  label,
  onEdit,
}: {
  children: React.ReactNode;
  label: string;
  onEdit?: () => void;
}) {
  return (
    <div
      style={{
        alignItems: "baseline",
        display: "grid",
        gap: 14,
        gridTemplateColumns: "96px 1fr auto",
        padding: "15px 18px",
      }}
    >
      <span
        style={{
          color: BRAND.ink4,
          fontSize: 11,
          letterSpacing: ".06em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <div style={{ color: BRAND.ink, fontSize: 14.5, lineHeight: 1.45 }}>
        {children}
      </div>
      {onEdit && (
        <button
          aria-label={`Edit ${label.toLowerCase()}`}
          onClick={onEdit}
          style={{
            background: "transparent",
            border: 0,
            color: BRAND.bisoBlue,
            cursor: "pointer",
            fontSize: 12.5,
            padding: 0,
          }}
          type="button"
        >
          Edit
        </button>
      )}
    </div>
  );
}

function ConfirmEveryone({
  campusName,
  count,
  onCancel,
  onConfirm,
}: {
  campusName: string | null;
  count: number | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  // The latest handler, so the listener below is set up once and the focus
  // below is taken once, whatever re-renders happen while the dialog is open.
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  useEffect(() => {
    cancelRef.current?.focus();
    const keepFocusInside = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancelRef.current();
        return;
      }
      if (event.key !== "Tab") {
        return;
      }
      const first = cancelRef.current;
      const last = confirmRef.current;
      const active = document.activeElement;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first?.focus();
      } else if (active !== first && active !== last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", keepFocusInside);
    return () => document.removeEventListener("keydown", keepFocusInside);
  }, []);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: a backdrop click cancels; Escape is the keyboard route.
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: same backdrop click.
    // biome-ignore lint/a11y/useKeyWithClickEvents: Escape is handled on the document while the dialog is open.
    <div
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onCancel();
        }
      }}
      style={{
        alignItems: "center",
        background: "rgba(26,24,20,.45)",
        display: "flex",
        inset: 0,
        justifyContent: "center",
        padding: 16,
        position: "fixed",
        zIndex: 50,
      }}
    >
      <div
        aria-describedby="confirm-everyone-body"
        aria-labelledby="confirm-everyone-title"
        aria-modal="true"
        role="alertdialog"
        style={{
          background: BRAND.paper,
          border: `0.5px solid ${BRAND.rule2}`,
          borderRadius: 16,
          boxShadow: "0 24px 60px rgba(0,0,0,.25)",
          maxWidth: 420,
          padding: 24,
          width: "100%",
        }}
      >
        <div
          id="confirm-everyone-title"
          style={{
            color: BRAND.ink,
            fontFamily: SERIF,
            fontSize: 28,
            lineHeight: 1.1,
          }}
        >
          {campusName
            ? `Send to everyone at ${campusName}?`
            : "Send to every student?"}
        </div>
        <p
          id="confirm-everyone-body"
          style={{
            color: BRAND.ink3,
            fontSize: 14,
            lineHeight: 1.5,
            margin: "8px 0 0",
          }}
        >
          {count === null ? "" : `This reaches about ${phoneCount(count)}.`}
        </p>
        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
            marginTop: 20,
          }}
        >
          <button
            onClick={onCancel}
            ref={cancelRef}
            style={{
              background: "white",
              border: `0.5px solid ${BRAND.rule2}`,
              borderRadius: 8,
              color: BRAND.ink,
              cursor: "pointer",
              fontSize: 13.5,
              padding: "9px 16px",
            }}
            type="button"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            ref={confirmRef}
            style={{
              background: BRAND.bisoBlue,
              border: `0.5px solid ${BRAND.bisoBlue}`,
              borderRadius: 8,
              color: "white",
              cursor: "pointer",
              fontSize: 13.5,
              fontWeight: 500,
              padding: "9px 18px",
            }}
            type="button"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

function LateNightOffer({ onAccept }: { onAccept: () => void }) {
  return (
    <div
      style={{
        alignItems: "center",
        background: "rgba(176,138,62,.1)",
        border: `0.5px solid ${BRAND.gold}`,
        borderRadius: 12,
        display: "flex",
        flexWrap: "wrap",
        gap: 12,
        marginTop: 12,
        padding: "12px 14px",
      }}
    >
      <Moon size={16} style={{ color: BRAND.gold }} />
      <span style={{ color: BRAND.ink2, flex: 1, fontSize: 13.5 }}>
        It's late. Students may be asleep.
      </span>
      <button
        onClick={onAccept}
        style={{
          background: BRAND.ink,
          border: 0,
          borderRadius: 8,
          color: BRAND.paper,
          cursor: "pointer",
          fontSize: 13,
          padding: "7px 13px",
        }}
        type="button"
      >
        Send at 08:00 instead
      </button>
    </div>
  );
}

/** Why Send is off, or null when the announcement is ready to go. */
function sendBlocker(
  values: AnnouncementFormValues,
  mode: TimingMode,
  now: Date
): string | null {
  for (const step of [WHAT_STEP, WHO_STEP] as const) {
    const gate = canContinue(step, values);
    if (!gate.ok) {
      return gate.reason ?? "This is not ready to send.";
    }
  }
  if (mode !== "schedule") {
    return null;
  }
  if (!values.scheduled_at) {
    return "Pick a date and time.";
  }
  return new Date(values.scheduled_at).getTime() <= now.getTime()
    ? "Pick a time in the future."
    : null;
}

function sendLabel(sending: boolean, mode: TimingMode): string {
  if (sending) {
    return "Sending…";
  }
  return mode === "schedule" ? "Schedule send" : "Send";
}

export function CheckStep({
  alreadySent = false,
  campusOptions,
  confirmTranslationOverwrite,
  getReach = getAudienceReach,
  link,
  locale,
  now = () => new Date(),
  onEdit,
  onSend,
  onTranslate,
  saving = false,
  sending,
  set,
  translating,
  values,
}: CheckStepProps) {
  const [mode, setMode] = useState<TimingMode>(
    values.scheduled_at ? "schedule" : "now"
  );
  const [confirming, setConfirming] = useState(false);
  const sendRef = useRef<HTMLButtonElement>(null);
  const reach = useAudienceReach(reachRequest(values), getReach);
  const current = now();

  const blocker = sendBlocker(values, mode, current);

  const showLateOffer =
    mode === "now" && values.category !== "urgent" && isQuietHoursOslo(current);
  const whoLine = whoSentence(values, reach);

  function chooseNow() {
    setMode("now");
    set("scheduled_at", null);
  }

  function sendAtMorning() {
    set("scheduled_at", nextMorningOslo(now()).toISOString());
    setMode("schedule");
  }

  function closeConfirm() {
    setConfirming(false);
    sendRef.current?.focus();
  }

  function pressSend() {
    if (values.audience_type === "broadcast") {
      setConfirming(true);
      return;
    }
    onSend();
  }

  return (
    <div>
      <StepIntro eyebrow="Step 4" title="Check & send" />
      <p
        style={{
          color: BRAND.ink3,
          fontSize: 13.5,
          margin: "0 0 18px",
          maxWidth: "50ch",
        }}
      >
        Have a last look. The previews on the right show how it lands on a phone
        and in the in-app inbox.
      </p>

      <div
        style={{
          background: "rgba(255,255,255,.55)",
          border: `0.5px solid ${BRAND.rule}`,
          borderRadius: 14,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <SummaryRow label="What" onEdit={() => onEdit(WHAT_STEP)}>
          <div>
            {categoryLabel(values.category)}:{" "}
            {values.title_en.trim() || values.title_no?.trim() || "No title"}
          </div>
          {link && (
            <div style={{ color: BRAND.ink3, fontSize: 13 }}>
              Opens {link.label ?? link.title}
            </div>
          )}
        </SummaryRow>
        <div style={{ borderTop: `0.5px solid ${BRAND.rule}` }}>
          <SummaryRow label="Who" onEdit={() => onEdit(WHO_STEP)}>
            <div style={{ fontFamily: SERIF, fontSize: 22, lineHeight: 1.2 }}>
              {whoLine.main}
            </div>
            {whoLine.sub && (
              <div style={{ color: BRAND.ink3, fontSize: 13 }}>
                {whoLine.sub}
              </div>
            )}
          </SummaryRow>
        </div>
        <div style={{ borderTop: `0.5px solid ${BRAND.rule}` }}>
          <SummaryRow label="Languages" onEdit={() => onEdit(MESSAGE_STEP)}>
            {languagesSentence(values)}
          </SummaryRow>
        </div>
        <div style={{ borderTop: `0.5px solid ${BRAND.rule}` }}>
          <SummaryRow label="Timing">
            {timingSentence(values.scheduled_at, current)}
          </SummaryRow>
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <FieldLabel>When</FieldLabel>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <Pill active={mode === "now"} onClick={chooseNow}>
            Send now
          </Pill>
          <Pill
            active={mode === "schedule"}
            onClick={() => setMode("schedule")}
          >
            Schedule
          </Pill>
        </div>
        {mode === "schedule" && (
          <input
            aria-label="Date and time (Oslo time)"
            onChange={(event) =>
              set("scheduled_at", osloWallClockToIso(event.target.value))
            }
            style={fieldInputStyle({ marginTop: 10, maxWidth: 260 })}
            type="datetime-local"
            value={isoToOsloWallClock(values.scheduled_at)}
          />
        )}
        {showLateOffer && <LateNightOffer onAccept={sendAtMorning} />}
      </div>

      <div style={{ marginTop: 22 }}>
        <FieldLabel>How it arrives</FieldLabel>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <Pill active={values.push} onClick={() => set("push", true)}>
            Push + inbox
          </Pill>
          <Pill active={!values.push} onClick={() => set("push", false)}>
            Inbox only
          </Pill>
        </div>
      </div>

      <TranslationReviewCard
        className="mt-6"
        isTranslating={translating}
        onTranslate={onTranslate}
        sourceLocale={locale}
      />
      {confirmTranslationOverwrite && (
        <p style={{ color: BRAND.gold, fontSize: 12.5, margin: "8px 0 0" }}>
          The destination already has content. Click Generate again to replace
          it.
        </p>
      )}

      {alreadySent ? (
        <p style={{ color: BRAND.ink3, fontSize: 14, margin: "28px 0 0" }}>
          {ALREADY_SENT_NOTE}
        </p>
      ) : (
        <div style={{ marginTop: 28 }}>
          <button
            disabled={Boolean(blocker) || sending || saving}
            onClick={pressSend}
            ref={sendRef}
            style={{
              alignItems: "center",
              background: BRAND.bisoBlue,
              border: `0.5px solid ${BRAND.bisoBlue}`,
              borderRadius: 10,
              color: "white",
              cursor: blocker || sending || saving ? "not-allowed" : "pointer",
              display: "flex",
              fontSize: 15,
              fontWeight: 500,
              gap: 8,
              opacity: blocker ? 0.5 : 1,
              padding: "12px 24px",
            }}
            type="button"
          >
            <Send size={15} />
            {sendLabel(sending, mode)}
          </button>
          {blocker && (
            <p style={{ color: BRAND.claret, fontSize: 13, margin: "8px 0 0" }}>
              {blocker}
            </p>
          )}
        </div>
      )}

      {confirming && (
        <ConfirmEveryone
          campusName={broadcastCampusName(values.campus_id, campusOptions)}
          count={reach.result?.count ?? null}
          onCancel={closeConfirm}
          onConfirm={() => {
            closeConfirm();
            onSend();
          }}
        />
      )}
    </div>
  );
}

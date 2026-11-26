"use client";

import type { Placeholder } from "@repo/shared/big-events/messages/text";
import type { MessageStatus } from "@repo/shared/big-events/tables";
import { Languages } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { joinOsloDateTime } from "@/lib/big-events/dates";
import {
  type MessageDraft,
  type MessageLocale,
  type SendWhen,
  sendTime,
} from "@/lib/big-events/messages/draft";
import {
  sendBigEventMessage,
  translateMessage,
} from "../../../../_actions/big-event-messages";
import { PortalButton } from "../../../../_components/portal-button";
import { STUDIO } from "../../../../_components/studio";
import {
  type ComposerTexts,
  hasText,
  otherLocale,
  type TextField,
  textsComplete,
} from "./composer-state";
import { formatWhen } from "./format-when";
import { MessageFields } from "./message-fields";
import { ReachBox } from "./reach-box";
import { SamplePreviews } from "./sample-previews";
import { ScheduleControl, type SendMode } from "./schedule-control";
import type { MessagePreview } from "./use-message-preview";

const LANGUAGES: readonly MessageLocale[] = ["no", "en"];

interface CheckStepProps {
  bigEventId: string;
  draft: MessageDraft;
  /** The admin's language, the one the message was written in first. */
  locale: MessageLocale;
  now?: () => Date;
  onBack: () => void;
  /** After the message is sent or planned (the outcome is already shown). */
  onSent: () => void;
  onTextChange: (
    language: MessageLocale,
    field: TextField,
    value: string
  ) => void;
  placeholders: readonly Placeholder[];
  preview: MessagePreview;
  texts: ComposerTexts;
}

/**
 * Check & send (spec D6): both languages, editable, with "Translate" to
 * fill one from the other (plan M6); the reach; one sample per bus or room
 * in both languages and the warnings; then send now or at an Oslo time.
 */
export function CheckStep({
  bigEventId,
  draft,
  locale,
  now = () => new Date(),
  onBack,
  onSent,
  onTextChange,
  placeholders,
  preview,
  texts,
}: CheckStepProps) {
  const t = useTranslations("adminPortal.bigEvents.messages");
  const [mode, setMode] = useState<SendMode>("now");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isTranslating, startTranslating] = useTransition();
  const [isSending, startSending] = useTransition();

  const complete = textsComplete(texts);
  const source = hasText(texts, locale) ? locale : otherLocale(locale);
  const target = otherLocale(source);
  const replaces =
    texts.title[target].trim() !== "" || texts.body[target].trim() !== "";

  function translate() {
    startTranslating(async () => {
      try {
        const result = await translateMessage(bigEventId, {
          body: texts.body[source],
          from: source,
          title: texts.title[source],
        });
        if (!result.ok) {
          toast.error(t(`errors.${result.error}`));
          return;
        }
        onTextChange(target, "title", result.title);
        onTextChange(target, "body", result.body);
      } catch {
        toast.error(t("check.translateFailed"));
      }
    });
  }

  /** Now, an Oslo time that hasn't passed, or the sentence saying why not. */
  function whenToSend(): SendWhen | string {
    if (mode === "now") {
      return { at: "now" };
    }
    const at = joinOsloDateTime(date, time);
    if (!at) {
      return t("check.pickTime");
    }
    return sendTime({ at }, now()).ok ? { at } : t("errors.in_the_past");
  }

  function announce(status: MessageStatus, people: number, when: SendWhen) {
    if (status === "failed") {
      toast.error(t("sent.failed"));
    } else if (status === "sending") {
      toast.info(t("sent.sending"));
    } else if (status === "scheduled") {
      toast.success(t("sent.scheduled", { when: formatWhen(when.at, locale) }));
    } else {
      toast.success(t("sent.now", { count: people }));
    }
  }

  function send() {
    const when = whenToSend();
    if (typeof when === "string") {
      setError(when);
      return;
    }
    setError(null);
    startSending(async () => {
      try {
        const result = await sendBigEventMessage(bigEventId, draft, when);
        if (!result.ok) {
          setError(t(`errors.${result.error}`));
          return;
        }
        announce(result.status, result.people, when);
        onSent();
      } catch {
        setError(t("errors.unexpected"));
      }
    });
  }

  const ready = preview.answer?.kind === "ready" ? preview.answer : null;

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-medium text-base" style={{ color: STUDIO.ink }}>
              {t("check.languages")}
            </h3>
            <p className="text-sm" style={{ color: STUDIO.ink3 }}>
              {t("check.languagesHelp")}
            </p>
          </div>
          <div className="flex max-w-xs flex-col items-end gap-1 text-right">
            <PortalButton
              disabled={!hasText(texts, source)}
              loading={isTranslating}
              onClick={translate}
              size="sm"
            >
              <Languages aria-hidden size={14} />
              {isTranslating ? t("check.translating") : t("check.translate")}
            </PortalButton>
            <p className="text-xs" style={{ color: STUDIO.ink4 }}>
              {t(replaces ? "check.translateReplaces" : "check.translateHelp", {
                source,
                target,
              })}
            </p>
          </div>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          {LANGUAGES.map((language) => (
            <MessageFields
              key={language}
              language={language}
              onChange={(field, value) => onTextChange(language, field, value)}
              placeholders={placeholders}
              value={{
                body: texts.body[language],
                title: texts.title[language],
              }}
            />
          ))}
        </div>
        {!complete && (
          <p className="text-sm" style={{ color: STUDIO.claret }}>
            {t("check.needBoth")}
          </p>
        )}
      </section>

      <ReachBox preview={preview} />
      {ready && (
        <SamplePreviews samples={ready.samples} warnings={ready.warnings} />
      )}

      <ScheduleControl
        date={date}
        mode={mode}
        onDate={setDate}
        onMode={(next) => {
          setMode(next);
          setError(null);
        }}
        onTime={setTime}
        time={time}
      />

      {error && (
        <p className="text-sm" role="alert" style={{ color: STUDIO.claret }}>
          {error}
        </p>
      )}

      <div
        className="flex items-center justify-between gap-2 border-t pt-5"
        style={{ borderColor: STUDIO.rule }}
      >
        <PortalButton disabled={isSending} onClick={onBack} variant="ghost">
          {t("steps.back")}
        </PortalButton>
        <PortalButton
          disabled={!complete}
          loading={isSending}
          onClick={send}
          variant="primary"
        >
          {isSending && t("check.sending")}
          {!isSending &&
            t(mode === "schedule" ? "check.sendScheduled" : "check.send")}
        </PortalButton>
      </div>
    </div>
  );
}

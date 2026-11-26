"use client";

import type { Placeholder } from "@repo/shared/big-events/messages/text";
import { useTranslations } from "next-intl";
import { useId } from "react";
import type { MessageLocale } from "@/lib/big-events/messages/draft";
import { STUDIO } from "../../../../_components/studio";
import { SwitchRow } from "../../../_components/switch-row";
import type { ComposerState, TextField } from "./composer-state";
import { MessageFields } from "./message-fields";
import { IMPORTANT_RED } from "./ui";

interface MessageStepProps {
  /** The admin's language: the message is written in it first (plan M6). */
  locale: MessageLocale;
  onChange: (patch: Partial<ComposerState>) => void;
  onTextChange: (
    language: MessageLocale,
    field: TextField,
    value: string
  ) => void;
  placeholders: readonly Placeholder[];
  /** The `big_events_sms` switch (spec D9). */
  smsEnabled: boolean;
  state: ComposerState;
}

/**
 * Message (spec D6): title and text in the admin's language with the
 * detail buttons, "Important", and "Also send as SMS" while SMS is on.
 */
export function MessageStep({
  locale,
  onChange,
  onTextChange,
  placeholders,
  smsEnabled,
  state,
}: MessageStepProps) {
  const t = useTranslations("adminPortal.bigEvents.messages.write");
  const id = useId();
  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm" style={{ color: STUDIO.ink3 }}>
        {t("intro", { language: locale })}
      </p>
      <MessageFields
        language={locale}
        onChange={(field, value) => onTextChange(locale, field, value)}
        placeholders={placeholders}
        value={{
          body: state.texts.body[locale],
          title: state.texts.title[locale],
        }}
      />
      <div className="grid gap-3 md:grid-cols-2">
        <SwitchRow
          checked={state.important}
          color={IMPORTANT_RED}
          help={t("importantHelp")}
          id={`${id}-important`}
          label={t("important")}
          // Important messages go by SMS too while SMS is on (spec D9).
          onChange={(important) =>
            onChange(
              important && smsEnabled
                ? { alsoSms: true, important }
                : { important }
            )
          }
        />
        {smsEnabled && (
          <SwitchRow
            checked={state.alsoSms}
            help={t("smsHelp")}
            id={`${id}-sms`}
            label={t("sms")}
            onChange={(alsoSms) => onChange({ alsoSms })}
          />
        )}
      </div>
    </div>
  );
}

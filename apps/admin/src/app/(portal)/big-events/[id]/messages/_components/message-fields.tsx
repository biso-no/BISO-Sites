"use client";

import {
  MESSAGE_BODY_MAX,
  MESSAGE_TITLE_MAX,
  type Placeholder,
} from "@repo/shared/big-events/messages/text";
import { useTranslations } from "next-intl";
import { useId } from "react";
import type { MessageLocale } from "@/lib/big-events/messages/draft";
import type { TextField } from "./composer-state";
import { PlaceholderButtons, useCursorInsert } from "./placeholder-buttons";
import { FIELD_CLASS, LABEL_CLASS } from "./ui";

const MAX: Record<TextField, number> = {
  body: MESSAGE_BODY_MAX,
  title: MESSAGE_TITLE_MAX,
};

interface MessageFieldsProps {
  /** Shown in an empty field: the text used when it is left empty. */
  defaults?: Record<TextField, string>;
  /** The language these fields are written in. */
  language: MessageLocale;
  onChange: (field: TextField, value: string) => void;
  /** The personal details offered as buttons. */
  placeholders: readonly Placeholder[];
  value: Record<TextField, string>;
}

/** A message's title and text in one language, with the detail buttons. */
export function MessageFields({
  defaults,
  language,
  onChange,
  placeholders,
  value,
}: MessageFieldsProps) {
  const t = useTranslations("adminPortal.bigEvents.messages.write");
  const id = useId();
  const cursor = useCursorInsert<TextField>({
    initial: "body",
    max: MAX,
    read: (field) => value[field],
    write: onChange,
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label className={LABEL_CLASS} htmlFor={`${id}-title`}>
          {t("title", { language })}
        </label>
        <input
          className={FIELD_CLASS}
          id={`${id}-title`}
          maxLength={MESSAGE_TITLE_MAX}
          onChange={(event) => onChange("title", event.target.value)}
          placeholder={defaults?.title}
          type="text"
          value={value.title}
          {...cursor.bind("title")}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className={LABEL_CLASS} htmlFor={`${id}-body`}>
          {t("body", { language })}
        </label>
        <textarea
          className={`${FIELD_CLASS} resize-y`}
          id={`${id}-body`}
          maxLength={MESSAGE_BODY_MAX}
          onChange={(event) => onChange("body", event.target.value)}
          placeholder={defaults?.body}
          rows={6}
          value={value.body}
          {...cursor.bind("body")}
        />
      </div>
      <PlaceholderButtons keys={placeholders} onInsert={cursor.insert} />
    </div>
  );
}

"use client";

import {
  type Placeholder,
  placeholderToken,
} from "@repo/shared/big-events/messages/text";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import type { MessageLocale } from "@/lib/big-events/messages/draft";
import { STUDIO } from "../../../../_components/studio";
import { LABEL_CLASS } from "./ui";

/**
 * Personal details go into a message by button, never typed (spec D6): each
 * button puts its `{…}` token, in the language of the fields it sits under,
 * where the cursor was in the field last used.
 */

type FieldElement = HTMLInputElement | HTMLTextAreaElement;

/**
 * `value` with `token` in place of the selection (or at the caret); without
 * a known caret, at the end. Returns the caret just after the token.
 */
export function insertAtCursor(
  value: string,
  start: number | null | undefined,
  end: number | null | undefined,
  token: string
): { caret: number; value: string } {
  const from = Math.min(Math.max(start ?? value.length, 0), value.length);
  const to = Math.min(Math.max(end ?? from, from), value.length);
  return {
    caret: from + token.length,
    value: `${value.slice(0, from)}${token}${value.slice(to)}`,
  };
}

interface CursorInsertOptions<F extends string> {
  /** The field a token goes into before any field was used. */
  initial: F;
  /** Longest each field may be; a token that won't fit isn't added. */
  max: Record<F, number>;
  read: (field: F) => string;
  write: (field: F, value: string) => void;
}

/**
 * Remembers the field in use and its caret, so a button can insert there
 * and put the caret back after the token.
 */
export function useCursorInsert<F extends string>({
  initial,
  max,
  read,
  write,
}: CursorInsertOptions<F>) {
  const elements = useRef(new Map<F, FieldElement>());
  const active = useRef<F>(initial);
  const caret = useRef<{ at: number; field: F } | null>(null);

  // After the inserted text is on screen: back to the field, caret after it.
  useEffect(() => {
    const pending = caret.current;
    if (!pending) {
      return;
    }
    caret.current = null;
    const element = elements.current.get(pending.field);
    element?.focus();
    if (typeof element?.setSelectionRange === "function") {
      element.setSelectionRange(pending.at, pending.at);
    }
  });

  return {
    bind: (field: F) => ({
      onFocus: () => {
        active.current = field;
      },
      ref: (element: FieldElement | null) => {
        if (element) {
          elements.current.set(field, element);
        } else {
          elements.current.delete(field);
        }
      },
    }),
    insert: (token: string) => {
      const field = active.current;
      const element = elements.current.get(field);
      const next = insertAtCursor(
        read(field),
        element?.selectionStart,
        element?.selectionEnd,
        token
      );
      if (next.value.length > max[field]) {
        return;
      }
      caret.current = { at: next.caret, field };
      write(field, next.value);
    },
  };
}

interface PlaceholderButtonsProps {
  /** The details this big event has (no bus details without Travel). */
  keys: readonly Placeholder[];
  /** The language of the fields: tokens are written in it. */
  language: MessageLocale;
  onInsert: (token: string) => void;
}

export function PlaceholderButtons({
  keys,
  language,
  onInsert,
}: PlaceholderButtonsProps) {
  const t = useTranslations("adminPortal.bigEvents.messages.placeholders");
  if (keys.length === 0) {
    return null;
  }
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className={`${LABEL_CLASS} mb-2`}>{t("label")}</legend>
      <div className="flex flex-wrap gap-1.5">
        {keys.map((key) => (
          <button
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs transition-colors"
            key={key}
            onClick={() => onInsert(placeholderToken(language, key))}
            // Keeps the field focused, so its caret stays where it was.
            onMouseDown={(event) => event.preventDefault()}
            style={{
              background: "rgba(255,255,255,0.7)",
              border: `0.5px solid ${STUDIO.rule2}`,
              color: STUDIO.ink2,
            }}
            type="button"
          >
            <Plus aria-hidden size={12} />
            {t(key)}
          </button>
        ))}
      </div>
      <p className="text-xs" style={{ color: STUDIO.ink4 }}>
        {t("help")}
      </p>
    </fieldset>
  );
}

"use client";

import { useTranslations } from "next-intl";
import { SERIF_STACK, STUDIO } from "../../../../_components/studio";
import type { MessagePreview } from "./use-message-preview";

/**
 * Who the message reaches and how (spec D6): "96 people: 81 get a push,
 * 15 get an email", the SMS count when SMS is on, and how many can't be
 * reached. Updates as the draft changes.
 */
export function ReachBox({ preview }: { preview: MessagePreview }) {
  const t = useTranslations("adminPortal.bigEvents.messages.reach");
  const te = useTranslations("adminPortal.bigEvents.messages.errors");
  const { answer } = preview;

  let main: string;
  const details: string[] = [];
  if (preview.idle) {
    main = t("incomplete");
  } else if (answer === null) {
    main = t("counting");
  } else if (answer.kind === "refused") {
    main = te(answer.error);
  } else if (answer.kind === "failed") {
    main = t("failed");
  } else if (answer.reach.people === 0) {
    main = t("nobody");
  } else {
    const { email, people, push, sms, unreachable } = answer.reach;
    main = t("summary", { email, people, push });
    if (sms > 0) {
      details.push(t("sms", { count: sms }));
    }
    if (unreachable > 0) {
      details.push(t("unreachable", { count: unreachable }));
    }
  }

  return (
    <output
      aria-busy={preview.pending}
      aria-live="polite"
      className="block rounded-xl px-4 py-3 text-sm leading-6 transition-opacity"
      style={{
        background: STUDIO.ink,
        color: STUDIO.paper,
        opacity: preview.pending && answer !== null ? 0.7 : 1,
      }}
    >
      <span
        className="block text-[22px] leading-tight"
        style={{ fontFamily: SERIF_STACK }}
      >
        {main}
      </span>
      {details.map((line) => (
        <span className="block" key={line}>
          {line}
        </span>
      ))}
    </output>
  );
}

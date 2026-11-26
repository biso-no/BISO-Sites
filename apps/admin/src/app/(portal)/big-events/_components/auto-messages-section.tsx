"use client";

import type { AutoMessageKind } from "@repo/shared/big-events/messages/auto";
import { PLACEHOLDERS } from "@repo/shared/big-events/messages/text";
import { useTranslations } from "next-intl";
import { useId } from "react";
import {
  type AutoTextsForm,
  isDefaultKind,
  resetKind,
} from "@/lib/big-events/auto-message-texts";
import type { MessageLocale } from "@/lib/big-events/messages/draft";
import { PortalButton } from "../../_components/portal-button";
import { SERIF_STACK, STUDIO } from "../../_components/studio";
import { MessageFields } from "../[id]/messages/_components/message-fields";
import { SwitchRow } from "./switch-row";

export type AutoSwitch =
  | "auto_bus_assigned"
  | "auto_bus_moved"
  | "auto_departure_reminder";

const LOCALES: readonly MessageLocale[] = ["no", "en"];

/**
 * Each switch with the texts it sends. "No bus seat" sits with Bus changes:
 * losing a seat after a notice is a change (ruling R16).
 */
const GROUPS: readonly {
  help: string;
  kinds: readonly AutoMessageKind[];
  label: string;
  setting: AutoSwitch;
}[] = [
  {
    help: "assignedHelp",
    kinds: ["bus_assigned"],
    label: "assigned",
    setting: "auto_bus_assigned",
  },
  {
    help: "movedHelp",
    kinds: ["bus_moved", "bus_none"],
    label: "moved",
    setting: "auto_bus_moved",
  },
  {
    help: "reminderHelp",
    kinds: ["departure_reminder"],
    label: "reminder",
    setting: "auto_departure_reminder",
  },
];

interface AutoMessagesSectionProps {
  defaults: AutoTextsForm;
  /** Why the texts can't be saved, as a sentence. */
  error?: string;
  onSwitch: (setting: AutoSwitch, value: boolean) => void;
  onTexts: (texts: AutoTextsForm) => void;
  switches: Record<AutoSwitch, boolean>;
  texts: AutoTextsForm;
  /** Automatic messages are sent only while Travel is on (ruling R20). */
  travel: boolean;
}

/**
 * Automatic messages in the big event's settings (spec D7, plan M9): three
 * switches, and each message's text in both languages with "Reset to
 * default".
 */
export function AutoMessagesSection({
  defaults,
  error,
  onSwitch,
  onTexts,
  switches,
  texts,
  travel,
}: AutoMessagesSectionProps) {
  const t = useTranslations("adminPortal.bigEvents.messages.auto");
  const id = useId();

  function setText(
    kind: AutoMessageKind,
    locale: MessageLocale,
    field: "body" | "title",
    value: string
  ) {
    onTexts({
      ...texts,
      [kind]: {
        ...texts[kind],
        [locale]: { ...texts[kind][locale], [field]: value },
      },
    });
  }

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="flex flex-col gap-4 border-t pt-5"
      style={{ borderColor: STUDIO.rule }}
    >
      <div>
        <h2
          className="text-[22px] leading-tight"
          id={`${id}-title`}
          style={{ color: STUDIO.ink, fontFamily: SERIF_STACK }}
        >
          {t("title")}
        </h2>
        <p className="mt-1 text-sm" style={{ color: STUDIO.ink3 }}>
          {travel ? t("help") : t("travelOff")}
        </p>
      </div>
      {GROUPS.map((group) => (
        <div className="flex flex-col gap-2" key={group.setting}>
          <SwitchRow
            checked={switches[group.setting]}
            help={t(group.help)}
            id={`${id}-${group.setting}`}
            label={t(group.label)}
            onChange={(value) => onSwitch(group.setting, value)}
          />
          {group.kinds.map((kind) => {
            const own = !isDefaultKind(texts, defaults, kind);
            return (
              <details
                className="rounded-xl px-4 py-3"
                key={kind}
                style={{ border: `0.5px solid ${STUDIO.rule}` }}
              >
                <summary
                  className="cursor-pointer font-medium text-sm"
                  style={{ color: STUDIO.ink2 }}
                >
                  {t(`kinds.${kind}`)}
                  {own && (
                    <span
                      className="ml-2 rounded-full px-2 py-0.5 text-[11px]"
                      style={{ background: STUDIO.paper3, color: STUDIO.ink2 }}
                    >
                      {t("own")}
                    </span>
                  )}
                </summary>
                <div className="mt-3 grid gap-5 md:grid-cols-2">
                  {LOCALES.map((locale) => (
                    <MessageFields
                      defaults={defaults[kind][locale]}
                      key={locale}
                      language={locale}
                      onChange={(field, value) =>
                        setText(kind, locale, field, value)
                      }
                      placeholders={PLACEHOLDERS}
                      value={texts[kind][locale]}
                    />
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs" style={{ color: STUDIO.ink4 }}>
                    {t("defaultHint")}
                  </p>
                  <PortalButton
                    disabled={!own}
                    onClick={() => onTexts(resetKind(texts, defaults, kind))}
                    size="sm"
                  >
                    {t("reset")}
                  </PortalButton>
                </div>
              </details>
            );
          })}
        </div>
      ))}
      {error && (
        <p className="text-sm" role="alert" style={{ color: STUDIO.claret }}>
          {error}
        </p>
      )}
    </section>
  );
}

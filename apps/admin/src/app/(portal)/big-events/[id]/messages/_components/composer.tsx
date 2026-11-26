"use client";

import type { Placeholder } from "@repo/shared/big-events/messages/text";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import type { MessageLocale } from "@/lib/big-events/messages/draft";
import { PortalButton } from "../../../../_components/portal-button";
import { STUDIO } from "../../../../_components/studio";
import { AudiencePicker, type CampusOption } from "./audience-picker";
import { CheckStep } from "./check-step";
import {
  COMPOSER_STEPS,
  type ComposerState,
  type ComposerStep,
  choosesBus,
  draftOf,
  emptyComposer,
  hasText,
  type MessageGroupOption,
  type MessagePersonOption,
  showsLeg,
  type TextField,
} from "./composer-state";
import { MessageStep } from "./message-step";
import { ReachBox } from "./reach-box";
import { useMessagePreview } from "./use-message-preview";

export interface ComposerProps {
  bigEventId: string;
  campuses: CampusOption[];
  everyoneHelp: string;
  groups: MessageGroupOption[];
  /** After a message is sent or planned: the history is loaded again. */
  onSent: () => void;
  people: MessagePersonOption[];
  /** The detail buttons this big event offers. */
  placeholders: readonly Placeholder[];
  smsEnabled: boolean;
  /** Travel is on: buses exist and the trip can be chosen. */
  travel: boolean;
}

/** The composer: Message · Who · Check & send (spec D6). */
export function Composer({
  bigEventId,
  campuses,
  everyoneHelp,
  groups,
  onSent,
  people,
  placeholders,
  smsEnabled,
  travel,
}: ComposerProps) {
  const t = useTranslations("adminPortal.bigEvents.messages");
  const locale: MessageLocale = useLocale() === "no" ? "no" : "en";
  const [step, setStep] = useState<ComposerStep>("message");
  const [state, setState] = useState<ComposerState>(emptyComposer);
  const busIds = useMemo(
    () =>
      new Set(
        groups.filter((group) => group.kind === "bus").map((group) => group.id)
      ),
    [groups]
  );

  const draft = draftOf(state, { busIds, travel });
  const preview = useMessagePreview(
    bigEventId,
    step === "message" ? null : draft
  );
  const written = hasText(state.texts, locale);
  const open: Record<ComposerStep, boolean> = {
    check: written && draft !== null,
    message: true,
    who: written,
  };
  let legReason: "bus" | "details" | null = null;
  if (showsLeg(state, busIds, travel)) {
    legReason = choosesBus(state, busIds) ? "bus" : "details";
  }

  const patch = (next: Partial<ComposerState>) =>
    setState((previous) => ({ ...previous, ...next }));
  const setText = (language: MessageLocale, field: TextField, value: string) =>
    setState((previous) => ({
      ...previous,
      texts: {
        ...previous.texts,
        [field]: { ...previous.texts[field], [language]: value },
      },
    }));

  function handleSent() {
    setState(emptyComposer());
    setStep("message");
    onSent();
  }

  return (
    <div className="flex flex-col gap-5">
      <nav aria-label={t("steps.label")}>
        <ol className="flex flex-wrap items-center gap-1.5 text-sm">
          {COMPOSER_STEPS.map((each, index) => {
            const current = each === step;
            return (
              <li className="flex items-center gap-1.5" key={each}>
                {index > 0 && (
                  <span aria-hidden style={{ color: STUDIO.ink4 }}>
                    ·
                  </span>
                )}
                <button
                  aria-current={current ? "step" : undefined}
                  className="rounded-full px-3 py-1 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={!open[each]}
                  onClick={() => setStep(each)}
                  style={{
                    background: current ? STUDIO.ink : "transparent",
                    color: current ? STUDIO.paper : STUDIO.ink2,
                  }}
                  type="button"
                >
                  {index + 1}. {t(`steps.${each}`)}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {step === "message" && (
        <>
          <MessageStep
            locale={locale}
            onChange={patch}
            onTextChange={setText}
            placeholders={placeholders}
            smsEnabled={smsEnabled}
            state={state}
          />
          <StepFooter
            hint={written ? null : t("write.needText")}
            onNext={() => setStep("who")}
          />
        </>
      )}

      {step === "who" && (
        <>
          <AudiencePicker
            campuses={campuses}
            everyoneHelp={everyoneHelp}
            groups={groups}
            legReason={legReason}
            onChange={patch}
            people={people}
            state={state}
          />
          <ReachBox preview={preview} />
          <StepFooter
            hint={draft ? null : t("who.needAudience")}
            onBack={() => setStep("message")}
            onNext={() => setStep("check")}
          />
        </>
      )}

      {step === "check" && draft && (
        <CheckStep
          bigEventId={bigEventId}
          draft={draft}
          locale={locale}
          onBack={() => setStep("who")}
          onSent={handleSent}
          onTextChange={setText}
          placeholders={placeholders}
          preview={preview}
          texts={state.texts}
        />
      )}
    </div>
  );
}

/** Back and Next; Next waits for the step to be done, saying what's missing. */
function StepFooter({
  hint,
  onBack,
  onNext,
}: {
  hint: string | null;
  onBack?: () => void;
  onNext: () => void;
}) {
  const t = useTranslations("adminPortal.bigEvents.messages.steps");
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 border-t pt-5"
      style={{ borderColor: STUDIO.rule }}
    >
      <div>
        {onBack && (
          <PortalButton onClick={onBack} variant="ghost">
            {t("back")}
          </PortalButton>
        )}
      </div>
      <div className="flex items-center gap-3">
        {hint && (
          <p className="text-sm" style={{ color: STUDIO.ink3 }}>
            {hint}
          </p>
        )}
        <PortalButton
          disabled={hint !== null}
          onClick={onNext}
          variant="primary"
        >
          {t("next")}
        </PortalButton>
      </div>
    </div>
  );
}

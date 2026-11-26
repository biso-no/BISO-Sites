"use client";

import type { GroupLeg } from "@repo/shared/big-events/tables";
import { useTranslations } from "next-intl";
import { STUDIO } from "../../../../_components/studio";
import {
  type AudienceType,
  type ComposerState,
  type MessageGroupOption,
  type MessagePersonOption,
  toggleCapped,
} from "./composer-state";
import { GroupChooser } from "./group-chooser";
import { PeoplePicker } from "./people-picker";
import { LABEL_CLASS, Pill } from "./ui";

const LEGS: readonly GroupLeg[] = ["out", "home"];
const CARDS: readonly AudienceType[] = [
  "everyone",
  "campus",
  "groups",
  "people",
];
const LEG_LABEL = { home: "legHome", out: "legOut" } as const;

export interface CampusOption {
  id: string;
  label: string;
}

interface AudiencePickerProps {
  /** The campuses the caller may send to that have people here. */
  campuses: CampusOption[];
  /** The Everyone card's line: the whole big event, or the caller's campus. */
  everyoneHelp: string;
  /** Buses (while Travel is on), rooms and groups the caller may manage. */
  groups: MessageGroupOption[];
  /** Why the trip is asked: a bus is chosen, or the text names bus details. */
  legReason: "bus" | "details" | null;
  onChange: (patch: Partial<ComposerState>) => void;
  people: MessagePersonOption[];
  state: ComposerState;
}

/**
 * Who (spec D6): Everyone · Campus · Buses, rooms and groups · Chosen
 * people, each card keeping its own choice; the way out / way home choice
 * for buses and bus details (ruling R8). Campus admins are only offered
 * their campus's people and groups (the actions return nothing else).
 */
export function AudiencePicker({
  campuses,
  everyoneHelp,
  groups,
  legReason,
  onChange,
  people,
  state,
}: AudiencePickerProps) {
  const t = useTranslations("adminPortal.bigEvents.messages.who");
  const tb = useTranslations("adminPortal.bigEvents");
  const help: Record<AudienceType, string> = {
    campus: t("campusHelp"),
    everyone: everyoneHelp,
    groups: t("groupsHelp"),
    people: t("peopleHelp"),
  };

  function choose(type: AudienceType) {
    const onlyCampus = campuses.length === 1 ? campuses[0]?.id : undefined;
    onChange({
      audienceType: type,
      // One campus to pick from: it is the choice.
      ...(type === "campus" && state.campusIds.length === 0 && onlyCampus
        ? { campusIds: [onlyCampus] }
        : {}),
    });
  }

  const campusLabel = (campusId: string | null) =>
    campusId ? tb(`campuses.${campusId}`) : null;

  return (
    <div className="flex flex-col gap-5">
      <fieldset>
        <legend className={`${LABEL_CLASS} mb-2`}>{t("legend")}</legend>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {CARDS.map((type) => {
            const active = state.audienceType === type;
            return (
              <button
                aria-pressed={active}
                className="flex flex-col gap-0.5 rounded-xl px-4 py-3 text-left transition-colors"
                key={type}
                onClick={() => choose(type)}
                style={{
                  background: active ? STUDIO.ink : "rgba(255,255,255,0.6)",
                  border: `0.5px solid ${active ? STUDIO.ink : STUDIO.rule2}`,
                  color: active ? STUDIO.paper : STUDIO.ink,
                }}
                type="button"
              >
                <span className="font-medium text-sm">{t(type)}</span>
                <span className="text-xs opacity-75">{help[type]}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {state.audienceType === "campus" && (
        <fieldset>
          <legend className={`${LABEL_CLASS} mb-2`}>{t("campuses")}</legend>
          {campuses.length === 0 ? (
            <p className="text-sm" style={{ color: STUDIO.ink3 }}>
              {t("noCampuses")}
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {campuses.map((campus) => (
                <Pill
                  active={state.campusIds.includes(campus.id)}
                  key={campus.id}
                  onClick={() =>
                    onChange({
                      campusIds: toggleCapped(state.campusIds, campus.id),
                    })
                  }
                >
                  {campus.label}
                </Pill>
              ))}
            </div>
          )}
        </fieldset>
      )}

      {state.audienceType === "groups" && (
        <GroupChooser
          campusLabel={campusLabel}
          chosen={state.groupIds}
          groups={groups}
          onChange={(groupIds) => onChange({ groupIds })}
        />
      )}

      {state.audienceType === "people" && (
        <PeoplePicker
          campusLabel={campusLabel}
          chosen={state.participantIds}
          onChange={(participantIds) => onChange({ participantIds })}
          people={people}
        />
      )}

      {legReason && (
        <fieldset>
          <legend className={`${LABEL_CLASS} mb-2`}>{t("leg")}</legend>
          <div className="flex gap-1.5">
            {LEGS.map((leg) => (
              <Pill
                active={state.leg === leg}
                key={leg}
                onClick={() => onChange({ leg })}
              >
                {t(LEG_LABEL[leg])}
              </Pill>
            ))}
          </div>
          <p className="mt-1.5 text-xs" style={{ color: STUDIO.ink4 }}>
            {t(legReason === "bus" ? "legHelpBus" : "legHelpDetails")}
          </p>
        </fieldset>
      )}
    </div>
  );
}

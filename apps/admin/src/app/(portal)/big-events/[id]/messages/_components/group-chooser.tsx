"use client";

import { GROUP_KINDS } from "@repo/shared/big-events/tables";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { AUDIENCE_IDS_MAX } from "@/lib/big-events/messages/draft";
import { STUDIO } from "../../../../_components/studio";
import { type MessageGroupOption, toggleCapped } from "./composer-state";
import { FIELD_CLASS, LABEL_CLASS, Pill } from "./ui";

/** Past this many groups, a name filter helps. */
const FILTER_FROM = 15;

/**
 * Buses, rooms and groups to send to, by kind, with a name filter once there
 * are many; at most 100 (they must fit one message).
 */
export function GroupChooser({
  campusLabel,
  chosen,
  groups,
  onChange,
}: {
  campusLabel: (campusId: string | null) => string | null;
  chosen: string[];
  groups: MessageGroupOption[];
  onChange: (groupIds: string[]) => void;
}) {
  const t = useTranslations("adminPortal.bigEvents.messages.who");
  const tg = useTranslations("adminPortal.bigEvents.groups");
  const id = useId();
  const [filter, setFilter] = useState("");
  if (groups.length === 0) {
    return (
      <p className="text-sm" style={{ color: STUDIO.ink3 }}>
        {t("noGroups")}
      </p>
    );
  }
  const manyCampuses = new Set(groups.map((group) => group.campusId)).size > 1;
  const needle = filter.trim().toLowerCase();
  const shown = groups.filter(
    (group) =>
      chosen.includes(group.id) || group.name.toLowerCase().includes(needle)
  );
  const full = chosen.length >= AUDIENCE_IDS_MAX;

  return (
    <div className="flex flex-col gap-3">
      {groups.length > FILTER_FROM && (
        <div className="flex max-w-sm flex-col gap-1.5">
          <label className={LABEL_CLASS} htmlFor={`${id}-filter`}>
            {t("findGroup")}
          </label>
          <input
            autoComplete="off"
            className={FIELD_CLASS}
            id={`${id}-filter`}
            onChange={(event) => setFilter(event.target.value)}
            type="search"
            value={filter}
          />
        </div>
      )}
      {shown.length === 0 && (
        <p className="text-sm" style={{ color: STUDIO.ink3 }}>
          {t("noGroupMatch")}
        </p>
      )}
      {GROUP_KINDS.map((kind) => {
        const ofKind = shown.filter((group) => group.kind === kind);
        if (ofKind.length === 0) {
          return null;
        }
        return (
          <fieldset key={kind}>
            <legend className={`${LABEL_CLASS} mb-1.5`}>
              {tg(`sections.${kind}`)}
            </legend>
            <div className="flex flex-wrap gap-1.5">
              {ofKind.map((group) => {
                const active = chosen.includes(group.id);
                const campus = manyCampuses
                  ? campusLabel(group.campusId)
                  : null;
                return (
                  <Pill
                    active={active}
                    disabled={full && !active}
                    key={group.id}
                    onClick={() => onChange(toggleCapped(chosen, group.id))}
                  >
                    {campus ? `${group.name} · ${campus}` : group.name}
                  </Pill>
                );
              })}
            </div>
          </fieldset>
        );
      })}
      {full && (
        <p className="text-sm" style={{ color: STUDIO.claret }}>
          {t("groupCap", { max: AUDIENCE_IDS_MAX })}
        </p>
      )}
    </div>
  );
}

"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useMemo, useState } from "react";
import { AUDIENCE_IDS_MAX } from "@/lib/big-events/messages/draft";
import { STUDIO } from "../../../../_components/studio";
import { addCapped, type MessagePersonOption } from "./composer-state";
import { FIELD_CLASS, LABEL_CLASS } from "./ui";

/** Most matches shown at once; typing more narrows them. */
const MATCHES_SHOWN = 8;
const DIACRITICS = /\p{Diacritic}/gu;
const SPACES = /\s+/;

const fold = (text: string): string =>
  text.normalize("NFD").replace(DIACRITICS, "").toLowerCase();

/** Every word typed appears in the name, ignoring case and accents. */
export function matchesName(name: string, query: string): boolean {
  const folded = fold(name);
  return fold(query)
    .split(SPACES)
    .filter(Boolean)
    .every((word) => folded.includes(word));
}

interface PeoplePickerProps {
  /** The campus shown next to a name, or null. */
  campusLabel: (campusId: string | null) => string | null;
  chosen: string[];
  onChange: (ids: string[]) => void;
  /** The participants the caller may see (campus admins: their campus). */
  people: MessagePersonOption[];
}

/** Chosen people: search the big event's participants by name, at most 100. */
export function PeoplePicker({
  campusLabel,
  chosen,
  onChange,
  people,
}: PeoplePickerProps) {
  const t = useTranslations("adminPortal.bigEvents.messages.who");
  const id = useId();
  const [query, setQuery] = useState("");
  const byId = useMemo(
    () => new Map(people.map((person) => [person.id, person])),
    [people]
  );
  const full = chosen.length >= AUDIENCE_IDS_MAX;
  const searching = query.trim() !== "";
  const matches = searching
    ? people
        .filter(
          (person) =>
            !chosen.includes(person.id) && matchesName(person.name, query)
        )
        .slice(0, MATCHES_SHOWN)
    : [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label className={LABEL_CLASS} htmlFor={`${id}-search`}>
          {t("search")}
        </label>
        <input
          autoComplete="off"
          className={FIELD_CLASS}
          id={`${id}-search`}
          onChange={(event) => setQuery(event.target.value)}
          type="search"
          value={query}
        />
      </div>
      {searching && matches.length === 0 && (
        <p className="text-sm" style={{ color: STUDIO.ink3 }}>
          {t("noMatch")}
        </p>
      )}
      {matches.length > 0 && (
        <ul className="flex flex-col gap-1">
          {matches.map((person) => (
            <li key={person.id}>
              <button
                aria-label={t("add", { name: person.name })}
                className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                disabled={full}
                onClick={() => onChange(addCapped(chosen, person.id))}
                style={{ border: `0.5px solid ${STUDIO.rule}` }}
                type="button"
              >
                <span style={{ color: STUDIO.ink }}>{person.name}</span>
                <span className="text-xs" style={{ color: STUDIO.ink4 }}>
                  {campusLabel(person.campusId)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="font-medium text-sm" style={{ color: STUDIO.ink2 }}>
        {t("chosen", { count: chosen.length })}
      </p>
      {full && (
        <p className="text-sm" style={{ color: STUDIO.claret }}>
          {t("peopleCap", { max: AUDIENCE_IDS_MAX })}
        </p>
      )}
      {chosen.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {chosen.map((personId) => {
            const name = byId.get(personId)?.name ?? "";
            return (
              <li
                className="inline-flex items-center gap-1 rounded-full py-1 pr-1 pl-3 text-[13px]"
                key={personId}
                style={{
                  background: STUDIO.paper2,
                  border: `0.5px solid ${STUDIO.rule2}`,
                  color: STUDIO.ink,
                }}
              >
                {name}
                <button
                  aria-label={t("remove", { name })}
                  className="rounded-full p-0.5 hover:bg-white"
                  onClick={() =>
                    onChange(chosen.filter((each) => each !== personId))
                  }
                  type="button"
                >
                  <X aria-hidden size={12} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

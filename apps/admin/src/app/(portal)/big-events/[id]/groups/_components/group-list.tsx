"use client";

import type { GroupKind } from "@repo/shared/big-events/tables";
import { Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { Leg } from "@/lib/big-events/buses/seats";
import type {
  GroupMemberView,
  GroupView,
} from "../../../../_actions/big-event-groups";
import { STUDIO, studioSurface } from "../../../../_components/studio";
import { MoveMenu, moveTargets } from "./move-menu";

type Translate = ReturnType<typeof useTranslations>;

interface GroupListProps {
  bigEventId: string;
  campusLabel: (campusId: string | null) => string;
  /** The groups of this kind, in the order the server sorted them. */
  groups: GroupView[];
  kind: GroupKind;
  onDelete: (group: GroupView) => void;
  onEdit: (group: GroupView) => void;
}

/** Each person once, with the legs they ride (buses list a row per leg). */
function peopleOnce(
  members: GroupMemberView[]
): { legs: Set<Leg>; member: GroupMemberView }[] {
  const byPerson = new Map<
    string,
    { legs: Set<Leg>; member: GroupMemberView }
  >();
  for (const member of members) {
    const entry = byPerson.get(member.participantId) ?? {
      legs: new Set<Leg>(),
      member,
    };
    if (member.leg) {
      entry.legs.add(member.leg);
    }
    byPerson.set(member.participantId, entry);
  }
  return [...byPerson.values()];
}

/**
 * "3 of 4" and the like. A room counts from its open places, because
 * `members` holds only the people the caller may see; other groups count
 * the people shown.
 */
function capacityFacts(group: GroupView, t: Translate): string[] {
  const { capacity, openPlaces, seats } = group;
  if (group.kind === "bus") {
    if (!seats) {
      return [];
    }
    return [
      capacity === null
        ? t("seats", { home: seats.home, out: seats.out })
        : t("seatsOf", { capacity, home: seats.home, out: seats.out }),
    ];
  }
  if (capacity === null) {
    return [];
  }
  const shown = peopleOnce(group.members).length;
  if (openPlaces === null) {
    return [t("taken", { capacity, taken: shown })];
  }
  const taken = Math.max(capacity - openPlaces, shown);
  return [
    t("taken", { capacity, taken }),
    t("openPlaces", { count: openPlaces }),
  ];
}

function IconButton({
  children,
  label,
  onClick,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className="rounded-md p-1.5 transition-colors hover:bg-black/5"
      onClick={onClick}
      style={{ color: STUDIO.ink3 }}
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}

interface GroupCardProps extends Omit<GroupListProps, "kind"> {
  group: GroupView;
}

function GroupCard({
  bigEventId,
  campusLabel,
  group,
  groups,
  onDelete,
  onEdit,
}: GroupCardProps) {
  const t = useTranslations("adminPortal.bigEvents.groups");
  const isBus = group.kind === "bus";
  const facts = [
    campusLabel(group.campus_id),
    ...capacityFacts(group, t),
    group.room_number ? t("roomNumber", { number: group.room_number }) : null,
    group.contact_name ? t("contact", { name: group.contact_name }) : null,
  ].filter((fact): fact is string => Boolean(fact));
  const people = peopleOnce(group.members);

  return (
    <article className="flex flex-col rounded-2xl p-4" style={studioSurface}>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3
            className="break-words font-medium text-[15px]"
            style={{ color: STUDIO.ink }}
          >
            {group.name}
          </h3>
          <p className="mt-0.5 text-xs" style={{ color: STUDIO.ink3 }}>
            {facts.join(" · ")}
          </p>
        </div>
        <div className="-mt-1 -mr-1.5 flex shrink-0">
          <IconButton
            label={t("editGroup", { name: group.name })}
            onClick={() => onEdit(group)}
          >
            <Pencil aria-hidden size={15} />
          </IconButton>
          <IconButton
            label={t("deleteGroup", { name: group.name })}
            onClick={() => onDelete(group)}
          >
            <Trash2 aria-hidden size={15} />
          </IconButton>
        </div>
      </header>
      {group.note && (
        <p
          className="mt-2 whitespace-pre-line break-words text-xs leading-5"
          style={{ color: STUDIO.ink2 }}
        >
          {group.note}
        </p>
      )}
      {people.length === 0 ? (
        <p className="mt-3 text-xs" style={{ color: STUDIO.ink4 }}>
          {t("nobody")}
        </p>
      ) : (
        <ul
          className="mt-3 flex flex-col border-t pt-2 text-sm"
          style={{ borderColor: STUDIO.rule }}
        >
          {people.map(({ legs, member }) => (
            <li
              className="flex min-h-8 items-center justify-between gap-2"
              key={member.participantId}
              style={{ color: STUDIO.ink2 }}
            >
              <span className="min-w-0 break-words">
                {member.name}
                {isBus && legs.size === 1 && (
                  <span className="ml-2 text-xs" style={{ color: STUDIO.ink4 }}>
                    {legs.has("out") ? t("onlyOut") : t("onlyHome")}
                  </span>
                )}
              </span>
              {!isBus && (
                <MoveMenu
                  bigEventId={bigEventId}
                  campusLabel={campusLabel}
                  from={group}
                  person={member}
                  targets={moveTargets(groups, group, member)}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

/**
 * The groups of one kind with the people in them. Also the Buses section's
 * plain list until the bus board takes that slot (ruling R1).
 */
export function GroupList({ groups, kind, ...props }: GroupListProps) {
  const t = useTranslations("adminPortal.bigEvents.groups");
  if (groups.length === 0) {
    return (
      <p className="text-sm" style={{ color: STUDIO.ink4 }}>
        {t(`empty.${kind}`)}
      </p>
    );
  }
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {groups.map((group) => (
        <GroupCard group={group} groups={groups} key={group.$id} {...props} />
      ))}
    </div>
  );
}

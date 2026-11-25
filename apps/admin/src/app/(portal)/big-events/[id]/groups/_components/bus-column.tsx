"use client";

import { useDroppable } from "@dnd-kit/core";
import { AlertTriangle, Pencil, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { formatOsloShortDay, splitOsloDateTime } from "@/lib/big-events/dates";
import type { GroupView } from "../../../../_actions/big-event-groups";
import { STUDIO, studioSurface } from "../../../../_components/studio";
import type { BoardChip, BoardColumn } from "./bus-board-model";
import { useGroupActions } from "./groups-view";
import { PersonChip } from "./person-chip";

/** Amber: more people than seats, a warning only (D5). */
const WARNING = "#9a5b13";
const WARNING_SURFACE = {
  background: "rgba(176,138,62,0.10)",
  border: "0.5px solid rgba(154,91,19,0.45)",
} as const;

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

/** "Leaves 24 Jan 08:30 · Main entrance": when and where the bus goes out. */
function departure(
  bus: GroupView,
  locale: string,
  leaves: (when: string) => string
): string | null {
  const when = bus.out_departs_at
    ? `${formatOsloShortDay(bus.out_departs_at, locale)} ${splitOsloDateTime(bus.out_departs_at).time}`.trim()
    : "";
  const parts = [when ? leaves(when) : null, bus.out_meeting_point];
  const shown = parts.filter((part): part is string => Boolean(part));
  return shown.length > 0 ? shown.join(" · ") : null;
}

function BusHeader({ bus, over }: { bus: GroupView; over: boolean }) {
  const t = useTranslations("adminPortal.bigEvents.buses");
  const tg = useTranslations("adminPortal.bigEvents.groups");
  const locale = useLocale();
  const actions = useGroupActions();
  const seats = bus.seats ?? { home: 0, out: 0 };
  const where = departure(bus, locale, (when) => t("leaves", { when }));
  return (
    <header className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <h3
          className="break-words font-medium text-[15px]"
          style={{ color: STUDIO.ink }}
        >
          {bus.name}
        </h3>
        {where && (
          <p className="mt-0.5 text-xs" style={{ color: STUDIO.ink3 }}>
            {where}
          </p>
        )}
        <p
          className="mt-1 font-medium text-xs"
          data-over={over ? "true" : undefined}
          style={{ color: over ? WARNING : STUDIO.ink2 }}
        >
          {bus.capacity === null
            ? t("seats", { home: seats.home, out: seats.out })
            : t("seatsOf", { ...seats, capacity: bus.capacity })}
        </p>
        {over && (
          <p
            className="mt-0.5 flex items-center gap-1 text-xs"
            style={{ color: WARNING }}
          >
            <AlertTriangle aria-hidden size={12} />
            {t("overCapacity")}
          </p>
        )}
      </div>
      <div className="-mt-1 -mr-1.5 flex shrink-0">
        <IconButton
          label={tg("editGroup", { name: bus.name })}
          onClick={() => actions.edit(bus)}
        >
          <Pencil aria-hidden size={15} />
        </IconButton>
        <IconButton
          label={tg("deleteGroup", { name: bus.name })}
          onClick={() => actions.remove(bus)}
        >
          <Trash2 aria-hidden size={15} />
        </IconButton>
      </div>
    </header>
  );
}

interface BusColumnProps {
  column: BoardColumn;
  /** A move is being saved. */
  disabled: boolean;
  onToggle: (participantId: string) => void;
  onUnpin: (chip: BoardChip) => void;
  selection: ReadonlySet<string>;
}

/**
 * A bus with its people, or "Not on a bus yet". People can be dropped on
 * it; over capacity it turns amber but still takes them (D5).
 */
export function BusColumn({
  column,
  disabled,
  onToggle,
  onUnpin,
  selection,
}: BusColumnProps) {
  const t = useTranslations("adminPortal.bigEvents.buses");
  const { isOver, setNodeRef } = useDroppable({ id: column.id });
  const { bus } = column;
  const over = column.over.length > 0;
  const heading = bus
    ? undefined
    : t("notOnBus", { count: column.people.length });

  return (
    <section
      aria-label={bus?.name ?? heading}
      className="flex min-w-0 flex-col rounded-2xl p-3"
      data-column={column.id}
      ref={setNodeRef}
      style={{
        ...studioSurface,
        ...(over ? WARNING_SURFACE : {}),
        ...(isOver ? { border: `1px solid ${STUDIO.claret}` } : {}),
        ...(bus ? {} : { background: STUDIO.paper2 }),
      }}
    >
      {bus ? (
        <BusHeader bus={bus} over={over} />
      ) : (
        <h3 className="font-medium text-[15px]" style={{ color: STUDIO.ink }}>
          {heading}
        </h3>
      )}
      {column.people.length === 0 ? (
        <p className="mt-3 text-xs leading-5" style={{ color: STUDIO.ink4 }}>
          {bus ? t("emptyBus") : t("everyoneSeated")}
        </p>
      ) : (
        <ul className="mt-3 flex max-h-[28rem] flex-col gap-1.5 overflow-y-auto">
          {column.people.map((chip) => (
            <PersonChip
              chip={chip}
              disabled={disabled}
              key={chip.participantId}
              onToggle={onToggle}
              onUnpin={onUnpin}
              selected={selection.has(chip.participantId)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

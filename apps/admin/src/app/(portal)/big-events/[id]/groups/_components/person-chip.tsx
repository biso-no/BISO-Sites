"use client";

import { useDraggable } from "@dnd-kit/core";
import { GripVertical, Pin } from "lucide-react";
import { useTranslations } from "next-intl";
import { STUDIO } from "../../../../_components/studio";
import type { BoardChip } from "./bus-board-model";

interface ChipBodyProps {
  chip: BoardChip;
}

/** Name, room and the way home: what a chip and its drag preview show. */
function ChipBody({ chip }: ChipBodyProps) {
  const t = useTranslations("adminPortal.bigEvents.buses");
  const tp = useTranslations("adminPortal.bigEvents.participants");
  const facts = [
    chip.roomName ? tp("roomName", { name: chip.roomName }) : null,
    chip.homeBus ? t("homeBus", { bus: chip.homeBus }) : null,
    chip.onlyLeg === "out" ? t("onlyOut") : null,
    chip.onlyLeg === "home" ? t("onlyHome") : null,
  ].filter((fact): fact is string => fact !== null);
  return (
    <span className="min-w-0 flex-1">
      <span className="block break-words text-sm" style={{ color: STUDIO.ink }}>
        {chip.name}
      </span>
      {facts.length > 0 && (
        <span
          className="block break-words text-[11px] leading-4"
          style={{ color: STUDIO.ink3 }}
        >
          {facts.join(" · ")}
        </span>
      )}
    </span>
  );
}

const CHIP_SURFACE = {
  background: STUDIO.white,
  border: `0.5px solid ${STUDIO.rule2}`,
} as const;

/** What follows the pointer while dragging: the person, or how many. */
export function ChipPreview({
  chip,
  count,
}: {
  chip: BoardChip;
  count: number;
}) {
  const t = useTranslations("adminPortal.bigEvents.buses");
  return (
    <div
      className="flex w-64 items-center gap-2 rounded-lg px-3 py-2 shadow-lg"
      style={CHIP_SURFACE}
    >
      {count > 1 ? (
        <span className="text-sm" style={{ color: STUDIO.ink }}>
          {t("people", { count })}
        </span>
      ) : (
        <ChipBody chip={chip} />
      )}
    </div>
  );
}

interface PersonChipProps {
  chip: BoardChip;
  /** Another move is being saved. */
  disabled: boolean;
  onToggle: (participantId: string) => void;
  onUnpin: (chip: BoardChip) => void;
  selected: boolean;
}

/**
 * One person on the bus board: a checkbox to select them, a handle to drag
 * them (pointer or keyboard), and a pin while they were placed by hand.
 */
export function PersonChip({
  chip,
  disabled,
  onToggle,
  onUnpin,
  selected,
}: PersonChipProps) {
  const t = useTranslations("adminPortal.bigEvents.buses");
  const { attributes, isDragging, listeners, setActivatorNodeRef, setNodeRef } =
    useDraggable({ disabled, id: chip.participantId });

  return (
    <li
      className="flex items-center gap-2 rounded-lg px-2 py-1.5"
      ref={setNodeRef}
      style={{
        ...CHIP_SURFACE,
        ...(selected ? { border: `0.5px solid ${STUDIO.claret}` } : {}),
        opacity: isDragging ? 0.4 : 1,
      }}
    >
      <input
        aria-label={t("select", { name: chip.name })}
        checked={selected}
        className="h-4 w-4 shrink-0 accent-[#6b1e1e]"
        onChange={() => onToggle(chip.participantId)}
        type="checkbox"
      />
      <button
        aria-label={t("dragHandle", { name: chip.name })}
        className="-mx-1 shrink-0 cursor-grab touch-none rounded p-0.5 hover:bg-black/5 active:cursor-grabbing"
        ref={setActivatorNodeRef}
        style={{ color: STUDIO.ink4 }}
        type="button"
        {...attributes}
        {...listeners}
      >
        <GripVertical aria-hidden size={14} />
      </button>
      <ChipBody chip={chip} />
      {chip.pinned && (
        <button
          aria-label={t("unpin", { name: chip.name })}
          className="shrink-0 rounded p-1 hover:bg-black/5 disabled:opacity-50"
          disabled={disabled}
          onClick={() => onUnpin(chip)}
          style={{ color: STUDIO.claret }}
          title={t("pinnedHint", { name: chip.name })}
          type="button"
        >
          <Pin aria-hidden size={13} />
        </button>
      )}
    </li>
  );
}

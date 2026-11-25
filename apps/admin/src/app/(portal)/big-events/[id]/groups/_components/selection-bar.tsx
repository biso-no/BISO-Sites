"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { useTranslations } from "next-intl";
import { type FormEvent, useState, useTransition } from "react";
import { BUS_LEGS, type BusLegs } from "@/lib/big-events/buses/hand-moves";
import type { GroupView } from "../../../../_actions/big-event-groups";
import { PortalButton } from "../../../../_components/portal-button";
import {
  PortalField,
  PortalSelect,
} from "../../../../_components/portal-fields";
import { SERIF_STACK, STUDIO } from "../../../../_components/studio";
import type { BoardChip } from "./bus-board-model";
import { TellCheckbox, useMoveConfirm } from "./move-confirm";
import type { BusMove } from "./use-bus-move";

interface MoveToDialogProps {
  buses: GroupView[];
  onOpenChange: (open: boolean) => void;
  onSave: (move: BusMove, notify: boolean) => Promise<void>;
  people: BoardChip[];
}

/**
 * "Move to…": a bus and which way, for everyone selected. After publishing
 * it carries the "Tell them about the change" box itself (D5).
 */
function MoveToDialog({
  buses,
  onOpenChange,
  onSave,
  people,
}: MoveToDialogProps) {
  const t = useTranslations("adminPortal.bigEvents.buses");
  const tc = useTranslations("adminPortal.common");
  const { published } = useMoveConfirm();
  const [busId, setBusId] = useState(buses[0]?.$id ?? "");
  const [legs, setLegs] = useState<BusLegs>("both");
  const [tell, setTell] = useState(true);
  const [isSaving, startSave] = useTransition();
  const names = people.map((person) => person.name);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!busId) {
      return;
    }
    startSave(async () => {
      await onSave({ busId, legs, people }, published && tell);
      onOpenChange(false);
    });
  }

  return (
    <Dialog onOpenChange={onOpenChange} open>
      <DialogContent
        className="border-[#e5dcca] bg-[#fffdf8] sm:max-w-md sm:rounded-2xl"
        style={{ color: STUDIO.ink }}
      >
        <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle
              className="break-words font-normal text-[26px] leading-tight"
              style={{ fontFamily: SERIF_STACK }}
            >
              {t("moveDialog.title", {
                count: people.length,
                name: names[0] ?? "",
              })}
            </DialogTitle>
            <DialogDescription style={{ color: STUDIO.ink3 }}>
              {t("moveDialog.description")}
            </DialogDescription>
          </DialogHeader>
          <PortalField label={t("moveDialog.bus")}>
            <PortalSelect
              aria-label={t("moveDialog.bus")}
              onChange={(e) => setBusId(e.target.value)}
              options={buses.map((bus) => ({
                label: bus.name,
                value: bus.$id,
              }))}
              value={busId}
            />
          </PortalField>
          <PortalField label={t("moveDialog.legs")}>
            <PortalSelect
              aria-label={t("moveDialog.legs")}
              onChange={(e) => setLegs(e.target.value as BusLegs)}
              options={BUS_LEGS.map((leg) => ({
                label: t(`legs.${leg}`),
                value: leg,
              }))}
              value={legs}
            />
          </PortalField>
          {published && (
            <TellCheckbox checked={tell} names={names} onChange={setTell} />
          )}
          <DialogFooter className="gap-2">
            <PortalButton
              disabled={isSaving}
              onClick={() => onOpenChange(false)}
              variant="ghost"
            >
              {tc("cancel")}
            </PortalButton>
            <PortalButton
              disabled={!busId}
              loading={isSaving}
              type="submit"
              variant="primary"
            >
              {t("moveDialog.move")}
            </PortalButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface SelectionBarProps {
  /** The buses of the campus shown. */
  buses: GroupView[];
  disabled: boolean;
  onClear: () => void;
  onSave: (move: BusMove, notify: boolean) => Promise<void>;
  /** Absent when nobody selected has a bus. */
  onTakeOff?: () => void;
  /** The people selected, as shown on the board. */
  people: BoardChip[];
}

/**
 * What can be done with the people selected: the way to do everything a
 * drag does without dragging.
 */
export function SelectionBar({
  buses,
  disabled,
  onClear,
  onSave,
  onTakeOff,
  people,
}: SelectionBarProps) {
  const t = useTranslations("adminPortal.bigEvents.buses.selection");
  const [isMoving, setMoving] = useState(false);
  if (people.length === 0) {
    return null;
  }
  return (
    <div
      className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-xl px-3 py-2"
      style={{
        background: STUDIO.white,
        border: `0.5px solid ${STUDIO.rule2}`,
        boxShadow: "0 4px 14px rgba(26,24,20,0.08)",
      }}
    >
      <span
        aria-live="polite"
        className="mr-auto font-medium text-sm"
        style={{ color: STUDIO.ink }}
      >
        {t("count", { count: people.length })}
      </span>
      <PortalButton
        disabled={disabled || buses.length === 0}
        onClick={() => setMoving(true)}
        size="sm"
        variant="primary"
      >
        {t("moveTo")}
      </PortalButton>
      <PortalButton
        disabled={disabled || !onTakeOff}
        onClick={onTakeOff}
        size="sm"
      >
        {t("takeOff")}
      </PortalButton>
      <PortalButton onClick={onClear} size="sm" variant="ghost">
        {t("clear")}
      </PortalButton>
      {isMoving && (
        <MoveToDialog
          buses={buses}
          onOpenChange={setMoving}
          onSave={onSave}
          people={people}
        />
      )}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { BusLegs } from "@/lib/big-events/buses/hand-moves";
import { moveToBus } from "../../../../_actions/big-event-buses";
import type { BoardChip } from "./bus-board-model";
import { useMoveConfirm } from "./move-confirm";

/** People onto a bus (or off every bus with `busId` null), on some legs. */
export interface BusMove {
  busId: string | null;
  legs: BusLegs;
  people: Pick<BoardChip, "name" | "participantId">[];
}

interface BusMoveApi {
  /** Saves, after publishing only once the organizer has confirmed (D5). */
  request: (move: BusMove) => void;
  /** Saves now; `notify` is "Tell them about the change". */
  save: (move: BusMove, notify: boolean) => Promise<void>;
}

/**
 * Moving people on the bus board. `busName` names a bus by id; `onMoved`
 * runs after a move was saved, e.g. to clear the selection.
 */
export function useBusMove(
  bigEventId: string,
  busName: (busId: string) => string,
  onMoved: () => void
): BusMoveApi {
  const t = useTranslations("adminPortal.bigEvents.buses");
  const tb = useTranslations("adminPortal.bigEvents");
  const router = useRouter();
  const { confirmMove } = useMoveConfirm();

  const save = async (move: BusMove, notify: boolean) => {
    const [first] = move.people;
    const facts = { count: move.people.length, name: first?.name ?? "" };
    try {
      await moveToBus(bigEventId, {
        busId: move.busId,
        legs: move.legs,
        notify,
        participantIds: move.people.map((person) => person.participantId),
      });
      toast.success(
        move.busId
          ? t("moved", { ...facts, bus: busName(move.busId) })
          : t("takenOff", facts)
      );
      onMoved();
      router.refresh();
    } catch {
      toast.error(tb("form.saveFailed"));
    }
  };

  const request = (move: BusMove) =>
    confirmMove({
      names: move.people.map((person) => person.name),
      run: (notify) => save(move, notify),
      summary: move.busId
        ? `${busName(move.busId)} · ${t(`legs.${move.legs}`)}`
        : t("selection.takeOff"),
    });

  return { request, save };
}

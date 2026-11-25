"use client";

import {
  type Announcements,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  type UniqueIdentifier,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useId, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { formatOsloShortDay } from "@/lib/big-events/dates";
import { NATIONAL_CAMPUS_ID } from "@/lib/event-scope";
import { setPinned } from "../../../../_actions/big-event-buses";
import { PortalButton } from "../../../../_components/portal-button";
import { PortalSelect } from "../../../../_components/portal-fields";
import { STUDIO, StudioStatusPill } from "../../../../_components/studio";
import { columnCollision, columnKeyboardCoordinates } from "./bus-board-dnd";
import {
  type BoardChip,
  boardCampuses,
  boardColumns,
  columnOfPeople,
  defaultBoardCampus,
  movingPeople,
  NO_BUS,
} from "./bus-board-model";
import { BusColumn } from "./bus-column";
import { FillDialog } from "./fill-dialog";
import { useGroupsTabData } from "./groups-view";
import { useMoveConfirm } from "./move-confirm";
import { ChipPreview } from "./person-chip";
import { PublishDialog } from "./publish-dialog";
import { SelectionBar } from "./selection-bar";
import { useBusMove } from "./use-bus-move";

/** A press that moves less than this is a click, never a drag. */
const DRAG_DISTANCE_PX = 8;

/**
 * The Buses section of the Groups tab (ruling R1): a campus's buses as
 * columns plus "Not on a bus yet". People move by dragging, or by selecting
 * them and choosing "Move to…"; also "Fill buses automatically" and
 * "Publish bus lists".
 */
export function BusBoard() {
  const t = useTranslations("adminPortal.bigEvents.buses");
  const tb = useTranslations("adminPortal.bigEvents");
  const locale = useLocale();
  const router = useRouter();
  const dndId = useId();
  const { bigEventId, view } = useGroupsTabData();
  const { pending } = useMoveConfirm();

  const campuses = useMemo(() => boardCampuses(view), [view]);
  const [picked, setPicked] = useState<string | null>(null);
  const campus =
    picked && campuses.includes(picked)
      ? picked
      : defaultBoardCampus(view, campuses);
  const columns = useMemo(
    () => (campus ? boardColumns(view, campus) : []),
    [view, campus]
  );
  const columnOf = useMemo(() => columnOfPeople(columns), [columns]);
  const chips = useMemo(
    () =>
      new Map(
        columns.flatMap((column) =>
          column.people.map((chip) => [chip.participantId, chip] as const)
        )
      ),
    [columns]
  );
  const buses = columns.flatMap((column) => (column.bus ? [column.bus] : []));
  const busNames = new Map(
    view.groups.map((group) => [group.$id, group.name] as const)
  );
  const busName = (busId: string) => busNames.get(busId) ?? "";

  const [selection, setSelection] = useState<ReadonlySet<string>>(new Set());
  const selected = [...selection].flatMap((id) => chips.get(id) ?? []);
  const onABus = selected.filter(
    (chip) => columnOf.get(chip.participantId) !== NO_BUS
  );
  const clearSelection = () => setSelection(new Set());
  const { request, save } = useBusMove(bigEventId, busName, clearSelection);
  const [dialog, setDialog] = useState<"fill" | "publish" | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isUnpinning, startUnpin] = useTransition();
  const busy = pending || isUnpinning;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: DRAG_DISTANCE_PX },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: columnKeyboardCoordinates(
        () => columns.map((column) => column.id),
        (id) => columnOf.get(id)
      ),
    })
  );

  const toggle = (participantId: string) =>
    setSelection((prev) => {
      const next = new Set(prev);
      if (!next.delete(participantId)) {
        next.add(participantId);
      }
      return next;
    });

  const unpin = (chip: BoardChip) =>
    startUnpin(async () => {
      try {
        await setPinned(bigEventId, {
          participantIds: [chip.participantId],
          pinned: false,
        });
        toast.success(t("unpinned", { name: chip.name }));
        router.refresh();
      } catch {
        toast.error(tb("form.saveFailed"));
      }
    });

  // A drag moves the selection when it starts on a selected person.
  const draggedCount = (id: UniqueIdentifier) =>
    selection.has(String(id)) ? selected.length : 1;
  const draggedName = (id: UniqueIdentifier) =>
    draggedCount(id) > 1
      ? t("people", { count: draggedCount(id) })
      : (chips.get(String(id))?.name ?? "");
  const targetName = (id: UniqueIdentifier) =>
    id === NO_BUS ? t("notOnBusName") : busName(String(id));
  // Spoken by screen readers; the defaults would read out ids.
  const announcements: Announcements = {
    onDragCancel: ({ active }) =>
      t("drag.cancelled", { name: draggedName(active.id) }),
    onDragEnd: ({ active, over }) =>
      over
        ? t("drag.dropped", {
            name: draggedName(active.id),
            target: targetName(over.id),
          })
        : t("drag.cancelled", { name: draggedName(active.id) }),
    onDragOver: ({ active, over }) =>
      over
        ? t("drag.over", {
            name: draggedName(active.id),
            target: targetName(over.id),
          })
        : undefined,
    onDragStart: ({ active }) =>
      t("drag.pickedUp", { name: draggedName(active.id) }),
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    if (!over) {
      return;
    }
    const target = String(over.id);
    const ids = movingPeople(String(active.id), selection, columnOf, target);
    const people = ids.flatMap((id) => chips.get(id) ?? []);
    if (people.length > 0) {
      request({
        busId: target === NO_BUS ? null : target,
        legs: "both",
        people,
      });
    }
  };

  const active = activeId ? chips.get(activeId) : undefined;
  const fillable = view.manageableCampuses.filter(
    (id) => id !== NATIONAL_CAMPUS_ID
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        {campuses.length > 1 && campus && (
          <div className="w-48">
            <PortalSelect
              aria-label={t("campus")}
              onChange={(e) => {
                setPicked(e.target.value);
                clearSelection();
              }}
              options={campuses.map((id) => ({
                label: tb(`campuses.${id}`),
                value: id,
              }))}
              value={campus}
            />
          </div>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {campus && (
            <PortalButton onClick={() => setDialog("fill")} size="sm">
              <Sparkles aria-hidden size={14} />
              {t("fill.open")}
            </PortalButton>
          )}
          {view.publishedAt ? (
            <StudioStatusPill
              label={t("publish.published", {
                date: formatOsloShortDay(view.publishedAt, locale),
              })}
              status="published"
            />
          ) : (
            view.canPublish && (
              <PortalButton
                onClick={() => setDialog("publish")}
                size="sm"
                variant="primary"
              >
                {t("publish.open")}
              </PortalButton>
            )
          )}
        </div>
      </div>

      <SelectionBar
        buses={buses}
        disabled={busy}
        onClear={clearSelection}
        onSave={save}
        onTakeOff={
          onABus.length > 0
            ? () => request({ busId: null, legs: "both", people: onABus })
            : undefined
        }
        people={selected}
      />

      {campus && buses.length === 0 && (
        <p className="text-sm" style={{ color: STUDIO.ink4 }}>
          {t("noBuses", { campus: tb(`campuses.${campus}`) })}
        </p>
      )}

      <DndContext
        accessibility={{
          announcements,
          screenReaderInstructions: { draggable: t("drag.instructions") },
        }}
        collisionDetection={columnCollision}
        id={dndId}
        onDragCancel={() => setActiveId(null)}
        onDragEnd={handleDragEnd}
        onDragStart={({ active: started }) => setActiveId(String(started.id))}
        sensors={sensors}
      >
        <div
          aria-busy={busy}
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          {columns.map((column) => (
            <BusColumn
              column={column}
              disabled={busy}
              key={column.id}
              onToggle={toggle}
              onUnpin={unpin}
              selection={selection}
            />
          ))}
        </div>
        <DragOverlay>
          {active ? (
            <ChipPreview
              chip={active}
              count={draggedCount(active.participantId)}
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      {dialog === "fill" && campus && (
        <FillDialog
          allowAll={fillable.length > 1}
          campusId={campus}
          onOpenChange={(open) => setDialog(open ? "fill" : null)}
        />
      )}
      {dialog === "publish" && (
        <PublishDialog
          bigEventId={bigEventId}
          onOpenChange={(open) => setDialog(open ? "publish" : null)}
          riders={view.outRiders}
        />
      )}
    </div>
  );
}

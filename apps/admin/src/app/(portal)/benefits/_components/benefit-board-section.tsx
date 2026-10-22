"use client";

import {
  type Announcements,
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  type UniqueIdentifier,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { toast } from "sonner";
import { SERIF_STACK, STUDIO } from "../../_components/studio";
import {
  type BoardItem,
  type BoardSection,
  canMoveItem,
  reorderOwnItems,
} from "../_lib/board";
import {
  type AdminLocale,
  benefitTitle,
  newBenefitHref,
  sectionLabel,
} from "../_lib/board-display";
import { BOARD_FOCUS_RING } from "../_lib/board-styles";
import { BenefitLine, SortableBenefitLine } from "./benefit-line";
import { BenefitTile, SortableBenefitTile } from "./benefit-tile";
import { saveBenefitOrder } from "./board-actions";

/** A press that moves less than this is a click, never a drag. */
const DRAG_DISTANCE_PX = 8;

type ItemLayout = "tiles" | "lines";

interface ItemListProps {
  campusId: string;
  items: BoardItem[];
  layout: ItemLayout;
  locale: AdminLocale;
  /** Live, planned and draft items get a drag handle; lapsed ones stay put. */
  sortable?: boolean;
}

function ItemList({
  campusId,
  items,
  layout,
  locale,
  sortable,
}: ItemListProps) {
  const movable = (item: BoardItem) => Boolean(sortable) && canMoveItem(item);
  if (layout === "tiles") {
    return (
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          const Tile = movable(item) ? SortableBenefitTile : BenefitTile;
          return (
            <Tile
              campusId={campusId}
              item={item}
              key={item.benefit.$id}
              locale={locale}
            />
          );
        })}
      </ul>
    );
  }
  return (
    <ul className="rounded-xl border border-[#e5dcca] bg-white">
      {items.map((item) => {
        const Line = movable(item) ? SortableBenefitLine : BenefitLine;
        return (
          <Line
            campusId={campusId}
            item={item}
            key={item.benefit.$id}
            locale={locale}
          />
        );
      })}
    </ul>
  );
}

/**
 * Own items that students can see, or soon will, can be dragged. Lapsed ones
 * always sort last, so they keep their place and carry no handle.
 */
function SortableItemList({
  onReorder,
  ...props
}: Omit<ItemListProps, "sortable"> & { onReorder: (ids: string[]) => void }) {
  const t = useTranslations("adminPortal.benefits.board");
  const dndId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: DRAG_DISTANCE_PX },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  const ids = props.items.filter(canMoveItem).map((item) => item.benefit.$id);

  const titleOf = (id: UniqueIdentifier): string => {
    const item = props.items.find((candidate) => candidate.benefit.$id === id);
    return item
      ? benefitTitle(item.benefit, props.locale) || t("untitled")
      : "";
  };
  const placeOf = (id: UniqueIdentifier) => ({
    position: ids.indexOf(String(id)) + 1,
    total: ids.length,
  });
  // Spoken by screen readers while sorting with the keyboard. The defaults
  // would read out item ids.
  const announcements: Announcements = {
    onDragCancel: ({ active }) =>
      t("drag.cancelled", { title: titleOf(active.id) }),
    onDragEnd: ({ active, over }) =>
      over
        ? t("drag.dropped", { title: titleOf(active.id), ...placeOf(over.id) })
        : t("drag.cancelled", { title: titleOf(active.id) }),
    onDragOver: ({ active, over }) =>
      over
        ? t("drag.movedOver", {
            title: titleOf(active.id),
            ...placeOf(over.id),
          })
        : undefined,
    onDragStart: ({ active }) =>
      t("drag.pickedUp", { title: titleOf(active.id) }),
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over) {
      return;
    }
    const next = reorderOwnItems(
      props.items,
      String(active.id),
      String(over.id)
    );
    if (next) {
      onReorder(next);
    }
  };

  return (
    <DndContext
      accessibility={{
        announcements,
        screenReaderInstructions: { draggable: t("drag.instructions") },
      }}
      collisionDetection={closestCenter}
      id={dndId}
      onDragEnd={handleDragEnd}
      sensors={sensors}
    >
      <SortableContext
        items={ids}
        strategy={
          props.layout === "tiles"
            ? rectSortingStrategy
            : verticalListSortingStrategy
        }
      >
        <ItemList {...props} sortable />
      </SortableContext>
    </DndContext>
  );
}

/** `items` in the order of `ids`; anything the order does not name follows. */
function inOrder(items: BoardItem[], ids: string[]): BoardItem[] {
  const byId = new Map(items.map((item) => [item.benefit.$id, item]));
  const ordered = ids.flatMap((id) => {
    const item = byId.get(id);
    byId.delete(id);
    return item ? [item] : [];
  });
  return [...ordered, ...byId.values()];
}

interface PendingOrder {
  /** The server order the drop was made on; a fresh one replaces the guess. */
  base: BoardItem[];
  ids: string[];
}

export interface BenefitBoardSectionProps {
  campusId: string;
  editable: boolean;
  locale: AdminLocale;
  section: BoardSection;
}

/**
 * One website section of a campus tab: the campus's own items, then the
 * Hele BISO items it also shows. Only the own items can be added or moved.
 */
export function BenefitBoardSection({
  campusId,
  editable,
  locale,
  section,
}: BenefitBoardSectionProps) {
  const t = useTranslations("adminPortal.benefits.board");
  const router = useRouter();
  const headingId = useId();
  const [pending, setPending] = useState<PendingOrder | null>(null);
  const layout: ItemLayout = section.section === "member" ? "tiles" : "lines";
  const own =
    pending?.base === section.own
      ? inOrder(section.own, pending.ids)
      : section.own;
  const canReorder = editable && own.filter(canMoveItem).length > 1;

  const reorder = async (ids: string[]) => {
    setPending({ base: section.own, ids });
    const failed = () => {
      // Undo only this drop: a later one may already be showing.
      setPending((current) => (current?.ids === ids ? null : current));
      toast.error(t("reorderFailed"));
      // The save refuses an out-of-date list, so fetch the current one
      // before the user tries again.
      router.refresh();
    };
    try {
      const result = await saveBenefitOrder(campusId, section.section, ids);
      if ("error" in result) {
        failed();
      }
    } catch {
      failed();
    }
  };

  return (
    <section aria-labelledby={headingId}>
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2
          className="text-[1.75rem] leading-tight"
          id={headingId}
          style={{
            color: STUDIO.ink,
            fontFamily: SERIF_STACK,
            fontWeight: 400,
          }}
        >
          {sectionLabel(section.section, locale)}
        </h2>
        {editable ? (
          <Link
            className={`shrink-0 rounded-md px-2.5 py-1 font-semibold text-[#6b1e1e] text-sm transition-colors hover:bg-[rgba(107,30,30,0.07)] ${BOARD_FOCUS_RING}`}
            href={newBenefitHref(campusId, section.section)}
            scroll={false}
          >
            {t("add")}
          </Link>
        ) : null}
      </div>

      {own.length === 0 ? (
        <p
          className="rounded-xl border border-dashed px-5 py-5 text-sm leading-6"
          style={{
            background: "rgba(255,255,255,0.32)",
            borderColor: STUDIO.rule2,
            color: STUDIO.ink3,
          }}
        >
          {editable ? t("emptySection") : t("emptySectionReadOnly")}
        </p>
      ) : null}
      {own.length > 0 && canReorder ? (
        <SortableItemList
          campusId={campusId}
          items={own}
          layout={layout}
          locale={locale}
          onReorder={reorder}
        />
      ) : null}
      {own.length > 0 && !canReorder ? (
        <ItemList
          campusId={campusId}
          items={own}
          layout={layout}
          locale={locale}
        />
      ) : null}

      {section.national.length > 0 ? (
        <>
          <div className="mt-6 mb-3 flex items-center gap-3">
            <span
              className="font-medium text-[11px] uppercase tracking-[0.08em]"
              style={{ color: STUDIO.ink3 }}
            >
              {t("fromNational")}
            </span>
            <span
              aria-hidden
              className="h-px flex-1"
              style={{ background: STUDIO.rule }}
            />
          </div>
          <ItemList
            campusId={campusId}
            items={section.national}
            layout={layout}
            locale={locale}
          />
        </>
      ) : null}
    </section>
  );
}

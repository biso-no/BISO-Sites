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
} from "@dnd-kit/sortable";
import { NATIONAL_CAMPUS_ID } from "@repo/shared/utils/benefit-catalog";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { type ReactNode, useId, useRef, useState } from "react";
import { toast } from "sonner";
import type { SiteLogo, SiteLogoGroup } from "../../../_actions/site-logos";
import { STUDIO, StudioButton } from "../../../_components/studio";
import {
  type BoardSortable,
  DragHandle,
  useBoardSortable,
} from "../../_components/board-sortable";
import { BOARD_FOCUS_RING } from "../../_lib/board-styles";
import { moveLogo } from "../_lib/partners-state";
import { saveLogoOrder } from "./logo-actions";
import { LogoSheet } from "./logo-sheet";
import { PartnersPageHeader } from "./partners-page-header";

/** A press that moves less than this is a click, never a drag. */
const DRAG_DISTANCE_PX = 8;
const DRAG_SHADOW = "0 14px 32px rgba(26,24,20,0.16)";
const GRID_CLASS = "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5";
const TILE_CLASS = `flex h-full min-h-[7.5rem] w-full flex-col items-center justify-center gap-2.5 rounded-lg border bg-white px-3 pb-3 text-center transition-[border-color,box-shadow] hover:border-[#d8cdb6] hover:shadow-[0_6px_18px_rgba(26,24,20,0.07)] ${BOARD_FOCUS_RING}`;

export interface LogoWallProps {
  /** Every campus's name, Hele BISO included. */
  campusLabels: Record<string, string>;
  /** Hele BISO first, then each campus the viewer can see. */
  groups: SiteLogoGroup[];
}

interface SheetState {
  /** Where a new logo starts. */
  campusId: string;
  editable: boolean;
  /** The logo as it was when the sheet opened; null for a new one. */
  logo: SiteLogo | null;
  open: boolean;
  /** A fresh form each time the sheet opens. */
  version: number;
}

/**
 * Logoer på nettsiden: the logo walls the website shows, Hele BISO first,
 * as a grid per campus. Logos are sorted by dragging and changed in a sheet.
 */
export function LogoWall({ campusLabels, groups }: LogoWallProps) {
  const t = useTranslations("adminPortal.benefits.partnersPage");
  const tBoard = useTranslations("adminPortal.benefits.board");
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const editableCampusIds = groups
    .filter((group) => group.editable)
    .map((group) => group.campusId);
  const canAdd = editableCampusIds.length > 0;
  const campusLabel = (campusId: string): string =>
    campusLabels[campusId] ?? "";

  const openSheet = (
    logo: SiteLogo | null,
    campusId: string,
    editable: boolean
  ) => {
    const active = document.activeElement;
    opener.current = active instanceof HTMLElement ? active : null;
    setSheet((current) => ({
      campusId,
      editable,
      logo,
      open: true,
      version: (current?.version ?? 0) + 1,
    }));
  };

  const newLogoButton = canAdd ? (
    <StudioButton
      className={BOARD_FOCUS_RING}
      onClick={() => openSheet(null, editableCampusIds[0] ?? "", true)}
      variant="accent"
    >
      {t("newLogo")}
    </StudioButton>
  ) : null;

  return (
    <div className="pb-16">
      <PartnersPageHeader action={newLogoButton} tab="logos" />

      <p
        className="mb-4 max-w-3xl text-sm leading-6"
        style={{ color: STUDIO.ink3 }}
      >
        {t("logosIntro")}
      </p>

      {groups.length === 0 ? (
        <p
          className="rounded-xl border border-dashed px-5 py-5 text-sm leading-6"
          style={{
            background: "rgba(255,255,255,0.32)",
            borderColor: STUDIO.rule2,
            color: STUDIO.ink3,
          }}
        >
          {tBoard("emptySectionReadOnly")}
        </p>
      ) : (
        <div
          className="space-y-6 rounded-xl border bg-white p-4 sm:p-5"
          style={{ borderColor: STUDIO.rule }}
        >
          {groups.map((group) => (
            <LogoGroupView
              campusLabel={campusLabel}
              group={group}
              key={group.campusId}
              onOpen={(logo) => openSheet(logo, group.campusId, group.editable)}
            />
          ))}
        </div>
      )}

      {canAdd ? (
        <p
          className="mt-3 text-[13px] leading-5"
          style={{ color: STUDIO.ink3 }}
        >
          {t("logoHint")}
        </p>
      ) : null}

      {sheet ? (
        <LogoSheet
          campusLabel={campusLabel}
          defaultCampusId={sheet.campusId}
          editable={sheet.editable}
          editableCampusIds={editableCampusIds}
          key={sheet.version}
          logo={sheet.logo}
          onClose={() =>
            setSheet((current) => current && { ...current, open: false })
          }
          onCloseAutoFocus={(event) => {
            // Back to the tile that opened it, if that is still there.
            if (opener.current?.isConnected) {
              event.preventDefault();
              opener.current.focus();
            }
          }}
          open={sheet.open}
        />
      ) : null}
    </div>
  );
}

/** `logos` in the order of `ids`; anything the order does not name follows. */
function inOrder(logos: SiteLogo[], ids: string[]): SiteLogo[] {
  const byId = new Map(logos.map((logo) => [logo.id, logo]));
  const ordered = ids.flatMap((id) => {
    const logo = byId.get(id);
    byId.delete(id);
    return logo ? [logo] : [];
  });
  return [...ordered, ...byId.values()];
}

interface PendingOrder {
  /** The server order the drop was made on; a fresh one replaces the guess. */
  base: SiteLogo[];
  ids: string[];
}

interface LogoGroupViewProps {
  campusLabel: (campusId: string) => string;
  group: SiteLogoGroup;
  /** Opens a logo, or a new one on this campus when null. */
  onOpen: (logo: SiteLogo | null) => void;
}

/**
 * One campus's logo wall. A group the viewer can change has drag handles and
 * a tile to add a logo; a drop shows at once and is saved, or put back.
 */
function LogoGroupView({ campusLabel, group, onOpen }: LogoGroupViewProps) {
  const t = useTranslations("adminPortal.benefits.partnersPage");
  const tBoard = useTranslations("adminPortal.benefits.board");
  const router = useRouter();
  const headingId = useId();
  const [pending, setPending] = useState<PendingOrder | null>(null);
  const logos =
    pending?.base === group.logos
      ? inOrder(group.logos, pending.ids)
      : group.logos;
  const sortable = group.editable && logos.length > 1;
  const national = group.campusId === NATIONAL_CAMPUS_ID;

  const reorder = async (activeId: string, overId: string) => {
    const ids = moveLogo({ ...group, logos }, activeId, overId).logos.map(
      (logo) => logo.id
    );
    if (ids.every((id, index) => id === logos[index]?.id)) {
      return;
    }
    setPending({ base: group.logos, ids });
    const failed = (reason: string) => {
      // The server's reason is English and for developers; it stays here.
      console.warn("[logos] reorder failed:", reason);
      // Undo only this drop: a later one may already be showing.
      setPending((current) => (current?.ids === ids ? null : current));
      toast.error(tBoard("reorderFailed"));
      // The save refuses an out-of-date order, so fetch the current one
      // before the user tries again.
      router.refresh();
    };
    try {
      const result = await saveLogoOrder(group.campusId, ids);
      if ("error" in result) {
        failed(result.error);
      }
    } catch (error) {
      failed(String(error));
    }
  };

  const tiles = (
    <ul className={GRID_CLASS}>
      {logos.map((logo) =>
        sortable ? (
          <SortableLogoTile key={logo.id} logo={logo} onOpen={onOpen} />
        ) : (
          <LogoTile key={logo.id} logo={logo} onOpen={onOpen} />
        )
      )}
      {group.editable ? (
        <li>
          <button
            className={`flex h-full min-h-[7.5rem] w-full items-center justify-center gap-1.5 rounded-lg border-[1.5px] border-dashed font-medium text-sm transition-colors hover:border-[#d8cdb6] hover:bg-[rgba(250,247,242,0.7)] ${BOARD_FOCUS_RING}`}
            onClick={() => onOpen(null)}
            style={{ borderColor: STUDIO.rule2, color: STUDIO.ink3 }}
            type="button"
          >
            {t("logoAdd")}
          </button>
        </li>
      ) : null}
    </ul>
  );

  let body: ReactNode = tiles;
  if (logos.length === 0 && !group.editable) {
    body = (
      <p className="text-sm leading-6" style={{ color: STUDIO.ink3 }}>
        {tBoard("emptySectionReadOnly")}
      </p>
    );
  } else if (sortable) {
    body = (
      <SortableLogos logos={logos} onMove={reorder}>
        {tiles}
      </SortableLogos>
    );
  }

  return (
    <section
      aria-labelledby={headingId}
      className="border-t pt-6 first:border-t-0 first:pt-0"
      style={{ borderColor: STUDIO.rule }}
    >
      {national ? (
        <h2
          className="mb-3 font-medium text-[11px] uppercase tracking-[0.08em]"
          id={headingId}
          style={{ color: STUDIO.ink3 }}
        >
          {t("logosNational")}
        </h2>
      ) : (
        <h2
          className="mb-3 font-semibold text-[15px] leading-snug"
          id={headingId}
          style={{ color: STUDIO.ink }}
        >
          {campusLabel(group.campusId)}
        </h2>
      )}
      {body}
    </section>
  );
}

/**
 * Lets the group's logos be dragged into a new order, by pointer or by
 * keyboard. Screen readers hear each logo's name and place, never its id.
 */
function SortableLogos({
  children,
  logos,
  onMove,
}: {
  children: ReactNode;
  logos: SiteLogo[];
  /** A logo let go over another. */
  onMove: (activeId: string, overId: string) => void;
}) {
  const t = useTranslations("adminPortal.benefits.board.drag");
  const dndId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: DRAG_DISTANCE_PX },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  const ids = logos.map((logo) => logo.id);

  const nameOf = (id: UniqueIdentifier): string =>
    logos.find((logo) => logo.id === id)?.name ?? "";
  const placeOf = (id: UniqueIdentifier) => ({
    position: ids.indexOf(String(id)) + 1,
    total: ids.length,
  });
  const announcements: Announcements = {
    onDragCancel: ({ active }) => t("cancelled", { title: nameOf(active.id) }),
    onDragEnd: ({ active, over }) =>
      over
        ? t("dropped", { title: nameOf(active.id), ...placeOf(over.id) })
        : t("cancelled", { title: nameOf(active.id) }),
    onDragOver: ({ active, over }) =>
      over
        ? t("movedOver", { title: nameOf(active.id), ...placeOf(over.id) })
        : undefined,
    onDragStart: ({ active }) => t("pickedUp", { title: nameOf(active.id) }),
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) {
      onMove(String(active.id), String(over.id));
    }
  };

  return (
    <DndContext
      accessibility={{
        announcements,
        screenReaderInstructions: { draggable: t("instructions") },
      }}
      collisionDetection={closestCenter}
      id={dndId}
      onDragEnd={handleDragEnd}
      sensors={sensors}
    >
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

interface LogoTileProps {
  logo: SiteLogo;
  onOpen: (logo: SiteLogo) => void;
}

/**
 * The logo with its name below. The whole tile opens the logo; the drag
 * handle sits in its corner, outside the button, so a drag never opens it.
 */
function TileFrame({
  logo,
  onOpen,
  sortable,
}: LogoTileProps & { sortable?: BoardSortable }) {
  const t = useTranslations("adminPortal.benefits.board");
  return (
    <li
      className="relative h-full"
      ref={sortable?.frameRef}
      style={sortable?.frameStyle}
    >
      <button
        // A sortable tile keeps its top clear for the drag handle.
        className={`${TILE_CLASS} ${sortable ? "pt-9" : "pt-3"}`}
        onClick={() => onOpen(logo)}
        style={{
          borderColor: STUDIO.rule,
          boxShadow: sortable?.isDragging ? DRAG_SHADOW : undefined,
        }}
        type="button"
      >
        <span className="relative block h-12 w-full">
          {/* Unoptimized: logos may live on any https host, outside
              `images.remotePatterns`. The name below says whose it is. */}
          <Image
            alt=""
            className="object-contain"
            fill
            src={logo.image_url}
            unoptimized
          />
        </span>
        <span
          className="line-clamp-2 break-words font-medium text-[13px] leading-5"
          style={{ color: STUDIO.ink }}
        >
          {logo.name}
        </span>
      </button>
      {sortable ? (
        <span className="absolute top-1 left-1">
          <DragHandle
            handle={sortable.handle}
            label={t("moveItem", { title: logo.name })}
          />
        </span>
      ) : null}
    </li>
  );
}

function LogoTile(props: LogoTileProps) {
  return <TileFrame {...props} />;
}

function SortableLogoTile(props: LogoTileProps) {
  const sortable = useBoardSortable(props.logo.id);
  return <TileFrame {...props} sortable={sortable} />;
}

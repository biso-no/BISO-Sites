"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { STUDIO } from "../../_components/studio";
import type { BoardItem } from "../_lib/board";
import {
  type AdminLocale,
  benefitHref,
  benefitTitle,
  categoryLabel,
  isDimmedState,
} from "../_lib/board-display";
import { BOARD_FOCUS_RING } from "../_lib/board-styles";
import { BenefitStatePill } from "./benefit-state-pill";
import {
  type BoardSortable,
  DragHandle,
  useBoardSortable,
} from "./board-sortable";
import { PartnerLogo } from "./partner-logo";

const DIMMED_OPACITY = 0.55;
const DRAG_SHADOW = "0 14px 32px rgba(26,24,20,0.16)";

export interface BenefitItemProps {
  campusId: string;
  item: BoardItem;
  locale: AdminLocale;
}

function TileFrame({
  campusId,
  item,
  locale,
  sortable,
}: BenefitItemProps & { sortable?: BoardSortable }) {
  const t = useTranslations("adminPortal.benefits.board");
  const title = benefitTitle(item.benefit, locale) || t("untitled");
  const meta = [
    item.partner?.name,
    categoryLabel(item.benefit.category, locale),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li
      className="relative h-full"
      ref={sortable?.frameRef}
      style={{
        ...sortable?.frameStyle,
        opacity: isDimmedState(item.state) ? DIMMED_OPACITY : undefined,
      }}
    >
      <Link
        className={`flex h-full min-h-[8.5rem] flex-col rounded-xl border border-[#e5dcca] bg-white p-4 transition-[border-color,box-shadow] hover:border-[#d8cdb6] hover:shadow-[0_6px_18px_rgba(26,24,20,0.07)] ${BOARD_FOCUS_RING}`}
        href={benefitHref(item.benefit.$id, campusId)}
        // The panel opens over the board; keep the board where it was.
        scroll={false}
        style={sortable?.isDragging ? { boxShadow: DRAG_SHADOW } : undefined}
      >
        <span className="flex items-start justify-between gap-3">
          <PartnerLogo
            logoUrl={item.partner?.logo_url ?? null}
            name={item.partner?.name ?? title}
          />
          <BenefitStatePill state={item.state} />
        </span>
        <span
          className="mt-3 font-semibold text-[15px] leading-snug"
          style={{ color: STUDIO.ink }}
        >
          {title}
        </span>
        <span className="mt-auto flex items-end gap-2 pt-1.5">
          <span
            className="min-w-0 flex-1 text-[13px] leading-5"
            style={{ color: STUDIO.ink3 }}
          >
            {meta}
          </span>
          {/* Keeps the text clear of the drag handle laid over this corner. */}
          {sortable ? <span aria-hidden className="h-8 w-8 shrink-0" /> : null}
        </span>
      </Link>
      {sortable ? (
        <span className="absolute right-3 bottom-3">
          <DragHandle
            handle={sortable.handle}
            label={t("moveItem", { title })}
          />
        </span>
      ) : null}
    </li>
  );
}

/** A member benefit card. Opens the benefit on the current tab. */
export function BenefitTile(props: BenefitItemProps) {
  return <TileFrame {...props} />;
}

/** A member benefit card that can be dragged within its section. */
export function SortableBenefitTile(props: BenefitItemProps) {
  const sortable = useBoardSortable(props.item.benefit.$id);
  return <TileFrame {...props} sortable={sortable} />;
}

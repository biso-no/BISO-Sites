"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { STUDIO } from "../../_components/studio";
import {
  benefitHref,
  benefitTitle,
  isDimmedState,
} from "../_lib/board-display";
import { BOARD_FOCUS_RING_INSET } from "../_lib/board-styles";
import { BenefitStatePill } from "./benefit-state-pill";
import type { BenefitItemProps } from "./benefit-tile";
import {
  type BoardSortable,
  DragHandle,
  useBoardSortable,
} from "./board-sortable";

const DIMMED_OPACITY = 0.55;
const DRAG_SHADOW = "0 10px 26px rgba(26,24,20,0.14)";

function LineRow({
  campusId,
  item,
  locale,
  sortable,
}: BenefitItemProps & { sortable?: BoardSortable }) {
  const t = useTranslations("adminPortal.benefits.board");
  const title = benefitTitle(item.benefit, locale) || t("untitled");

  return (
    <li
      className="relative flex items-center border-[#e5dcca] border-t bg-white transition-colors first:rounded-t-xl first:border-t-0 last:rounded-b-xl hover:bg-[#fdfbf7]"
      ref={sortable?.frameRef}
      style={{
        ...sortable?.frameStyle,
        boxShadow: sortable?.isDragging ? DRAG_SHADOW : undefined,
        opacity: isDimmedState(item.state) ? DIMMED_OPACITY : undefined,
      }}
    >
      {sortable ? (
        <span className="pl-2">
          <DragHandle
            handle={sortable.handle}
            label={t("moveItem", { title })}
          />
        </span>
      ) : null}
      <Link
        className={`flex min-w-0 flex-1 items-center gap-4 rounded-xl py-3.5 pr-4 ${sortable ? "pl-2" : "pl-5"} ${BOARD_FOCUS_RING_INSET}`}
        href={benefitHref(item.benefit.$id, campusId)}
        scroll={false}
      >
        <span
          className="min-w-0 flex-1 text-[15px] leading-snug"
          style={{ color: STUDIO.ink }}
        >
          {title}
        </span>
        <BenefitStatePill state={item.state} />
      </Link>
    </li>
  );
}

/** A one-line benefit row. Opens the benefit on the current tab. */
export function BenefitLine(props: BenefitItemProps) {
  return <LineRow {...props} />;
}

/** A one-line benefit row that can be dragged within its section. */
export function SortableBenefitLine(props: BenefitItemProps) {
  const sortable = useBoardSortable(props.item.benefit.$id);
  return <LineRow {...props} sortable={sortable} />;
}

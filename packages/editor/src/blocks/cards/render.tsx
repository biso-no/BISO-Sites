"use client";

import { cardGridClass } from "@/blocks/_v2/card-grid";
import { ChevronMedia } from "@/blocks/_v2/chevron-media";
import { FeedCardShell } from "@/blocks/_v2/feed-section";
import { knownKey } from "@/blocks/_v2/known-key";
import { listOf } from "@/blocks/_v2/list";
import type { PatchFn } from "@/blocks/types";
import { EditableText } from "@/components/editor-shell/canvas/editable-text";
import { usePageFeedSource } from "@/editor/page-feed-context";
import type { CardItem, CardsBlock } from "@/editor/types";

interface Props {
  block: CardsBlock;
  edit: boolean;
  onPatch: PatchFn;
}

const COLUMNS = { "2": 2, "3": 3, "4": 4 } as const;
const LAYOUTS = { grid: "", row: "" } as const;
const STYLES = { bordered: "", plain: "" } as const;

const BORDERED =
  "rounded-biso-md border border-edge p-5 hover:border-ink-accent";
const CARD_BASE = "flex h-full min-w-0 flex-col gap-3 break-words text-ink";
const ROW_LABEL = { en: "Cards", no: "Kort" } as const;
const ROW_SCROLLER =
  "overflow-x-auto pb-2 focus-visible:rounded-biso-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring";
const ROW_CARD = "w-64 shrink-0 snap-start @md:w-72";

export function CardsRender({ block, edit, onPatch }: Props) {
  const { locale } = usePageFeedSource();
  const items = listOf<CardItem>(block.items);
  const columns = COLUMNS[knownKey(COLUMNS, String(block.columns), "3")];
  const layout = knownKey(LAYOUTS, block.layout, "grid");
  const style = knownKey(STYLES, block.style, "bordered");
  const update = (i: number, key: "body" | "eyebrow" | "title", v: string) =>
    onPatch(
      "items",
      items.map((x, j) => (j === i ? { ...x, [key]: v } : x))
    );

  const listClass =
    layout === "row"
      ? "m-0 flex list-none snap-x snap-mandatory gap-5 p-0"
      : `${cardGridClass(columns)} m-0 list-none p-0`;
  const cardClass = `${CARD_BASE} ${style === "bordered" ? BORDERED : ""}`;

  if (items.length === 0 && !edit) {
    return null;
  }

  const list = (
    <ul className={listClass}>
      {items.map((item, i) => (
        <FeedCardShell
          className={cardClass}
          edit={edit}
          href={item.href}
          itemClassName={layout === "row" ? ROW_CARD : "min-w-0"}
          // Items carry no id and their text is editable, so the index is the
          // only stable identity.
          key={i}
        >
          {item.image?.src ? (
            <ChevronMedia
              alt={item.image.alt ?? ""}
              mime={item.image.mime}
              ratio="16/9"
              src={item.image.src}
              width={640}
            />
          ) : null}
          {item.eyebrow || edit ? (
            <EditableText
              className="type-label text-ink-accent"
              edit={edit}
              onChange={(v) => update(i, "eyebrow", v)}
              tag="span"
              value={item.eyebrow ?? ""}
            />
          ) : null}
          <EditableText
            className="type-heading-card text-ink"
            edit={edit}
            onChange={(v) => update(i, "title", v)}
            tag="h3"
            value={typeof item.title === "string" ? item.title : ""}
          />
          <EditableText
            className="type-body text-ink-muted"
            edit={edit}
            onChange={(v) => update(i, "body", v)}
            tag="p"
            value={typeof item.body === "string" ? item.body : ""}
          />
        </FeedCardShell>
      ))}
    </ul>
  );

  if (layout !== "row") {
    return list;
  }
  // A scroller must be reachable and announced for keyboard users.
  return (
    <div
      aria-label={ROW_LABEL[locale] ?? ROW_LABEL.no}
      className={ROW_SCROLLER}
      role="region"
      tabIndex={0}
    >
      {list}
    </div>
  );
}

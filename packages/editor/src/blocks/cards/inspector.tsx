"use client";

import { knownKey } from "@/blocks/_v2/known-key";
import { listOf } from "@/blocks/_v2/list";
import type { PatchFn } from "@/blocks/types";
import { linkNote } from "@/components/editor-shell/inspector/button-fields";
import {
  InspRow,
  InspSection,
  Segmented,
} from "@/components/editor-shell/inspector/insp-parts";
import { ItemList } from "@/components/editor-shell/inspector/item-list";
import { MediaPicker } from "@/components/editor-shell/inspector/media-picker";
import type { CardItem, CardsBlock, PageDoc } from "@/editor/types";

interface Props {
  block: CardsBlock;
  doc: PageDoc;
  onPatch: PatchFn;
}

const LAYOUTS = [
  { label: "Grid", value: "grid" },
  { label: "Row", value: "row" },
] as const;
const STYLES = [
  { label: "Bordered", value: "bordered" },
  { label: "Plain", value: "plain" },
] as const;
const COLUMNS = [
  { label: "2", value: "2" },
  { label: "3", value: "3" },
  { label: "4", value: "4" },
] as const;
const COLUMN_KEYS = { "2": 0, "3": 0, "4": 0 } as const;

export function CardsInspector({ block, onPatch }: Props) {
  const layout = knownKey({ grid: 0, row: 0 }, block.layout, "grid");
  const style = knownKey({ bordered: 0, plain: 0 }, block.style, "bordered");
  const columns = knownKey(COLUMN_KEYS, String(block.columns), "3");
  return (
    <>
      <InspSection label="Cards">
        <InspRow label="Layout">
          <Segmented
            choices={[...LAYOUTS]}
            onPick={(v) => onPatch("layout", v)}
            value={layout}
          />
        </InspRow>
        {layout === "grid" ? (
          <InspRow label="Columns">
            <Segmented
              choices={[...COLUMNS]}
              onPick={(v) => onPatch("columns", Number(v))}
              value={columns}
            />
          </InspRow>
        ) : null}
        <InspRow label="Style">
          <Segmented
            choices={[...STYLES]}
            onPick={(v) => onPatch("style", v)}
            value={style}
          />
        </InspRow>
      </InspSection>
      <InspSection label="Items">
        <ItemList<CardItem>
          addLabel="+ Add card"
          items={listOf<CardItem>(block.items)}
          newItem={() => ({ title: "New card", body: "Description." })}
          onChange={(items) => onPatch("items", items)}
          renderItem={(item, update) => (
            <>
              <InspRow label="Eyebrow">
                <input
                  onChange={(e) =>
                    update({ ...item, eyebrow: e.target.value || undefined })
                  }
                  value={item.eyebrow ?? ""}
                />
              </InspRow>
              <InspRow label="Title">
                <input
                  onChange={(e) => update({ ...item, title: e.target.value })}
                  value={item.title ?? ""}
                />
              </InspRow>
              <InspRow label="Body">
                <textarea
                  onChange={(e) => update({ ...item, body: e.target.value })}
                  rows={2}
                  value={item.body ?? ""}
                />
              </InspRow>
              <MediaPicker
                accept="image/*"
                onClear={() => update({ ...item, image: undefined })}
                onPicked={(fileId, url, mime) =>
                  update({
                    ...item,
                    image: {
                      alt: item.image?.alt,
                      fileId,
                      mime: mime || undefined,
                      src: url,
                    },
                  })
                }
                onUrl={(url) =>
                  update({
                    ...item,
                    image: url ? { alt: item.image?.alt, src: url } : undefined,
                  })
                }
                src={item.image?.src}
              />
              {item.image?.src ? (
                <InspRow label="Alt text">
                  <input
                    onChange={(e) =>
                      item.image &&
                      update({
                        ...item,
                        image: { ...item.image, alt: e.target.value },
                      })
                    }
                    value={item.image.alt ?? ""}
                  />
                </InspRow>
              ) : null}
              <InspRow label="Link">
                <input
                  onChange={(e) =>
                    update({ ...item, href: e.target.value || undefined })
                  }
                  placeholder="https://…"
                  value={item.href ?? ""}
                />
              </InspRow>
              {linkNote(item.href ?? "") ? (
                <p className="pe-insp-note" role="status">
                  {linkNote(item.href ?? "")}
                </p>
              ) : null}
            </>
          )}
          title={(item) => item.title || "Card"}
        />
      </InspSection>
    </>
  );
}

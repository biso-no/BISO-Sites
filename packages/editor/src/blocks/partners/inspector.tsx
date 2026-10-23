"use client";

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
import type { PageDoc, PartnerItem, PartnersBlock } from "@/editor/types";

interface Props {
  block: PartnersBlock;
  doc: PageDoc;
  onPatch: PatchFn;
}

const SOURCES = [
  { label: "Auto", value: "auto" },
  { label: "Manual", value: "manual" },
] as const;

export function PartnersInspector({ block, onPatch }: Props) {
  const source = block.source === "manual" ? "manual" : "auto";
  return (
    <>
      <InspSection label="Partners">
        <InspRow label="Heading">
          <input
            onChange={(e) => onPatch("heading", e.target.value)}
            value={block.heading ?? ""}
          />
        </InspRow>
        <InspRow label="Source">
          <Segmented
            choices={[...SOURCES]}
            onPick={(v) => onPatch("source", v)}
            value={source}
          />
        </InspRow>
        {source === "auto" ? (
          <p className="pe-insp-note">
            Shows BISO's national partners from the partner list.
          </p>
        ) : null}
      </InspSection>
      {source === "manual" ? (
        <InspSection label="Logos">
          <ItemList<PartnerItem>
            addLabel="+ Add partner"
            items={listOf<PartnerItem>(block.items)}
            newItem={() => ({ name: "Partner name" })}
            onChange={(items) => onPatch("items", items)}
            renderItem={(item, update) => (
              <>
                <InspRow label="Name">
                  <input
                    onChange={(e) => update({ ...item, name: e.target.value })}
                    value={item.name ?? ""}
                  />
                </InspRow>
                <MediaPicker
                  accept="image/*"
                  onClear={() =>
                    update({ ...item, logo: undefined, logoSrc: undefined })
                  }
                  onPicked={(fileId, url, mime) =>
                    update({
                      ...item,
                      logo: { fileId, mime: mime || undefined, src: url },
                      logoSrc: undefined,
                    })
                  }
                  onUrl={(url) =>
                    update({
                      ...item,
                      logo: url ? { src: url } : undefined,
                      logoSrc: undefined,
                    })
                  }
                  src={item.logo?.src ?? item.logoSrc}
                />
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
            title={(item) => item.name || "Partner"}
          />
        </InspSection>
      ) : null}
    </>
  );
}

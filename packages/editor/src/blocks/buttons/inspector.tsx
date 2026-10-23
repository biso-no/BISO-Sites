"use client";

import { listOf } from "@/blocks/_v2/list";
import type { PatchFn } from "@/blocks/types";
import { ButtonFields } from "@/components/editor-shell/inspector/button-fields";
import {
  InspSection,
  Segmented,
} from "@/components/editor-shell/inspector/insp-parts";
import { ItemList } from "@/components/editor-shell/inspector/item-list";
import type { ButtonsBlock, LinkButton, PageDoc } from "@/editor/types";

interface Props {
  block: ButtonsBlock;
  doc: PageDoc;
  onPatch: PatchFn;
}

export function ButtonsInspector({ block, onPatch }: Props) {
  return (
    <>
      <InspSection label="Align">
        <Segmented
          choices={[
            { label: "Start", value: "start" },
            { label: "Center", value: "center" },
          ]}
          onPick={(align) => onPatch("align", align)}
          value={block.align}
        />
      </InspSection>
      <InspSection label="Buttons">
        <ItemList
          addLabel="+ Add button"
          items={listOf<LinkButton>(block.items)}
          max={3}
          newItem={(): LinkButton => ({
            href: "",
            label: "Button",
            style: "secondary",
          })}
          onChange={(items) => onPatch("items", items)}
          renderItem={(item, update) => (
            <ButtonFields button={item} onChange={update} />
          )}
          title={(item, i) => item.label || `Button ${i + 1}`}
        />
      </InspSection>
    </>
  );
}

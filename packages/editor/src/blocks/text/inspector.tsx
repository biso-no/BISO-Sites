"use client";

import { knownKey } from "@/blocks/_v2/known-key";
import { listOf } from "@/blocks/_v2/list";
import type { PatchFn } from "@/blocks/types";
import {
  InspRow,
  InspSection,
  Segmented,
} from "@/components/editor-shell/inspector/insp-parts";
import { ItemList } from "@/components/editor-shell/inspector/item-list";
import type { PageDoc, TextBlock, TextBodyItem } from "@/editor/types";

const TYPE_LABELS: Record<TextBodyItem["type"], string> = {
  h: "H2",
  h3: "H3",
  p: "Paragraph",
  li: "List item",
};

const CHOICES = (["h", "h3", "p", "li"] as const).map((value) => ({
  label: TYPE_LABELS[value],
  value,
}));

interface Props {
  block: TextBlock;
  doc: PageDoc;
  onPatch: PatchFn;
}

export function TextInspector({ block, onPatch }: Props) {
  return (
    <InspSection label="Content blocks">
      <ItemList<TextBodyItem>
        addLabel="+ Add paragraph"
        items={listOf<TextBodyItem>(block.body)}
        newItem={() => ({ text: "New paragraph", type: "p" })}
        onChange={(body) => onPatch("body", body)}
        renderItem={(item, update) => (
          <>
            <Segmented
              choices={CHOICES}
              onPick={(type) => update({ ...item, type })}
              value={knownKey(TYPE_LABELS, item.type, "p")}
            />
            <InspRow label="Text">
              <textarea
                onChange={(e) => update({ ...item, text: e.target.value })}
                rows={2}
                value={item.text}
              />
            </InspRow>
          </>
        )}
        title={(item, i) =>
          `${i + 1}. ${TYPE_LABELS[knownKey(TYPE_LABELS, item.type, "p")]}`
        }
      />
    </InspSection>
  );
}

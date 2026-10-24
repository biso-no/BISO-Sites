"use client";

import { listOf } from "@/blocks/_v2/list";
import type { PatchFn } from "@/blocks/types";
import {
  type LinkNotes,
  linkNote,
} from "@/components/editor-shell/inspector/button-fields";
import {
  InspRow,
  InspSection,
} from "@/components/editor-shell/inspector/insp-parts";
import { ItemList } from "@/components/editor-shell/inspector/item-list";
import type { FactItem, FactsBlock, PageDoc } from "@/editor/types";

const FACT_LINK_NOTES: LinkNotes = {
  missing: "No link yet, so the value shows as plain text.",
  unsafe: "This link isn't allowed, so the value shows as plain text.",
};

interface Props {
  block: FactsBlock;
  doc: PageDoc;
  onPatch: PatchFn;
}

export function FactsInspector({ block, onPatch }: Props) {
  return (
    <InspSection label="Facts">
      <ItemList<FactItem>
        addLabel="+ Add fact"
        items={listOf<FactItem>(block.items)}
        newItem={() => ({ label: "Label", text: "Value" })}
        onChange={(items) => onPatch("items", items)}
        renderItem={(item, update) => {
          // A link left out is fine; one that is there but broken is noted.
          const note =
            typeof item.href === "string"
              ? linkNote(item.href, FACT_LINK_NOTES)
              : null;
          return (
            <>
              <InspRow label="Label">
                <input
                  onChange={(e) => update({ ...item, label: e.target.value })}
                  value={item.label}
                />
              </InspRow>
              <InspRow label="Text">
                <input
                  onChange={(e) => update({ ...item, text: e.target.value })}
                  value={item.text}
                />
              </InspRow>
              <InspRow label="Link">
                <input
                  onChange={(e) =>
                    update({ ...item, href: e.target.value || undefined })
                  }
                  placeholder="https://"
                  value={item.href ?? ""}
                />
              </InspRow>
              {note ? (
                <p className="pe-insp-note" role="status">
                  {note}
                </p>
              ) : null}
            </>
          );
        }}
        title={(item, i) => item.label || `Fact ${i + 1}`}
      />
    </InspSection>
  );
}

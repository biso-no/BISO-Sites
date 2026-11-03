"use client";

import { Suspense } from "react";
import type { PatchFn } from "@/blocks/types";
import { InspSection } from "@/components/editor-shell/inspector/insp-parts";
import type { PageDoc, TextBlock } from "@/editor/types";
import { bodyPatch, bodyToHtml } from "./body";
import { RichTextField, useMounted } from "./lazy-field";

interface Props {
  block: TextBlock;
  doc: PageDoc;
  onPatch: PatchFn;
}

/**
 * The block's whole body as one Plate field with its toolbar, drawn once the
 * client has mounted and its chunk has loaded. Keyed on the block, so
 * selecting another text block loads that block's text.
 */
export function TextInspector({ block, onPatch }: Props) {
  const mounted = useMounted();
  const fallback = <div className="pe-rt-field" />;
  return (
    <InspSection label="Text">
      {mounted ? (
        <Suspense fallback={fallback}>
          <RichTextField
            html={bodyToHtml(block.body)}
            key={block.id}
            label="Text"
            onChange={bodyPatch(block, onPatch)}
            variant="panel"
          />
        </Suspense>
      ) : (
        fallback
      )}
    </InspSection>
  );
}

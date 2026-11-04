"use client";

import { Suspense, useRef, useState } from "react";
import type { PatchFn } from "@/blocks/types";
import { InspSection } from "@/components/editor-shell/inspector/insp-parts";
import { useEditorCallbacks } from "@/editor/callbacks";
import type { PageDoc, TextBlock } from "@/editor/types";
import { bodyPatch, bodyToHtml } from "./body";
import { TextExpandView } from "./expand";
import { RichTextField, useMounted } from "./lazy-field";

interface Props {
  block: TextBlock;
  doc: PageDoc;
  onPatch: PatchFn;
}

/**
 * The block's whole body as one Plate field with its toolbar, drawn once the
 * client has mounted and its chunk has loaded. Keyed on the block, so
 * selecting another text block loads that block's text, and closes the wide
 * view if it was open.
 */
export function TextInspector({ block, onPatch }: Props) {
  return <TextFields block={block} key={block.id} onPatch={onPatch} />;
}

/**
 * The panel field, and its wide writing view while that is open. Only one
 * of the two is mounted at a time: while the view is open, an empty field
 * of the same size holds the panel field's place. The canvas field stays
 * mounted throughout and follows each change.
 */
function TextFields({
  block,
  onPatch,
}: {
  block: TextBlock;
  onPatch: PatchFn;
}) {
  const mounted = useMounted();
  const { pageHistory } = useEditorCallbacks();
  const [expanded, setExpanded] = useState(false);
  const expandButton = useRef<HTMLButtonElement>(null);
  const fallback = <div className="pe-rt-field" />;

  const close = () => {
    setExpanded(false);
    expandButton.current?.focus();
  };

  const expand = (
    <button
      aria-expanded={expanded}
      aria-haspopup="dialog"
      className="pe-rt-expand-btn"
      onClick={expanded ? close : () => setExpanded(true)}
      ref={expandButton}
      type="button"
    >
      <span aria-hidden="true">⤢</span> Expand
    </button>
  );

  let field = fallback;
  if (expanded) {
    field = <div aria-hidden="true" className="pe-rt-field" />;
  } else if (mounted) {
    field = (
      <Suspense fallback={fallback}>
        <RichTextField
          html={bodyToHtml(block.body)}
          label="Text"
          onChange={bodyPatch(block, onPatch)}
          onPageHistory={pageHistory}
          variant="panel"
        />
      </Suspense>
    );
  }

  return (
    <>
      <InspSection action={expand} label="Text">
        {field}
      </InspSection>
      {expanded ? (
        <TextExpandView
          block={block}
          onClose={close}
          onPageHistory={pageHistory}
          onPatch={onPatch}
        />
      ) : null}
    </>
  );
}

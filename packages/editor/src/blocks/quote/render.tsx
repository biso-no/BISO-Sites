"use client";

import type { PatchFn } from "@/blocks/types";
import type { QuoteBlock } from "@/editor/types";

interface Props {
  block: QuoteBlock;
  edit: boolean;
  onPatch: PatchFn;
}

export function QuoteRender({ block, edit, onPatch }: Props) {
  return (
    <div className="pg-quote pg-block">
      <div aria-hidden="true" className="pg-quote__mark">
        "
      </div>
      {edit ? (
        // biome-ignore lint/a11y/useSemanticElements: contentEditable and editor preview controls intentionally use custom interaction surfaces.
        <div
          className="pg-quote__body"
          contentEditable
          data-edit="1"
          onBlur={(e) => onPatch("text", e.currentTarget.textContent ?? "")}
          role="textbox"
          suppressContentEditableWarning
          tabIndex={0}
        >
          {block.text}
        </div>
      ) : (
        <div className="pg-quote__body">{block.text}</div>
      )}
      <div className="pg-quote__attrib">
        <div aria-hidden="true" className="pg-quote__av">
          {(block.author || "?")
            .split(" ")
            .filter(Boolean)
            .map((p) => p[0])
            .join("")
            .slice(0, 2)}
        </div>
        <div>
          {edit ? (
            // biome-ignore lint/a11y/noNoninteractiveElementInteractions: contentEditable and editor preview controls intentionally use custom interaction surfaces.
            // biome-ignore lint/a11y/noStaticElementInteractions: contentEditable and editor preview controls intentionally use custom interaction surfaces.
            <b
              contentEditable
              data-edit="1"
              onBlur={(e) =>
                onPatch("author", e.currentTarget.textContent ?? "")
              }
              suppressContentEditableWarning
            >
              {block.author}
            </b>
          ) : (
            <b>{block.author}</b>
          )}
          {", "}
          {edit ? (
            // biome-ignore lint/a11y/useSemanticElements: contentEditable and editor preview controls intentionally use custom interaction surfaces.
            <span
              contentEditable
              data-edit="1"
              onBlur={(e) => onPatch("role", e.currentTarget.textContent ?? "")}
              role="textbox"
              suppressContentEditableWarning
              tabIndex={0}
            >
              {block.role}
            </span>
          ) : (
            <span>{block.role}</span>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import type { DocumentsBlock } from "@/editor/types";
import type { PatchFn } from "@/blocks/types";

interface Props { block: DocumentsBlock; edit: boolean; onPatch: PatchFn; }

export function DocumentsRender({ block }: Props) {
  return (
    <div className="pg-documents pg-block">
      {block.heading && <h2 className="pg-documents__h">{block.heading}</h2>}
      <div className="pg-documents__list">
        {block.items.map((doc, i) => (
          <div key={i} className="pg-documents__item">
            <span className="pg-documents__icon" aria-hidden="true">📄</span>
            <div className="pg-documents__meta">
              <span className="pg-documents__title">{doc.title}</span>
              {doc.size && <span className="pg-documents__size">{doc.size}</span>}
            </div>
            <a
              className="pg-documents__dl"
              href={`/api/files/${doc.fileId}`}
              download
              aria-label={`Download ${doc.title}`}
            >↓</a>
          </div>
        ))}
        {block.items.length === 0 && (
          <p style={{ fontSize: 13, color: "var(--ink-3)" }}>No documents added yet.</p>
        )}
      </div>
    </div>
  );
}

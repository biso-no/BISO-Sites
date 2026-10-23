"use client";

import { listOf } from "@/blocks/_v2/list";
import type { PatchFn } from "@/blocks/types";
import {
  InspRow,
  InspSection,
} from "@/components/editor-shell/inspector/insp-parts";
import { ItemList } from "@/components/editor-shell/inspector/item-list";
import { MediaPicker } from "@/components/editor-shell/inspector/media-picker";
import type { DocumentItem, DocumentsBlock, PageDoc } from "@/editor/types";
import { metaLine, mimeFromFilename, titleFromFilename } from "./format";

interface Props {
  block: DocumentsBlock;
  doc: PageDoc;
  onPatch: PatchFn;
}

/** What `/api/upload` takes for documents (see apps/admin upload-buckets). */
const ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt";

const text = (v: unknown): string => (typeof v === "string" ? v : "");

export function DocumentsInspector({ block, onPatch }: Props) {
  return (
    <>
      <InspSection label="Content">
        <InspRow label="Heading">
          <input
            onChange={(e) => onPatch("heading", e.target.value)}
            placeholder="Documents"
            value={text(block.heading)}
          />
        </InspRow>
      </InspSection>
      <InspSection label="Files">
        <ItemList
          addLabel="+ Add document"
          items={listOf<DocumentItem>(block.items)}
          newItem={(): DocumentItem => ({ src: "", title: "" })}
          onChange={(items) => onPatch("items", items)}
          renderItem={(item, update) => (
            <>
              <InspRow label="Title">
                <input
                  onChange={(e) => update({ ...item, title: e.target.value })}
                  placeholder="Title"
                  value={text(item.title)}
                />
              </InspRow>
              <InspRow label="File">
                <MediaPicker
                  accept={ACCEPT}
                  kind="file"
                  onClear={() => update({ src: "", title: text(item.title) })}
                  onPicked={(fileId, url, mime, file) =>
                    update({
                      fileId,
                      mime:
                        mime ||
                        (file ? mimeFromFilename(file.name) : undefined),
                      size: file?.size,
                      src: url,
                      // The file's name stands in until the editor writes one.
                      title: text(item.title).trim()
                        ? item.title
                        : titleFromFilename(file?.name ?? ""),
                    })
                  }
                  onUrl={(url) => update({ src: url, title: text(item.title) })}
                  src={text(item.src) || undefined}
                />
              </InspRow>
              {text(item.src) ? (
                <div style={{ fontSize: 11, color: "var(--ink-3)" }}>
                  {metaLine(item)}
                </div>
              ) : null}
            </>
          )}
          title={(item, i) => text(item.title) || `Document ${i + 1}`}
        />
      </InspSection>
    </>
  );
}

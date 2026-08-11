"use client";

import {
  ArrowDown,
  ArrowUp,
  FileText,
  GripVertical,
  Heading1,
  ImagePlus,
  List,
  Loader2,
  Pilcrow,
  Plus,
  Trash2,
} from "lucide-react";
import Image from "next/image";
import type React from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { InlineMediaUpload } from "@/lib/inline-media";

/* -------------------------------------------------------------------------- */
/*                                                                            */
/*  Shared Studio description editor.                                         */
/*                                                                            */
/*  A lightweight contentEditable block editor (heading / paragraph / bullet) */
/*  that serializes to simple HTML. This is the same editor the events and    */
/*  jobs studios use; extracted here so the communications studio reuses it    */
/*  rather than the Plate-based `@repo/ui` ContentEditor (whose JSON output    */
/*  leaked into the push previews).                                           */
/*                                                                            */
/*  Contract: `value` is HTML in, `onChange` emits HTML out. Bodies flatten   */
/*  to plain text downstream via `htmlToPlainText` for push payloads.         */
/* -------------------------------------------------------------------------- */

import {
  type DescriptionBlock,
  type DescriptionBlockType,
  descriptionBlocksToHtml,
  htmlToDescriptionBlocks,
  isTextDescriptionBlock,
  type MediaDescriptionBlock,
  newBlock,
  newMediaBlock,
  type TextDescriptionBlock,
} from "./description-blocks";
import { uploadInlineMedia } from "./inline-media-upload";

const COLOR = {
  claret: "#6b1e1e",
  ink: "#1a1814",
  ink2: "#3a342a",
  ink3: "#6b6357",
  ink4: "#9c9385",
  rule: "#e5dcca",
  rule2: "#d8cdb6",
} as const;

const SERIF = "'Instrument Serif', Georgia, serif";

const INLINE_MEDIA_ACCEPT = [
  ".csv",
  ".doc",
  ".docx",
  ".gif",
  ".jpeg",
  ".jpg",
  ".m4a",
  ".mov",
  ".mp3",
  ".mp4",
  ".ogg",
  ".pdf",
  ".png",
  ".ppt",
  ".pptx",
  ".svg",
  ".txt",
  ".wav",
  ".webm",
  ".webp",
  ".xls",
  ".xlsx",
  ".zip",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/gif",
  "image/jpeg",
  "audio/mp4",
  "audio/x-m4a",
  "video/quicktime",
  "audio/mpeg",
  "video/mp4",
  "audio/ogg",
  "application/pdf",
  "image/png",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/svg+xml",
  "text/plain",
  "audio/wav",
  "audio/webm",
  "video/webm",
  "image/webp",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
].join(",");

export type MediaUploadTarget =
  | { afterId: string | null; kind: "insert" }
  | { blockId: string; kind: "replace" };

export type PendingMediaUploadTarget = MediaUploadTarget & { revision: number };

export function applyMediaUpload(
  blocks: DescriptionBlock[],
  target: MediaUploadTarget,
  uploaded: InlineMediaUpload
): DescriptionBlock[] | null {
  const replacedBlock =
    target.kind === "replace"
      ? blocks.find(
          (block): block is MediaDescriptionBlock =>
            block.id === target.blockId && block.type === "media"
        )
      : undefined;
  const uploadedBlock = newMediaBlock({
    alt:
      replacedBlock?.mediaKind === "image" && uploaded.mediaKind === "image"
        ? replacedBlock.alt
        : "",
    caption: replacedBlock?.caption ?? "",
    fileId: uploaded.fileId,
    fileName: uploaded.fileName,
    mediaKind: uploaded.mediaKind,
    mimeType: uploaded.mimeType,
    url: uploaded.url,
  });

  if (target.kind === "replace") {
    if (!replacedBlock) {
      return null;
    }
    return blocks.map((block) =>
      block.id === target.blockId
        ? { ...uploadedBlock, id: target.blockId }
        : block
    );
  }

  const afterIndex = target.afterId
    ? blocks.findIndex((block) => block.id === target.afterId)
    : blocks.length - 1;
  if (target.afterId && afterIndex < 0) {
    return null;
  }
  const insertionIndex = afterIndex < 0 ? blocks.length : afterIndex + 1;
  const nextBlocks = blocks.slice();
  nextBlocks.splice(insertionIndex, 0, uploadedBlock);
  return nextBlocks;
}

export function applyPendingMediaUpload(
  blocks: DescriptionBlock[],
  target: PendingMediaUploadTarget,
  uploaded: InlineMediaUpload,
  currentRevision: number
): DescriptionBlock[] | null {
  if (target.revision !== currentRevision) {
    return null;
  }
  return applyMediaUpload(blocks, target, uploaded);
}

function descAddBtnStyle(): React.CSSProperties {
  return {
    alignItems: "center",
    background: "rgba(255,255,255,.6)",
    border: `0.5px solid ${COLOR.rule2}`,
    borderRadius: 999,
    color: COLOR.ink3,
    cursor: "pointer",
    display: "flex",
    fontSize: 11.5,
    gap: 5,
    height: 26,
    padding: "0 10px",
  };
}

function DescriptionBlockRow({
  block,
  dragging,
  mediaUploadBusy,
  onChange,
  onChangeType,
  onDelete,
  onDropBlock,
  onEnter,
  onFocused,
  onInsertBelow,
  onInsertMedia,
  onSlash,
  onStartDrag,
  placeholder: placeholderOverride,
  shouldFocus,
  showSlashMenu,
}: {
  block: TextDescriptionBlock;
  dragging: boolean;
  mediaUploadBusy: boolean;
  onChange: (text: string) => void;
  onChangeType: (type: DescriptionBlockType) => void;
  onDelete: () => void;
  onDropBlock: () => void;
  onEnter: () => void;
  onFocused: () => void;
  onInsertBelow: (type: DescriptionBlockType) => void;
  onInsertMedia: () => void;
  onSlash: () => void;
  onStartDrag: () => void;
  placeholder?: string;
  shouldFocus: boolean;
  showSlashMenu: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current && ref.current.innerText !== block.text) {
      ref.current.innerText = block.text;
    }
  }, [block.text]);

  useEffect(() => {
    if (!(shouldFocus && ref.current)) {
      return;
    }
    ref.current.focus();
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(ref.current);
    range.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(range);
    onFocused();
  }, [onFocused, shouldFocus]);

  let placeholder = placeholderOverride ?? "Write your message…";
  if (block.type === "h") {
    placeholder = "Section heading…";
  } else if (block.type === "l") {
    placeholder = "A point, a perk, a detail…";
  }

  const contentStyle: React.CSSProperties = (() => {
    if (block.type === "h") {
      return {
        color: COLOR.ink,
        fontFamily: SERIF,
        fontSize: 26,
        fontWeight: 400,
        letterSpacing: "-0.012em",
        lineHeight: 1.15,
        minHeight: 28,
        outline: "none",
      };
    }
    if (block.type === "l") {
      return {
        color: COLOR.ink2,
        fontSize: 15.5,
        lineHeight: 1.6,
        minHeight: 24,
        outline: "none",
      };
    }
    return {
      color: COLOR.ink2,
      fontSize: 15.5,
      lineHeight: 1.55,
      minHeight: 24,
      outline: "none",
    };
  })();
  const placeholderStyle: React.CSSProperties = {
    ...contentStyle,
    color: "rgb(203 213 225)",
    fontStyle: "italic",
    left: block.type === "l" ? 20 : 0,
    pointerEvents: "none",
    position: "absolute",
    right: 0,
    top: 0,
  };

  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: drop target wraps semantic editable text
    // biome-ignore lint/a11y/noStaticElementInteractions: see above
    <div
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        onDropBlock();
      }}
      style={{
        display: "flex",
        gap: 12,
        opacity: dragging ? 0.35 : 1,
        padding: block.type === "h" ? "16px 0 8px" : "8px 0",
        position: "relative",
        transition: "opacity .15s",
      }}
    >
      <button
        aria-label="Drag block"
        draggable
        onDragStart={onStartDrag}
        style={{
          alignItems: "flex-start",
          background: "transparent",
          border: 0,
          color: COLOR.ink4,
          cursor: "grab",
          display: "flex",
          flexShrink: 0,
          justifyContent: "center",
          opacity: dragging ? 1 : undefined,
          paddingTop: 8,
          width: 24,
        }}
        type="button"
      >
        <GripVertical size={13} />
      </button>
      <div style={{ flex: 1, minWidth: 0, position: "relative" }}>
        {block.type === "l" && (
          <span
            aria-hidden
            style={{
              background: COLOR.claret,
              height: 1,
              left: 0,
              position: "absolute",
              top: 16,
              width: 8,
            }}
          />
        )}
        {block.text.length === 0 && (
          <span aria-hidden style={placeholderStyle}>
            {placeholder}
          </span>
        )}
        {/* biome-ignore lint/a11y/useSemanticElements: contentEditable maintains the document editing UX */}
        <div
          aria-label={placeholder}
          contentEditable
          onInput={(event) => onChange(event.currentTarget.innerText)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onEnter();
              return;
            }
            if (event.key === "/") {
              event.preventDefault();
              onSlash();
            }
          }}
          ref={ref}
          role="textbox"
          style={{ ...contentStyle, paddingLeft: block.type === "l" ? 20 : 0 }}
          suppressContentEditableWarning
          tabIndex={0}
        />
        {showSlashMenu && (
          <div
            style={{
              background: "white",
              border: `0.5px solid ${COLOR.rule2}`,
              borderRadius: 12,
              boxShadow: "0 12px 24px rgba(0,0,0,.10)",
              left: 0,
              marginTop: 4,
              overflow: "hidden",
              padding: "4px 0",
              position: "absolute",
              top: "100%",
              width: 220,
              zIndex: 30,
            }}
          >
            {[
              { icon: Heading1, label: "Heading", type: "h" as const },
              { icon: Pilcrow, label: "Paragraph", type: "p" as const },
              { icon: List, label: "Bullet", type: "l" as const },
            ].map(({ icon: Icon, label, type }) => (
              <button
                key={type}
                onClick={() => onChangeType(type)}
                style={{
                  alignItems: "center",
                  background: "transparent",
                  border: 0,
                  color: COLOR.ink2,
                  cursor: "pointer",
                  display: "flex",
                  fontSize: 13,
                  gap: 8,
                  padding: "8px 12px",
                  textAlign: "left",
                  width: "100%",
                }}
                type="button"
              >
                <Icon size={13} />
                {label}
              </button>
            ))}
            <div
              style={{
                background: COLOR.rule,
                height: 1,
                margin: "4px 0",
              }}
            />
            <button
              onClick={() => onInsertBelow("p")}
              style={{
                alignItems: "center",
                background: "transparent",
                border: 0,
                color: COLOR.ink2,
                cursor: "pointer",
                display: "flex",
                fontSize: 13,
                gap: 8,
                padding: "8px 12px",
                textAlign: "left",
                width: "100%",
              }}
              type="button"
            >
              <Plus size={13} />
              New paragraph below
            </button>
            <button
              disabled={mediaUploadBusy}
              onClick={onInsertMedia}
              style={{
                alignItems: "center",
                background: "transparent",
                border: 0,
                color: COLOR.ink2,
                cursor: "pointer",
                display: "flex",
                fontSize: 13,
                gap: 8,
                padding: "8px 12px",
                textAlign: "left",
                width: "100%",
              }}
              type="button"
            >
              <ImagePlus size={13} />
              Media
            </button>
            <button
              onClick={onDelete}
              style={{
                alignItems: "center",
                background: "transparent",
                border: 0,
                color: COLOR.claret,
                cursor: "pointer",
                display: "flex",
                fontSize: 13,
                gap: 8,
                padding: "8px 12px",
                textAlign: "left",
                width: "100%",
              }}
              type="button"
            >
              <Trash2 size={13} />
              Delete block
            </button>
          </div>
        )}
      </div>
      <button
        aria-label="Delete block"
        onClick={onDelete}
        style={{
          alignItems: "center",
          background: "transparent",
          border: 0,
          borderRadius: 6,
          color: COLOR.ink4,
          cursor: "pointer",
          display: "grid",
          flexShrink: 0,
          height: 28,
          justifyItems: "center",
          marginTop: 4,
          placeItems: "center",
          width: 28,
        }}
        type="button"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}

function mediaActionStyle(): React.CSSProperties {
  return {
    alignItems: "center",
    background: "white",
    border: `0.5px solid ${COLOR.rule2}`,
    borderRadius: 999,
    color: COLOR.ink3,
    cursor: "pointer",
    display: "inline-flex",
    fontSize: 11.5,
    gap: 5,
    height: 28,
    padding: "0 10px",
  };
}

function mediaFieldStyle(): React.CSSProperties {
  return {
    background: "rgba(255,255,255,.72)",
    border: `0.5px solid ${COLOR.rule2}`,
    borderRadius: 8,
    color: COLOR.ink2,
    fontSize: 13,
    minHeight: 34,
    outline: "none",
    padding: "7px 9px",
    width: "100%",
  };
}

function MediaBlockRow({
  block,
  canMoveDown,
  canMoveUp,
  dragging,
  isReplacing,
  mediaUploadBusy,
  onChange,
  onDelete,
  onDropBlock,
  onMoveDown,
  onMoveUp,
  onReplace,
  onStartDrag,
}: {
  block: MediaDescriptionBlock;
  canMoveDown: boolean;
  canMoveUp: boolean;
  dragging: boolean;
  isReplacing: boolean;
  mediaUploadBusy: boolean;
  onChange: (change: Pick<MediaDescriptionBlock, "alt" | "caption">) => void;
  onDelete: () => void;
  onDropBlock: () => void;
  onMoveDown: () => void;
  onMoveUp: () => void;
  onReplace: () => void;
  onStartDrag: () => void;
}) {
  const fileLabel = block.fileName || "Attachment";

  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: drop target wraps semantic media controls
    // biome-ignore lint/a11y/noStaticElementInteractions: see above
    <div
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        onDropBlock();
      }}
      style={{
        display: "flex",
        gap: 12,
        opacity: dragging ? 0.35 : 1,
        padding: "10px 0",
        transition: "opacity .15s",
      }}
    >
      <div
        style={{
          alignItems: "center",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          gap: 2,
          paddingTop: 8,
          width: 24,
        }}
      >
        <button
          aria-label="Drag media block"
          draggable
          onDragStart={onStartDrag}
          style={{
            alignItems: "center",
            background: "transparent",
            border: 0,
            color: COLOR.ink4,
            cursor: "grab",
            display: "flex",
            height: 24,
            justifyContent: "center",
            padding: 0,
            width: 24,
          }}
          type="button"
        >
          <GripVertical size={13} />
        </button>
        <button
          aria-label="Move media block up"
          disabled={!canMoveUp}
          onClick={onMoveUp}
          style={{
            background: "transparent",
            border: 0,
            color: COLOR.ink4,
            cursor: "pointer",
            display: "grid",
            height: 20,
            placeItems: "center",
            width: 24,
          }}
          type="button"
        >
          <ArrowUp size={11} />
        </button>
        <button
          aria-label="Move media block down"
          disabled={!canMoveDown}
          onClick={onMoveDown}
          style={{
            background: "transparent",
            border: 0,
            color: COLOR.ink4,
            cursor: "pointer",
            display: "grid",
            height: 20,
            placeItems: "center",
            width: 24,
          }}
          type="button"
        >
          <ArrowDown size={11} />
        </button>
      </div>
      <figure
        style={{
          background: "rgba(255,255,255,.46)",
          border: `0.5px solid ${COLOR.rule2}`,
          borderRadius: 12,
          flex: 1,
          margin: 0,
          minWidth: 0,
          overflow: "hidden",
          padding: 10,
        }}
      >
        {block.mediaKind === "image" && (
          <div
            style={{
              aspectRatio: "16 / 9",
              background: COLOR.rule,
              borderRadius: 8,
              overflow: "hidden",
              position: "relative",
              width: "100%",
            }}
          >
            <Image
              alt={block.alt}
              fill
              sizes="(max-width: 768px) 100vw, 720px"
              src={block.url}
              style={{ objectFit: "contain" }}
              unoptimized
            />
          </div>
        )}
        {block.mediaKind === "video" && (
          // biome-ignore lint/a11y/useMediaCaption: uploads do not include a separate timed-text track
          <video
            aria-label={block.caption || fileLabel}
            controls
            preload="metadata"
            src={block.url}
            style={{ borderRadius: 8, display: "block", width: "100%" }}
          />
        )}
        {block.mediaKind === "audio" && (
          // biome-ignore lint/a11y/useMediaCaption: uploads do not include a separate timed-text track
          <audio
            aria-label={block.caption || fileLabel}
            controls
            preload="metadata"
            src={block.url}
            style={{ display: "block", width: "100%" }}
          />
        )}
        {block.mediaKind === "file" && (
          <a
            aria-label={`Download ${fileLabel}`}
            download={block.fileName || undefined}
            href={block.url}
            rel="noopener noreferrer"
            style={{
              alignItems: "center",
              background: "white",
              border: `0.5px solid ${COLOR.rule}`,
              borderRadius: 8,
              color: COLOR.ink2,
              display: "flex",
              fontSize: 14,
              gap: 10,
              minHeight: 54,
              padding: "10px 12px",
              textDecoration: "none",
            }}
            target="_blank"
          >
            <FileText aria-hidden size={20} />
            <span style={{ overflowWrap: "anywhere" }}>{fileLabel}</span>
          </a>
        )}

        <div
          style={{
            display: "grid",
            gap: 8,
            gridTemplateColumns:
              block.mediaKind === "image" ? "repeat(2, minmax(0, 1fr))" : "1fr",
            marginTop: 10,
          }}
        >
          {block.mediaKind === "image" && (
            <label
              style={{
                color: COLOR.ink3,
                display: "grid",
                fontSize: 11.5,
                gap: 4,
              }}
            >
              Alt text
              <input
                aria-label="Image alt text"
                onChange={(event) =>
                  onChange({
                    alt: event.currentTarget.value,
                    caption: block.caption,
                  })
                }
                placeholder="Describe the image"
                style={mediaFieldStyle()}
                type="text"
                value={block.alt}
              />
            </label>
          )}
          <label
            style={{
              color: COLOR.ink3,
              display: "grid",
              fontSize: 11.5,
              gap: 4,
            }}
          >
            Caption
            <input
              aria-label="Media caption"
              onChange={(event) =>
                onChange({ alt: block.alt, caption: event.currentTarget.value })
              }
              placeholder="Optional caption"
              style={mediaFieldStyle()}
              type="text"
              value={block.caption}
            />
          </label>
        </div>
        <figcaption
          style={{
            alignItems: "center",
            display: "flex",
            gap: 8,
            justifyContent: "space-between",
            marginTop: 10,
          }}
        >
          <span
            style={{
              color: COLOR.ink4,
              fontSize: 11,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={fileLabel}
          >
            {fileLabel}
          </span>
          <span style={{ display: "flex", flexShrink: 0, gap: 6 }}>
            <button
              disabled={mediaUploadBusy}
              onClick={onReplace}
              style={mediaActionStyle()}
              type="button"
            >
              {isReplacing ? (
                <>
                  <Loader2 aria-hidden size={11} />
                  Uploading…
                </>
              ) : (
                "Replace"
              )}
            </button>
            <button
              disabled={isReplacing}
              onClick={onDelete}
              style={{ ...mediaActionStyle(), color: COLOR.claret }}
              type="button"
            >
              Remove
            </button>
          </span>
        </figcaption>
      </figure>
    </div>
  );
}

export interface DescriptionBlockEditorProps {
  onChange: (value: string) => void;
  placeholder?: string;
  uploadMedia?: (file: File) => Promise<InlineMediaUpload>;
  value: string;
}

export function DescriptionBlockEditor({
  onChange,
  placeholder,
  uploadMedia = uploadInlineMedia,
  value,
}: DescriptionBlockEditorProps) {
  const [blocks, setBlocks] = useState(() => htmlToDescriptionBlocks(value));
  const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null);
  const [focusBlockId, setFocusBlockId] = useState<string | null>(null);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [mediaUploadError, setMediaUploadError] = useState<string | null>(null);
  const [mediaUploadTarget, setMediaUploadTarget] =
    useState<PendingMediaUploadTarget | null>(null);
  const [slashBlockId, setSlashBlockId] = useState<string | null>(null);
  const blocksRef = useRef(blocks);
  const documentRevisionRef = useRef(0);
  const lastCommittedValueRef = useRef(value);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const mediaUploadTargetRef = useRef<PendingMediaUploadTarget | null>(null);
  const observedEditorContextRef = useRef({ placeholder, value });

  useLayoutEffect(() => {
    const observed = observedEditorContextRef.current;
    const contextChanged = placeholder !== observed.placeholder;
    const valueChanged = value !== observed.value;
    observedEditorContextRef.current = { placeholder, value };
    if (
      contextChanged ||
      (valueChanged && value !== lastCommittedValueRef.current)
    ) {
      documentRevisionRef.current += 1;
    }
  }, [placeholder, value]);

  useEffect(() => {
    if (value === lastCommittedValueRef.current) {
      return;
    }
    lastCommittedValueRef.current = value;
    const nextBlocks = htmlToDescriptionBlocks(value);
    blocksRef.current = nextBlocks;
    setBlocks(nextBlocks);
  }, [value]);

  function commit(nextBlocks: DescriptionBlock[]) {
    const nextValue = descriptionBlocksToHtml(nextBlocks);
    lastCommittedValueRef.current = nextValue;
    blocksRef.current = nextBlocks;
    setBlocks(nextBlocks);
    onChange(nextValue);
  }

  function updateBlock(id: string, text: string) {
    commit(
      blocks.map((block) =>
        block.id === id && isTextDescriptionBlock(block)
          ? { ...block, text }
          : block
      )
    );
  }

  function updateMediaBlock(
    id: string,
    change: Pick<MediaDescriptionBlock, "alt" | "caption">
  ) {
    commit(
      blocks.map((block) =>
        block.id === id && block.type === "media"
          ? { ...block, ...change }
          : block
      )
    );
  }

  function insertBlock(afterId: string, type: DescriptionBlockType = "p") {
    const index = blocks.findIndex((block) => block.id === afterId);
    const block = newBlock(type);
    const nextBlocks = blocks.slice();
    nextBlocks.splice(index + 1, 0, block);
    setFocusBlockId(block.id);
    setSlashBlockId(null);
    commit(nextBlocks);
  }

  function addBlock(type: DescriptionBlockType) {
    const block = newBlock(type);
    setFocusBlockId(block.id);
    setSlashBlockId(null);
    commit([...blocks, block]);
  }

  function changeBlockType(id: string, type: DescriptionBlockType) {
    setFocusBlockId(id);
    setSlashBlockId(null);
    commit(
      blocks.map((block) =>
        block.id === id && isTextDescriptionBlock(block)
          ? { ...block, type }
          : block
      )
    );
  }

  function deleteBlock(id: string) {
    setSlashBlockId(null);
    if (blocks.length === 1) {
      setFocusBlockId(id);
      const [first] = blocks;
      commit([
        first && isTextDescriptionBlock(first)
          ? { ...first, text: "", type: "p" }
          : newBlock("p"),
      ]);
      return;
    }

    const index = blocks.findIndex((block) => block.id === id);
    const nextBlocks = blocks.filter((block) => block.id !== id);
    const nextFocus = nextBlocks[Math.max(0, index - 1)]?.id ?? null;
    setFocusBlockId(nextFocus);
    commit(nextBlocks);
  }

  function moveBlock(sourceId: string, targetId: string) {
    if (sourceId === targetId) {
      return;
    }
    const sourceIndex = blocks.findIndex((block) => block.id === sourceId);
    const targetIndex = blocks.findIndex((block) => block.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) {
      return;
    }
    const nextBlocks = blocks.slice();
    const [moved] = nextBlocks.splice(sourceIndex, 1);
    if (!moved) {
      return;
    }
    nextBlocks.splice(targetIndex, 0, moved);
    setDraggingBlockId(null);
    setFocusBlockId(sourceId);
    commit(nextBlocks);
  }

  function moveBlockByOffset(id: string, offset: -1 | 1) {
    const index = blocks.findIndex((block) => block.id === id);
    const targetIndex = index + offset;
    if (index < 0 || targetIndex < 0 || targetIndex >= blocks.length) {
      return;
    }
    const nextBlocks = blocks.slice();
    const [moved] = nextBlocks.splice(index, 1);
    if (!moved) {
      return;
    }
    nextBlocks.splice(targetIndex, 0, moved);
    commit(nextBlocks);
  }

  function openMediaPicker(target: MediaUploadTarget) {
    if (isUploadingMedia) {
      return;
    }
    setSlashBlockId(null);
    setMediaUploadError(null);
    const pendingTarget = {
      ...target,
      revision: documentRevisionRef.current,
    };
    mediaUploadTargetRef.current = pendingTarget;
    setMediaUploadTarget(pendingTarget);
    if (mediaInputRef.current) {
      mediaInputRef.current.value = "";
      mediaInputRef.current.click();
    }
  }

  async function handleMediaInputChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.currentTarget.files?.[0];
    const target = mediaUploadTargetRef.current;
    event.currentTarget.value = "";
    if (!(file && target)) {
      return;
    }

    setIsUploadingMedia(true);
    try {
      const uploaded = await uploadMedia(file);
      const currentBlocks = blocksRef.current;
      const nextBlocks = applyPendingMediaUpload(
        currentBlocks,
        target,
        uploaded,
        documentRevisionRef.current
      );
      if (nextBlocks) {
        commit(nextBlocks);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed";
      setMediaUploadError(message);
      toast.error(message);
    } finally {
      setIsUploadingMedia(false);
      mediaUploadTargetRef.current = null;
      setMediaUploadTarget(null);
    }
  }

  return (
    <div
      aria-busy={isUploadingMedia}
      style={{ display: "flex", flexDirection: "column", gap: 4 }}
    >
      <input
        accept={INLINE_MEDIA_ACCEPT}
        aria-label="Upload media"
        disabled={isUploadingMedia}
        onChange={handleMediaInputChange}
        ref={mediaInputRef}
        style={{ display: "none" }}
        type="file"
      />
      {mediaUploadError && (
        <p
          role="alert"
          style={{ color: COLOR.claret, fontSize: 12, margin: "4px 36px" }}
        >
          {mediaUploadError}
        </p>
      )}
      {blocks.map((block, index) =>
        isTextDescriptionBlock(block) ? (
          <DescriptionBlockRow
            block={block}
            dragging={draggingBlockId === block.id}
            key={block.id}
            mediaUploadBusy={isUploadingMedia}
            onChange={(text) => updateBlock(block.id, text)}
            onChangeType={(type) => changeBlockType(block.id, type)}
            onDelete={() => deleteBlock(block.id)}
            onDropBlock={() => {
              if (draggingBlockId) {
                moveBlock(draggingBlockId, block.id);
              }
            }}
            onEnter={() => insertBlock(block.id)}
            onFocused={() => setFocusBlockId(null)}
            onInsertBelow={(type) => insertBlock(block.id, type)}
            onInsertMedia={() =>
              openMediaPicker({ afterId: block.id, kind: "insert" })
            }
            onSlash={() => setSlashBlockId(block.id)}
            onStartDrag={() => setDraggingBlockId(block.id)}
            placeholder={placeholder}
            shouldFocus={focusBlockId === block.id}
            showSlashMenu={slashBlockId === block.id}
          />
        ) : (
          <MediaBlockRow
            block={block}
            canMoveDown={index < blocks.length - 1}
            canMoveUp={index > 0}
            dragging={draggingBlockId === block.id}
            isReplacing={
              isUploadingMedia &&
              mediaUploadTarget?.kind === "replace" &&
              mediaUploadTarget.blockId === block.id
            }
            key={block.id}
            mediaUploadBusy={isUploadingMedia}
            onChange={(change) => updateMediaBlock(block.id, change)}
            onDelete={() => deleteBlock(block.id)}
            onDropBlock={() => {
              if (draggingBlockId) {
                moveBlock(draggingBlockId, block.id);
              }
            }}
            onMoveDown={() => moveBlockByOffset(block.id, 1)}
            onMoveUp={() => moveBlockByOffset(block.id, -1)}
            onReplace={() =>
              openMediaPicker({ blockId: block.id, kind: "replace" })
            }
            onStartDrag={() => setDraggingBlockId(block.id)}
          />
        )
      )}
      <div
        style={{
          alignItems: "center",
          display: "flex",
          gap: 8,
          margin: "14px 0 0",
          opacity: 0.85,
          padding: "6px 0",
        }}
      >
        <div style={{ background: COLOR.rule, flex: 1, height: 0.5 }} />
        <button
          onClick={() => addBlock("h")}
          style={descAddBtnStyle()}
          type="button"
        >
          <Heading1 size={11} />
          Heading
        </button>
        <button
          onClick={() => addBlock("p")}
          style={descAddBtnStyle()}
          type="button"
        >
          <Pilcrow size={11} />
          Paragraph
        </button>
        <button
          onClick={() => addBlock("l")}
          style={descAddBtnStyle()}
          type="button"
        >
          <List size={11} />
          Bullet
        </button>
        <button
          disabled={isUploadingMedia}
          onClick={() => openMediaPicker({ afterId: null, kind: "insert" })}
          style={descAddBtnStyle()}
          type="button"
        >
          {isUploadingMedia ? (
            <>
              <Loader2 aria-hidden size={11} />
              Uploading…
            </>
          ) : (
            <>
              <ImagePlus size={11} />
              Media
            </>
          )}
        </button>
        <div style={{ background: COLOR.rule, flex: 1, height: 0.5 }} />
      </div>
    </div>
  );
}

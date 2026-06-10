"use client";

import {
  GripVertical,
  Heading1,
  List,
  Pilcrow,
  Plus,
  Trash2,
} from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";

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
  newBlock,
} from "./description-blocks";

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
  onChange,
  onChangeType,
  onDelete,
  onDropBlock,
  onEnter,
  onFocused,
  onInsertBelow,
  onSlash,
  onStartDrag,
  placeholder: placeholderOverride,
  shouldFocus,
  showSlashMenu,
}: {
  block: DescriptionBlock;
  dragging: boolean;
  onChange: (text: string) => void;
  onChangeType: (type: DescriptionBlockType) => void;
  onDelete: () => void;
  onDropBlock: () => void;
  onEnter: () => void;
  onFocused: () => void;
  onInsertBelow: (type: DescriptionBlockType) => void;
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
        {/* biome-ignore lint/a11y/useSemanticElements: contentEditable maintains the document editing UX */}
        <div
          aria-label={placeholder}
          contentEditable
          data-placeholder={placeholder}
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

export interface DescriptionBlockEditorProps {
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
}

export function DescriptionBlockEditor({
  onChange,
  placeholder,
  value,
}: DescriptionBlockEditorProps) {
  const [blocks, setBlocks] = useState(() => htmlToDescriptionBlocks(value));
  const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null);
  const [focusBlockId, setFocusBlockId] = useState<string | null>(null);
  const [slashBlockId, setSlashBlockId] = useState<string | null>(null);
  const lastCommittedValueRef = useRef(value);

  useEffect(() => {
    if (value === lastCommittedValueRef.current) {
      return;
    }
    lastCommittedValueRef.current = value;
    setBlocks(htmlToDescriptionBlocks(value));
  }, [value]);

  function commit(nextBlocks: DescriptionBlock[]) {
    const nextValue = descriptionBlocksToHtml(nextBlocks);
    lastCommittedValueRef.current = nextValue;
    setBlocks(nextBlocks);
    onChange(nextValue);
  }

  function updateBlock(id: string, text: string) {
    commit(
      blocks.map((block) => (block.id === id ? { ...block, text } : block))
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
      blocks.map((block) => (block.id === id ? { ...block, type } : block))
    );
  }

  function deleteBlock(id: string) {
    setSlashBlockId(null);
    if (blocks.length === 1) {
      setFocusBlockId(id);
      commit([{ ...blocks[0], text: "", type: "p" }]);
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {blocks.map((block) => (
        <DescriptionBlockRow
          block={block}
          dragging={draggingBlockId === block.id}
          key={block.id}
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
          onSlash={() => setSlashBlockId(block.id)}
          onStartDrag={() => setDraggingBlockId(block.id)}
          placeholder={placeholder}
          shouldFocus={focusBlockId === block.id}
          showSlashMenu={slashBlockId === block.id}
        />
      ))}
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
        <div style={{ background: COLOR.rule, flex: 1, height: 0.5 }} />
      </div>
    </div>
  );
}

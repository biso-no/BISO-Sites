"use client";

import type {
  Campus,
  ContentTranslations,
  Departments,
  WebshopProducts,
} from "@repo/api/types/appwrite";
import {
  ArrowLeft,
  Check,
  GripVertical,
  Heading1,
  Image as ImageIcon,
  List,
  Lock,
  Pilcrow,
  Plus,
  Save,
  Send,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { createProduct, updateProduct } from "../../../_actions/shop";
import { uploadMediaFile } from "../../../_actions/upload";

/* -------------------------------------------------------------------------- */
/*                              Types                                          */
/* -------------------------------------------------------------------------- */

type ProductWithTranslations = WebshopProducts & {
  translation_refs: ContentTranslations[];
};

interface ProductVariant {
  id: string;
  name: string;
  price: number;
  stock: number;
  type: string;
}

interface ShopStudioEditorProps {
  allowedDepartmentIds?: string[];
  campuses: Campus[];
  canChangeCampus?: boolean;
  defaultCampusId?: string;
  departments: Departments[];
  isNew: boolean;
  product: ProductWithTranslations | null;
}

type DescriptionBlockType = "h" | "l" | "p";

interface DescriptionBlock {
  id: string;
  text: string;
  type: DescriptionBlockType;
}

type LocaleCode = "en" | "no";

/* -------------------------------------------------------------------------- */
/*                              Brand + constants                              */
/* -------------------------------------------------------------------------- */

const BRAND = {
  claret: "#6b1e1e",
  gold: "#b08a3e",
  ink: "#1a1814",
  ink2: "#3a342a",
  ink3: "#6b6357",
  ink4: "#9c9385",
  leaf: "#2f5d3a",
  paper: "#faf7f2",
  paper2: "#f3eee5",
  paper3: "#ede6d8",
  rule: "#e5dcca",
  rule2: "#d8cdb6",
  sky: "#2a4a7a",
} as const;

const STEPS = [
  "Essentials",
  "Description",
  "Pricing & Variants",
  "Photos & Visibility",
  "Review",
] as const;

const PRODUCT_CATEGORIES = [
  { id: "apparel", name: "Apparel", crest: "A" },
  { id: "tickets", name: "Tickets", crest: "T" },
  { id: "drinkware", name: "Drinkware", crest: "D" },
  { id: "stationery", name: "Stationery", crest: "St" },
  { id: "stickers", name: "Stickers", crest: "Sk" },
  { id: "books", name: "Books", crest: "B" },
  { id: "other", name: "Other", crest: "O" },
] as const;

const SHOP_TAG_OPTIONS = [
  "Welcome week",
  "Bundle",
  "Limited edition",
  "Members only",
  "New arrival",
  "Sale",
  "Sustainable",
  "Best value",
] as const;

const COVER_PATTERNS = [
  { id: "dotted", label: "Dotted" },
  { id: "linear", label: "Linear" },
  { id: "concentric", label: "Concentric" },
  { id: "wave", label: "Wave" },
  { id: "grid", label: "Grid" },
] as const;

const SERIF_STACK =
  '"Cormorant Garamond", "EB Garamond", "Times New Roman", Georgia, serif';
const MONO_STACK =
  '"IBM Plex Mono", "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';

/* -------------------------------------------------------------------------- */
/*                                  Utilities                                  */
/* -------------------------------------------------------------------------- */

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function newBlock(type: DescriptionBlockType, text = ""): DescriptionBlock {
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    text,
    type,
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function htmlToDescriptionBlocks(value: string): DescriptionBlock[] {
  const blocks: DescriptionBlock[] = [];
  const pattern = /<(h[1-6]|p|li)[^>]*>(.*?)<\/\1>/gis;
  let match = pattern.exec(value);

  while (match) {
    const [, tag, rawText] = match;
    const text = decodeHtml(stripHtml(rawText ?? ""));
    let type: DescriptionBlockType = "p";
    if (tag?.startsWith("h")) {
      type = "h";
    } else if (tag === "li") {
      type = "l";
    }
    blocks.push(newBlock(type, text));
    match = pattern.exec(value);
  }

  if (blocks.length > 0) {
    return blocks;
  }

  const plain = stripHtml(value);
  return [newBlock("p", plain)];
}

function descriptionBlocksToHtml(blocks: DescriptionBlock[]): string {
  const html: string[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length === 0) {
      return;
    }
    html.push(`<ul>${listItems.join("")}</ul>`);
    listItems = [];
  };

  for (const block of blocks) {
    const text = escapeHtml(block.text.trim());
    if (!text) {
      continue;
    }
    if (block.type === "l") {
      listItems.push(`<li>${text}</li>`);
      continue;
    }
    flushList();
    html.push(block.type === "h" ? `<h3>${text}</h3>` : `<p>${text}</p>`);
  }

  flushList();
  return html.join("");
}

/* -------------------------------------------------------------------------- */
/*                            Cover pattern utilities                          */
/* -------------------------------------------------------------------------- */

function shopCoverBackground(pattern: string | null): string {
  switch (pattern) {
    case "linear":
      return "linear-gradient(135deg, #2a4a7a 0%, #15263c 100%)";
    case "concentric":
      return "linear-gradient(135deg, #2f5d3a 0%, #1a3422 100%)";
    case "wave":
      return "linear-gradient(135deg, #b08a3e 0%, #6a5118 100%)";
    case "grid":
      return "linear-gradient(180deg, #29261b 0%, #100e09 100%)";
    default:
      return "linear-gradient(135deg, #6b1e1e 0%, #2a1010 100%)";
  }
}

function shopCoverPatternIndex(pattern: string | null): number {
  switch (pattern) {
    case "linear":
      return 2;
    case "concentric":
      return 3;
    case "wave":
      return 4;
    case "grid":
      return 5;
    default:
      return 1;
  }
}

function ShopCoverPattern({ which }: { which: number }) {
  const svgStyle: React.CSSProperties = {
    height: "100%",
    inset: 0,
    opacity: 0.3,
    position: "absolute",
    width: "100%",
  };

  if (which === 2) {
    return (
      <svg
        aria-hidden
        preserveAspectRatio="none"
        style={svgStyle}
        viewBox="0 0 200 130"
      >
        <title>Linear cover pattern</title>
        {Array.from({ length: 8 }).map((_, i) => (
          <line
            key={`shop-line-${i}`}
            stroke="white"
            strokeWidth="0.5"
            x1="0"
            x2="200"
            y1={i * 18}
            y2={i * 18 - 30}
          />
        ))}
      </svg>
    );
  }
  if (which === 3) {
    return (
      <svg
        aria-hidden
        preserveAspectRatio="none"
        style={svgStyle}
        viewBox="0 0 200 130"
      >
        <title>Concentric cover pattern</title>
        {[80, 60, 40, 20].map((r) => (
          <circle
            cx="40"
            cy="100"
            fill="none"
            key={`shop-circ-${r}`}
            r={r}
            stroke="white"
            strokeWidth="0.5"
          />
        ))}
      </svg>
    );
  }
  if (which === 4) {
    return (
      <svg
        aria-hidden
        preserveAspectRatio="none"
        style={svgStyle}
        viewBox="0 0 200 130"
      >
        <title>Wave cover pattern</title>
        {Array.from({ length: 10 }).map((_, i) => (
          <path
            d={`M0,${60 + i * 8} Q50,${40 + i * 8} 100,${60 + i * 8} T200,${60 + i * 8}`}
            fill="none"
            key={`shop-wave-${i}`}
            opacity={1 - i * 0.06}
            stroke="white"
            strokeWidth="0.4"
          />
        ))}
      </svg>
    );
  }
  if (which === 5) {
    return (
      <svg
        aria-hidden
        preserveAspectRatio="none"
        style={svgStyle}
        viewBox="0 0 200 130"
      >
        <title>Grid cover pattern</title>
        <defs>
          <pattern
            height="22"
            id="shop-grid"
            patternUnits="userSpaceOnUse"
            width="22"
          >
            <path d="M0 11h22M11 0v22" stroke="white" strokeWidth="0.3" />
          </pattern>
        </defs>
        <rect fill="url(#shop-grid)" height="130" width="200" />
      </svg>
    );
  }
  return (
    <svg
      aria-hidden
      preserveAspectRatio="none"
      style={svgStyle}
      viewBox="0 0 200 130"
    >
      <title>Dotted cover pattern</title>
      <defs>
        <pattern
          height="14"
          id="shop-dots"
          patternUnits="userSpaceOnUse"
          width="14"
        >
          <circle cx="2" cy="2" fill="white" r="1" />
        </pattern>
      </defs>
      <rect fill="url(#shop-dots)" height="130" width="200" />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  StepRail                                  */
/* -------------------------------------------------------------------------- */

function StepRail({ active }: { active: number }) {
  return (
    <div
      style={{
        alignItems: "center",
        display: "flex",
        gap: 4,
        paddingBottom: 16,
      }}
    >
      {STEPS.map((name, index) => {
        const isActive = index === active;
        const isDone = index < active;

        let circBg: string = BRAND.paper3;
        if (isActive) {
          circBg = BRAND.ink;
        } else if (isDone) {
          circBg = BRAND.leaf;
        }

        let circColor: string = BRAND.ink4;
        if (isActive || isDone) {
          circColor = "white";
        }

        let circBorderColor: string = BRAND.rule2;
        if (isActive) {
          circBorderColor = BRAND.ink;
        } else if (isDone) {
          circBorderColor = BRAND.leaf;
        }

        return (
          <div
            key={name}
            style={{ alignItems: "center", display: "flex", flexShrink: 0 }}
          >
            {index > 0 && (
              <div
                style={{
                  background: BRAND.rule,
                  height: 1,
                  margin: "0 -2px",
                  width: 24,
                }}
              />
            )}
            <div
              style={{
                alignItems: "center",
                display: "flex",
                flexDirection: "column",
                gap: 5,
              }}
            >
              <span
                style={{
                  alignItems: "center",
                  background: circBg,
                  border: `1px solid ${circBorderColor}`,
                  borderRadius: "50%",
                  color: circColor,
                  display: "grid",
                  fontFamily: MONO_STACK,
                  fontSize: 10,
                  height: 22,
                  placeItems: "center",
                  width: 22,
                }}
              >
                {isDone ? <Check size={11} /> : index + 1}
              </span>
              <span
                style={{
                  color: isActive ? BRAND.ink : BRAND.ink4,
                  fontSize: 11,
                  fontWeight: isActive ? 500 : 400,
                  whiteSpace: "nowrap",
                }}
              >
                {name}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                LocaleTabs                                  */
/* -------------------------------------------------------------------------- */

function LocaleTabs({
  lang,
  onChange,
}: {
  lang: "en" | "no";
  onChange: (l: "en" | "no") => void;
}) {
  return (
    <div
      style={{
        background: BRAND.paper2,
        border: `0.5px solid ${BRAND.rule2}`,
        borderRadius: 8,
        display: "inline-flex",
        gap: 2,
        marginBottom: 12,
        padding: 3,
      }}
    >
      {(["no", "en"] as const).map((item) => {
        const on = lang === item;
        return (
          <button
            key={item}
            onClick={() => onChange(item)}
            style={{
              background: on ? "white" : "transparent",
              border: 0,
              borderRadius: 5,
              boxShadow: on ? "0 1px 2px rgba(0,0,0,.05)" : "none",
              color: on ? BRAND.ink : BRAND.ink4,
              cursor: "pointer",
              fontSize: 11,
              fontWeight: on ? 500 : 400,
              padding: "4px 14px",
            }}
            type="button"
          >
            {item === "no" ? "NO" : "EN"}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                FieldLabel                                  */
/* -------------------------------------------------------------------------- */

function FieldLabel({
  children,
  required,
}: {
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div
      style={{
        alignItems: "center",
        color: BRAND.ink3,
        display: "flex",
        fontSize: 11,
        fontWeight: 500,
        gap: 6,
        letterSpacing: ".05em",
        marginBottom: 6,
        textTransform: "uppercase",
      }}
    >
      {children}
      {required && (
        <span style={{ color: BRAND.claret, fontSize: 9, letterSpacing: 0 }}>
          ✱
        </span>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                ToggleCard                                  */
/* -------------------------------------------------------------------------- */

function ToggleCard({
  active,
  description,
  label,
  onClick,
}: {
  active: boolean;
  description: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? BRAND.ink : BRAND.paper2,
        border: `0.5px solid ${active ? BRAND.ink : BRAND.rule2}`,
        borderRadius: 10,
        color: active ? "white" : BRAND.ink,
        cursor: "pointer",
        flex: 1,
        padding: "14px 18px",
        position: "relative",
        textAlign: "left",
        transition: "background .12s, border-color .12s",
      }}
      type="button"
    >
      <b style={{ display: "block", fontSize: 13, fontWeight: 500 }}>{label}</b>
      <p
        style={{
          color: active ? "rgba(250,247,242,.7)" : BRAND.ink3,
          fontSize: 11.5,
          lineHeight: 1.45,
          margin: "6px 0 0",
        }}
      >
        {description}
      </p>
      {active && (
        <span
          style={{
            alignItems: "center",
            background: BRAND.leaf,
            border: `1px solid ${BRAND.leaf}`,
            borderRadius: "50%",
            color: "white",
            display: "grid",
            height: 18,
            placeItems: "center",
            position: "absolute",
            right: 12,
            top: 12,
            width: 18,
          }}
        >
          <Check size={11} />
        </span>
      )}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*                         ProductDescriptionBlockEditor                       */
/* -------------------------------------------------------------------------- */

function addBtnStyle(): React.CSSProperties {
  return {
    alignItems: "center",
    background: "rgba(255,255,255,.6)",
    border: `0.5px solid ${BRAND.rule2}`,
    borderRadius: 999,
    color: BRAND.ink3,
    cursor: "pointer",
    display: "flex",
    fontSize: 11.5,
    gap: 5,
    height: 26,
    padding: "0 10px",
  };
}

function ProductDescriptionBlockRow({
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

  let placeholder = "Write something about this product…";
  if (block.type === "h") {
    placeholder = "Section heading…";
  } else if (block.type === "l") {
    placeholder = "A feature, a material, a detail…";
  }

  const contentStyle: React.CSSProperties = (() => {
    if (block.type === "h") {
      return {
        color: BRAND.ink,
        fontFamily: SERIF_STACK,
        fontSize: 26,
        fontWeight: 400,
        letterSpacing: "-0.012em",
        lineHeight: 1.15,
        minHeight: 28,
        outline: "none",
      };
    }
    return {
      color: BRAND.ink2,
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
          color: BRAND.ink4,
          cursor: "grab",
          display: "flex",
          flexShrink: 0,
          justifyContent: "center",
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
              background: BRAND.claret,
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
              border: `0.5px solid ${BRAND.rule2}`,
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
                  color: BRAND.ink2,
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
              style={{ background: BRAND.rule, height: 1, margin: "4px 0" }}
            />
            <button
              onClick={() => onInsertBelow("p")}
              style={{
                alignItems: "center",
                background: "transparent",
                border: 0,
                color: BRAND.ink2,
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
                color: BRAND.claret,
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
          color: BRAND.ink4,
          cursor: "pointer",
          display: "grid",
          flexShrink: 0,
          height: 28,
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

function ProductDescriptionBlockEditor({
  blocks,
  onChange,
}: {
  blocks: DescriptionBlock[];
  onChange: (blocks: DescriptionBlock[]) => void;
}) {
  const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null);
  const [focusBlockId, setFocusBlockId] = useState<string | null>(null);
  const [slashBlockId, setSlashBlockId] = useState<string | null>(null);

  function updateBlock(id: string, text: string) {
    onChange(blocks.map((b) => (b.id === id ? { ...b, text } : b)));
  }

  function insertBlock(afterId: string, type: DescriptionBlockType = "p") {
    const idx = blocks.findIndex((b) => b.id === afterId);
    const block = newBlock(type);
    const next = blocks.slice();
    next.splice(idx + 1, 0, block);
    setFocusBlockId(block.id);
    setSlashBlockId(null);
    onChange(next);
  }

  function addBlock(type: DescriptionBlockType) {
    const block = newBlock(type);
    setFocusBlockId(block.id);
    setSlashBlockId(null);
    onChange([...blocks, block]);
  }

  function changeBlockType(id: string, type: DescriptionBlockType) {
    setFocusBlockId(id);
    setSlashBlockId(null);
    onChange(blocks.map((b) => (b.id === id ? { ...b, type } : b)));
  }

  function deleteBlock(id: string) {
    setSlashBlockId(null);
    if (blocks.length === 1) {
      setFocusBlockId(id);
      const first = blocks[0];
      if (first) {
        onChange([{ ...first, text: "", type: "p" }]);
      }
      return;
    }
    const idx = blocks.findIndex((b) => b.id === id);
    const next = blocks.filter((b) => b.id !== id);
    const nextFocus = next[Math.max(0, idx - 1)]?.id ?? null;
    setFocusBlockId(nextFocus);
    onChange(next);
  }

  function moveBlock(sourceId: string, targetId: string) {
    if (sourceId === targetId) {
      return;
    }
    const si = blocks.findIndex((b) => b.id === sourceId);
    const ti = blocks.findIndex((b) => b.id === targetId);
    if (si < 0 || ti < 0) {
      return;
    }
    const next = blocks.slice();
    const [moved] = next.splice(si, 1);
    if (!moved) {
      return;
    }
    next.splice(ti, 0, moved);
    setDraggingBlockId(null);
    setFocusBlockId(sourceId);
    onChange(next);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {blocks.map((block) => (
        <ProductDescriptionBlockRow
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
          padding: "6px 0",
        }}
      >
        <div style={{ background: BRAND.rule, flex: 1, height: 0.5 }} />
        <button
          onClick={() => addBlock("h")}
          style={addBtnStyle()}
          type="button"
        >
          <Heading1 size={11} />
          Heading
        </button>
        <button
          onClick={() => addBlock("p")}
          style={addBtnStyle()}
          type="button"
        >
          <Pilcrow size={11} />
          Paragraph
        </button>
        <button
          onClick={() => addBlock("l")}
          style={addBtnStyle()}
          type="button"
        >
          <List size={11} />
          Bullet
        </button>
        <div style={{ background: BRAND.rule, flex: 1, height: 0.5 }} />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  ImageSlot                                 */
/* -------------------------------------------------------------------------- */

function ImageSlot({
  index,
  isHero,
  onRemove,
  onUpload,
  url,
}: {
  index: number;
  isHero: boolean;
  onRemove: () => void;
  onUpload: (url: string) => void;
  url: string | null;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const formData = new FormData();
    formData.append("file", file);
    setUploading(true);
    const result = await uploadMediaFile(formData);
    setUploading(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    if (result.url) {
      onUpload(result.url);
    }
    if (event.target) {
      event.target.value = "";
    }
  }

  const slotStyle: React.CSSProperties = {
    background: BRAND.paper2,
    border: `1.5px dashed ${BRAND.rule2}`,
    borderRadius: 10,
    cursor: "pointer",
    gridRow: isHero ? "span 2" : undefined,
    minHeight: isHero ? 200 : 90,
    overflow: "hidden",
    position: "relative",
  };

  if (url) {
    return (
      <div style={{ ...slotStyle, border: `1.5px solid ${BRAND.rule}` }}>
        <img
          alt={`Slot ${index + 1}`}
          height={isHero ? 200 : 90}
          src={url}
          style={{
            height: "100%",
            objectFit: "cover",
            width: "100%",
          }}
          width={300}
        />
        {isHero && (
          <span
            style={{
              background: "rgba(26,24,20,.6)",
              borderRadius: 5,
              color: "white",
              fontSize: 9,
              fontWeight: 600,
              left: 8,
              letterSpacing: ".06em",
              padding: "2px 7px",
              position: "absolute",
              textTransform: "uppercase",
              top: 8,
            }}
          >
            Hero
          </span>
        )}
        <button
          aria-label="Remove image"
          onClick={onRemove}
          style={{
            alignItems: "center",
            background: "rgba(26,24,20,.65)",
            border: 0,
            borderRadius: "50%",
            color: "white",
            cursor: "pointer",
            display: "grid",
            height: 24,
            placeItems: "center",
            position: "absolute",
            right: 8,
            top: 8,
            width: 24,
          }}
          type="button"
        >
          <X size={12} />
        </button>
      </div>
    );
  }

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: file upload zone — keyboard handled by hidden input
    // biome-ignore lint/a11y/noStaticElementInteractions: file upload zone — keyboard handled by hidden input
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: file upload zone — keyboard handled by hidden input
    <div onClick={() => fileInputRef.current?.click()} style={slotStyle}>
      <input
        accept="image/*"
        onChange={handleFileChange}
        ref={fileInputRef}
        style={{ display: "none" }}
        type="file"
      />
      <div
        style={{
          alignItems: "center",
          display: "flex",
          flexDirection: "column",
          gap: 6,
          height: "100%",
          justifyContent: "center",
          padding: 12,
        }}
      >
        {uploading ? (
          <span style={{ color: BRAND.ink4, fontSize: 11 }}>Uploading…</span>
        ) : (
          <>
            <ImageIcon size={isHero ? 24 : 16} style={{ color: BRAND.ink4 }} />
            {isHero && (
              <span style={{ color: BRAND.ink4, fontSize: 11 }}>
                Hero image
              </span>
            )}
            <Upload size={12} style={{ color: BRAND.ink4 }} />
          </>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                              Shared input style                             */
/* -------------------------------------------------------------------------- */

function fieldInputStyle(extra?: React.CSSProperties): React.CSSProperties {
  return {
    appearance: "none",
    background: "rgba(255,255,255,.6)",
    border: `0.5px solid ${BRAND.rule2}`,
    borderRadius: 8,
    color: BRAND.ink,
    fontSize: 14,
    outline: 0,
    padding: "10px 12px",
    transition: "border-color .15s, background .15s",
    width: "100%",
    ...extra,
  };
}

/* -------------------------------------------------------------------------- */
/*                               EssentialsStep                               */
/* -------------------------------------------------------------------------- */

function EssentialsStep({
  allowedDepartmentIds,
  campusId,
  campuses,
  canChangeCampus,
  category,
  departmentId,
  departments,
  finagoAccountNumber,
  lang,
  onLangChange,
  setCampusId,
  setCategory,
  setDepartmentId,
  setFinagoAccountNumber,
  setShortDescription,
  setSlug,
  setSlugEditing,
  setTags,
  setTitleEn,
  setTitleNo,
  shortDescription,
  slug,
  slugEditing,
  tags,
  titleEn,
  titleNo,
}: {
  allowedDepartmentIds?: string[];
  campusId: string;
  campuses: Campus[];
  canChangeCampus?: boolean;
  category: string | null;
  departmentId: string | null;
  departments: Departments[];
  finagoAccountNumber: number | null;
  lang: LocaleCode;
  onLangChange: (l: LocaleCode) => void;
  setCampusId: (v: string) => void;
  setCategory: (v: string | null) => void;
  setDepartmentId: (v: string | null) => void;
  setFinagoAccountNumber: (v: number | null) => void;
  setShortDescription: (v: string) => void;
  setSlug: (v: string) => void;
  setSlugEditing: (v: boolean) => void;
  setTags: (v: string[]) => void;
  setTitleEn: (v: string) => void;
  setTitleNo: (v: string) => void;
  shortDescription: string;
  slug: string;
  slugEditing: boolean;
  tags: string[];
  titleEn: string;
  titleNo: string;
}) {
  const titleValue = lang === "no" ? titleNo : titleEn;
  const setTitle = lang === "no" ? setTitleNo : setTitleEn;

  const campusName =
    campuses.find((c) => c.$id === campusId)?.name?.toLowerCase() ?? "campus";
  const campusSlug = campusName.replace(/\s+/g, "-");

  function handleTitleChange(value: string) {
    setTitle(value);
    if (!slug) {
      setSlug(generateSlug(value));
    }
  }

  function handleTitleBlur() {
    if (!slug && titleNo) {
      setSlug(generateSlug(titleNo));
    }
  }

  function toggleTag(tag: string) {
    if (tags.includes(tag)) {
      setTags(tags.filter((t) => t !== tag));
    } else {
      setTags([...tags, tag].slice(0, 5));
    }
  }

  const filteredDepartments = departments.filter(
    (d) => d.campus_id === campusId
  );

  return (
    <div>
      {/* Title area */}
      <div style={{ marginBottom: 28 }}>
        <LocaleTabs lang={lang} onChange={onLangChange} />
        <input
          onBlur={handleTitleBlur}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Product name…"
          style={{
            appearance: "none",
            background: "transparent",
            border: 0,
            color: BRAND.ink,
            fontFamily: SERIF_STACK,
            fontSize: 36,
            fontWeight: 400,
            letterSpacing: "-0.018em",
            lineHeight: 1.1,
            outline: 0,
            padding: 0,
            width: "100%",
          }}
          value={titleValue}
        />
        {/* Slug row */}
        <div
          style={{
            alignItems: "center",
            background: BRAND.paper2,
            border: `0.5px solid ${BRAND.rule2}`,
            borderRadius: 7,
            color: BRAND.ink3,
            display: "inline-flex",
            fontFamily: MONO_STACK,
            fontSize: 11,
            gap: 4,
            marginTop: 10,
            padding: "5px 10px",
          }}
        >
          <span style={{ color: BRAND.ink4 }}>biso.no/{campusSlug}/shop/</span>
          {slugEditing ? (
            <input
              onBlur={() => setSlugEditing(false)}
              onChange={(e) =>
                setSlug(e.target.value.replace(/[^a-z0-9-]/g, ""))
              }
              style={{
                background: "transparent",
                border: 0,
                color: BRAND.ink,
                fontFamily: MONO_STACK,
                fontSize: 11,
                outline: 0,
                width: 200,
              }}
              value={slug}
            />
          ) : (
            <b style={{ color: BRAND.ink, fontWeight: 500 }}>
              {slug || "untitled-product"}
            </b>
          )}
          <button
            onClick={() => setSlugEditing(!slugEditing)}
            style={{
              background: "transparent",
              border: 0,
              color: BRAND.ink4,
              cursor: "pointer",
              fontSize: 10,
              marginLeft: 2,
              padding: "0 4px",
            }}
            type="button"
          >
            Edit
          </button>
        </div>
      </div>

      {/* Two-column grid */}
      <div style={{ display: "grid", gap: 28, gridTemplateColumns: "1fr 1fr" }}>
        {/* Left: teaser */}
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div>
            <FieldLabel required>Teaser</FieldLabel>
            <textarea
              maxLength={140}
              onChange={(e) => setShortDescription(e.target.value)}
              placeholder="One sentence that sells the product…"
              rows={3}
              style={fieldInputStyle({ fontSize: 14, resize: "none" })}
              value={shortDescription}
            />
            <div
              style={{
                color: BRAND.ink4,
                fontSize: 10.5,
                marginTop: 4,
                textAlign: "right",
              }}
            >
              {140 - shortDescription.length} chars remaining
            </div>
          </div>
        </div>

        {/* Right: category, department, campus, tags */}
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          {/* Category */}
          <div>
            <FieldLabel required>Category</FieldLabel>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {PRODUCT_CATEGORIES.map((cat) => {
                const active = category === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setCategory(cat.id)}
                    style={{
                      alignItems: "center",
                      background: active ? BRAND.ink : "rgba(255,255,255,.5)",
                      border: `0.5px solid ${active ? BRAND.ink : BRAND.rule2}`,
                      borderRadius: 999,
                      color: active ? BRAND.paper : BRAND.ink,
                      cursor: "pointer",
                      display: "flex",
                      fontSize: 12.5,
                      gap: 7,
                      padding: "5px 11px 5px 5px",
                      transition: "background .12s, border-color .12s",
                    }}
                    type="button"
                  >
                    <span
                      style={{
                        alignItems: "center",
                        background: active
                          ? "rgba(255,255,255,.12)"
                          : BRAND.paper2,
                        borderRadius: 6,
                        color: active ? BRAND.paper : BRAND.ink,
                        display: "grid",
                        fontFamily: SERIF_STACK,
                        fontSize: 13,
                        height: 24,
                        placeItems: "center",
                        width: 24,
                      }}
                    >
                      {cat.crest}
                    </span>
                    {cat.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Department */}
          <div>
            <FieldLabel>Department</FieldLabel>
            <select
              disabled={
                allowedDepartmentIds !== undefined &&
                allowedDepartmentIds.length <= 1
              }
              onChange={(e) => setDepartmentId(e.target.value || null)}
              style={fieldInputStyle()}
              value={departmentId ?? ""}
            >
              <option value="">— No department —</option>
              {filteredDepartments.map((d) => (
                <option key={d.$id} value={d.$id}>
                  {d.Name}
                </option>
              ))}
            </select>
          </div>

          {/* Campus */}
          <div>
            <FieldLabel required>Campus</FieldLabel>
            <select
              disabled={!canChangeCampus}
              onChange={(e) => {
                setCampusId(e.target.value);
                setDepartmentId(null);
              }}
              style={fieldInputStyle()}
              value={campusId}
            >
              <option value="">Select campus</option>
              {campuses.map((c) => (
                <option key={c.$id} value={c.$id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Tags */}
          <div>
            <FieldLabel>Tags</FieldLabel>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {SHOP_TAG_OPTIONS.map((tag) => {
                const active = tags.includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    style={{
                      background: active ? BRAND.ink : "rgba(255,255,255,.5)",
                      border: `0.5px solid ${active ? BRAND.ink : BRAND.rule2}`,
                      borderRadius: 999,
                      color: active ? BRAND.paper : BRAND.ink,
                      cursor: "pointer",
                      fontSize: 12,
                      padding: "4px 11px",
                      transition: "background .12s, border-color .12s",
                    }}
                    type="button"
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Finago account number */}
          <div>
            <FieldLabel>Finago account number</FieldLabel>
            <input
              min={0}
              onChange={(e) => {
                const val = e.target.value;
                setFinagoAccountNumber(val === "" ? null : Number(val));
              }}
              placeholder="e.g. 3000"
              step={1}
              style={fieldInputStyle()}
              type="number"
              value={finagoAccountNumber ?? ""}
            />
            <div
              style={{
                color: BRAND.ink,
                fontSize: 11,
                marginTop: 4,
                opacity: 0.5,
              }}
            >
              GL revenue account for 24SevenOffice ledger posting
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                             DescriptionStep                                */
/* -------------------------------------------------------------------------- */

function DescriptionStep({
  blocksEn,
  blocksNo,
  lang,
  onLangChange,
  setBlocksEn,
  setBlocksNo,
}: {
  blocksEn: DescriptionBlock[];
  blocksNo: DescriptionBlock[];
  lang: LocaleCode;
  onLangChange: (l: LocaleCode) => void;
  setBlocksEn: (b: DescriptionBlock[]) => void;
  setBlocksNo: (b: DescriptionBlock[]) => void;
}) {
  const blocks = lang === "no" ? blocksNo : blocksEn;
  const setBlocks = lang === "no" ? setBlocksNo : setBlocksEn;

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            color: BRAND.ink2,
            fontFamily: SERIF_STACK,
            fontSize: 34,
            lineHeight: 1.1,
            marginBottom: 6,
          }}
        >
          Tell the full story.
        </div>
        <p
          style={{
            color: BRAND.ink3,
            fontSize: 13.5,
            margin: "0 0 16px",
            maxWidth: "50ch",
          }}
        >
          Use headings to break up the detail. Hit / for a heading or bullet
          list. Press Enter for a new paragraph.
        </p>
        <LocaleTabs lang={lang} onChange={onLangChange} />
      </div>
      <ProductDescriptionBlockEditor blocks={blocks} onChange={setBlocks} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                            PricingVariantsStep                             */
/* -------------------------------------------------------------------------- */

function PricingVariantsStep({
  inventoryMode,
  localVariants,
  memberOnly,
  memberPrice,
  regularPrice,
  setInventoryMode,
  setLocalVariants,
  setMemberOnly,
  setMemberPrice,
  setRegularPrice,
  setStock,
  stock,
}: {
  inventoryMode: "tracked" | "unlimited";
  localVariants: ProductVariant[];
  memberOnly: boolean;
  memberPrice: number | null;
  regularPrice: number;
  setInventoryMode: (v: "tracked" | "unlimited") => void;
  setLocalVariants: (v: ProductVariant[]) => void;
  setMemberOnly: (v: boolean) => void;
  setMemberPrice: (v: number | null) => void;
  setRegularPrice: (v: number) => void;
  setStock: (v: number | null) => void;
  stock: number | null;
}) {
  function addVariant() {
    const variant: ProductVariant = {
      id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
      name: "",
      price: regularPrice,
      stock: 0,
      type: "default",
    };
    setLocalVariants([...localVariants, variant]);
  }

  function updateVariant(
    id: string,
    field: keyof ProductVariant,
    value: string | number
  ) {
    setLocalVariants(
      localVariants.map((v) => (v.id === id ? { ...v, [field]: value } : v))
    );
  }

  function removeVariant(id: string) {
    setLocalVariants(localVariants.filter((v) => v.id !== id));
  }

  const memberSavingPct =
    memberPrice && memberPrice > 0 && regularPrice > 0
      ? Math.round(((regularPrice - memberPrice) / regularPrice) * 100)
      : 0;

  const showMemberCard =
    memberPrice !== null &&
    memberPrice > 0 &&
    regularPrice > 0 &&
    memberPrice < regularPrice;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {/* Variant board */}
      <div>
        <div
          style={{
            alignItems: "center",
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 14,
          }}
        >
          <div style={{ alignItems: "center", display: "flex", gap: 8 }}>
            <span style={{ color: BRAND.ink, fontSize: 14, fontWeight: 500 }}>
              Variants
            </span>
            {localVariants.length > 0 && (
              <span
                style={{
                  background: BRAND.paper3,
                  borderRadius: 999,
                  color: BRAND.ink3,
                  fontSize: 11,
                  padding: "1px 8px",
                }}
              >
                {localVariants.length}
              </span>
            )}
          </div>
          <button
            onClick={addVariant}
            style={{
              alignItems: "center",
              background: "transparent",
              border: `1px dashed ${BRAND.rule2}`,
              borderRadius: 8,
              color: BRAND.ink3,
              cursor: "pointer",
              display: "flex",
              fontSize: 12,
              gap: 5,
              padding: "5px 12px",
            }}
            type="button"
          >
            <Plus size={12} /> Add variant
          </button>
        </div>

        {localVariants.length === 0 ? (
          /* Flat price inputs */
          <div
            style={{
              background: "rgba(255,255,255,.5)",
              border: `0.5px solid ${BRAND.rule2}`,
              borderRadius: 12,
              display: "grid",
              gap: 14,
              gridTemplateColumns: "1fr 1fr",
              padding: "18px 20px",
            }}
          >
            <div>
              <FieldLabel required>Regular price (NOK)</FieldLabel>
              <input
                min="0"
                onChange={(e) => {
                  const parsed = Number.parseFloat(e.target.value || "0");
                  setRegularPrice(Number.isFinite(parsed) ? parsed : 0);
                }}
                style={fieldInputStyle({ fontFamily: MONO_STACK })}
                type="number"
                value={regularPrice}
              />
            </div>
            <div>
              <FieldLabel>Member price (NOK)</FieldLabel>
              <input
                min="0"
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) {
                    setMemberPrice(null);
                    return;
                  }
                  const parsed = Number.parseFloat(v);
                  setMemberPrice(Number.isFinite(parsed) ? parsed : null);
                }}
                placeholder="Leave blank = same"
                style={fieldInputStyle({ fontFamily: MONO_STACK })}
                type="number"
                value={memberPrice ?? ""}
              />
            </div>
          </div>
        ) : (
          /* Variant table */
          <div
            style={{
              background: "rgba(255,255,255,.5)",
              border: `0.5px solid ${BRAND.rule2}`,
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div
              style={{
                borderBottom: `0.5px solid ${BRAND.rule}`,
                color: BRAND.ink4,
                display: "grid",
                fontSize: 10.5,
                gridTemplateColumns: "1fr 100px 120px 44px",
                letterSpacing: ".05em",
                padding: "10px 14px",
                textTransform: "uppercase",
              }}
            >
              <span>Name</span>
              <span>Price (NOK)</span>
              <span>Stock</span>
              <span />
            </div>
            {localVariants.map((variant, idx) => (
              <div
                key={variant.id}
                style={{
                  alignItems: "center",
                  borderTop: idx > 0 ? `0.5px solid ${BRAND.rule}` : 0,
                  display: "grid",
                  gap: 8,
                  gridTemplateColumns: "1fr 100px 120px 44px",
                  padding: "8px 14px",
                }}
              >
                <input
                  onChange={(e) =>
                    updateVariant(variant.id, "name", e.target.value)
                  }
                  placeholder="e.g. Small, Blue, 500ml"
                  style={{
                    background: "transparent",
                    border: `0.5px solid ${BRAND.rule2}`,
                    borderRadius: 6,
                    color: BRAND.ink,
                    fontSize: 13,
                    outline: 0,
                    padding: "5px 8px",
                    width: "100%",
                  }}
                  value={variant.name}
                />
                <input
                  min="0"
                  onChange={(e) => {
                    const parsed = Number.parseFloat(e.target.value || "0");
                    updateVariant(
                      variant.id,
                      "price",
                      Number.isFinite(parsed) ? parsed : 0
                    );
                  }}
                  style={{
                    background: "transparent",
                    border: `0.5px solid ${BRAND.rule2}`,
                    borderRadius: 6,
                    color: BRAND.ink,
                    fontFamily: MONO_STACK,
                    fontSize: 13,
                    outline: 0,
                    padding: "5px 8px",
                    width: "100%",
                  }}
                  type="number"
                  value={variant.price}
                />
                {/* Stock stepper */}
                <div
                  style={{
                    alignItems: "center",
                    background: "white",
                    border: `0.5px solid ${BRAND.rule2}`,
                    borderRadius: 6,
                    display: "flex",
                    overflow: "hidden",
                  }}
                >
                  <button
                    onClick={() =>
                      updateVariant(
                        variant.id,
                        "stock",
                        Math.max(0, variant.stock - 1)
                      )
                    }
                    style={{
                      background: BRAND.paper2,
                      border: 0,
                      borderRight: `0.5px solid ${BRAND.rule2}`,
                      color: BRAND.ink,
                      cursor: "pointer",
                      fontSize: 14,
                      padding: "4px 8px",
                    }}
                    type="button"
                  >
                    −
                  </button>
                  <span
                    style={{
                      color: BRAND.ink,
                      flex: 1,
                      fontFamily: MONO_STACK,
                      fontSize: 12,
                      textAlign: "center",
                    }}
                  >
                    {variant.stock}
                  </span>
                  <button
                    onClick={() =>
                      updateVariant(variant.id, "stock", variant.stock + 1)
                    }
                    style={{
                      background: BRAND.paper2,
                      border: 0,
                      borderLeft: `0.5px solid ${BRAND.rule2}`,
                      color: BRAND.ink,
                      cursor: "pointer",
                      fontSize: 14,
                      padding: "4px 8px",
                    }}
                    type="button"
                  >
                    +
                  </button>
                </div>
                <button
                  aria-label="Remove variant"
                  onClick={() => removeVariant(variant.id)}
                  style={{
                    alignItems: "center",
                    background: "transparent",
                    border: 0,
                    color: BRAND.ink4,
                    cursor: "pointer",
                    display: "grid",
                    height: 30,
                    placeItems: "center",
                    width: 30,
                  }}
                  type="button"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <div
              style={{
                borderTop: `0.5px solid ${BRAND.rule}`,
              }}
            >
              <button
                onClick={addVariant}
                style={{
                  alignItems: "center",
                  background: "transparent",
                  border: 0,
                  color: BRAND.ink3,
                  cursor: "pointer",
                  display: "flex",
                  fontSize: 12.5,
                  gap: 8,
                  padding: "10px 14px",
                  width: "100%",
                }}
                type="button"
              >
                <Plus size={12} /> Add variant
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Member discount card */}
      {showMemberCard && (
        <div
          style={{
            background: "rgba(47,93,58,.06)",
            border: "0.5px solid rgba(47,93,58,.25)",
            borderRadius: 10,
            padding: "12px 16px",
          }}
        >
          <div
            style={{
              alignItems: "center",
              color: BRAND.leaf,
              display: "flex",
              fontSize: 13,
              fontWeight: 500,
              gap: 8,
              marginBottom: 4,
            }}
          >
            <span
              style={{
                background: BRAND.leaf,
                borderRadius: "50%",
                display: "inline-block",
                height: 8,
                width: 8,
              }}
            />
            Member pricing active
          </div>
          <p style={{ color: BRAND.leaf, fontSize: 12.5, margin: "0 0 8px" }}>
            Members save {memberSavingPct}% on this product.
          </p>
          <div style={{ color: BRAND.ink3, fontSize: 12 }}>
            Regular:{" "}
            <b style={{ color: BRAND.ink }}>
              kr {regularPrice.toLocaleString("nb-NO")}
            </b>{" "}
            &nbsp;·&nbsp; Member:{" "}
            <b style={{ color: BRAND.leaf }}>
              kr {(memberPrice ?? 0).toLocaleString("nb-NO")}
            </b>
          </div>
        </div>
      )}

      {/* Inventory mode (only when no variants) */}
      {localVariants.length === 0 && (
        <div>
          <FieldLabel>Inventory mode</FieldLabel>
          <div style={{ display: "flex", gap: 12 }}>
            <ToggleCard
              active={inventoryMode === "tracked"}
              description="Counts stock down on each purchase."
              label="Tracked"
              onClick={() => setInventoryMode("tracked")}
            />
            <ToggleCard
              active={inventoryMode === "unlimited"}
              description="Always available — no stock limit."
              label="Unlimited"
              onClick={() => setInventoryMode("unlimited")}
            />
          </div>
        </div>
      )}

      {/* Stock input (only when tracked + no variants) */}
      {inventoryMode === "tracked" && localVariants.length === 0 && (
        <div>
          <FieldLabel>Stock count</FieldLabel>
          <div
            style={{
              alignItems: "stretch",
              background: "rgba(255,255,255,.55)",
              border: `0.5px solid ${BRAND.rule2}`,
              borderRadius: 10,
              display: "flex",
              overflow: "hidden",
              width: "fit-content",
            }}
          >
            <button
              aria-label="Decrease stock"
              onClick={() => setStock(Math.max(0, (stock ?? 0) - 1))}
              style={{
                background: BRAND.paper2,
                border: 0,
                borderRight: `0.5px solid ${BRAND.rule2}`,
                color: BRAND.ink,
                cursor: "pointer",
                fontSize: 18,
                padding: "6px 14px",
              }}
              type="button"
            >
              −
            </button>
            <input
              aria-label="Stock"
              min="0"
              onChange={(e) => {
                const parsed = Number.parseInt(e.target.value || "0", 10);
                setStock(Number.isFinite(parsed) ? parsed : 0);
              }}
              style={{
                appearance: "none",
                background: "transparent",
                border: 0,
                color: BRAND.ink,
                fontFamily: MONO_STACK,
                fontSize: 15,
                outline: 0,
                padding: "6px 0",
                textAlign: "center",
                width: 72,
              }}
              type="number"
              value={stock ?? 0}
            />
            <button
              aria-label="Increase stock"
              onClick={() => setStock((stock ?? 0) + 1)}
              style={{
                background: BRAND.paper2,
                border: 0,
                borderLeft: `0.5px solid ${BRAND.rule2}`,
                color: BRAND.ink,
                cursor: "pointer",
                fontSize: 18,
                padding: "6px 14px",
              }}
              type="button"
            >
              +
            </button>
          </div>
        </div>
      )}

      {/* Member-only toggle */}
      <div>
        <FieldLabel>Access restriction</FieldLabel>
        <div style={{ display: "flex", gap: 12 }}>
          <ToggleCard
            active={memberOnly}
            description="Only visible to active BISO members."
            label="Members only"
            onClick={() => setMemberOnly(true)}
          />
          <ToggleCard
            active={!memberOnly}
            description="Visible to all BI students."
            label="Open to all"
            onClick={() => setMemberOnly(false)}
          />
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                          PhotosVisibilityStep                              */
/* -------------------------------------------------------------------------- */

function PhotosVisibilityStep({
  coverPattern,
  linkedEventId,
  localImages,
  setCoverPattern,
  setLinkedEventId,
  setLocalImages,
}: {
  coverPattern: string;
  linkedEventId: string | null;
  localImages: string[];
  setCoverPattern: (v: string) => void;
  setLinkedEventId: (v: string | null) => void;
  setLocalImages: (v: string[]) => void;
}) {
  function handleUpload(index: number, url: string) {
    const next = [...localImages];
    next[index] = url;
    setLocalImages(next);
  }

  function handleRemove(index: number) {
    const next = localImages.filter((_, i) => i !== index);
    setLocalImages(next);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {/* Image gallery */}
      <div>
        <FieldLabel>Product photos</FieldLabel>
        <div
          style={{
            display: "grid",
            gap: 10,
            gridTemplateColumns: "repeat(3, 1fr)",
            gridTemplateRows: "auto auto",
          }}
        >
          {Array.from({ length: 5 }).map((_, i) => (
            <ImageSlot
              index={i}
              isHero={i === 0}
              key={`slot-${i}`}
              onRemove={() => handleRemove(i)}
              onUpload={(url) => handleUpload(i, url)}
              url={localImages[i] ?? null}
            />
          ))}
        </div>
      </div>

      {/* Cover pattern picker */}
      <div>
        <FieldLabel>Cover pattern</FieldLabel>
        <div style={{ display: "flex", gap: 10 }}>
          {COVER_PATTERNS.map((p) => {
            const active = coverPattern === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setCoverPattern(p.id)}
                style={{
                  background: "transparent",
                  border: 0,
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  padding: 0,
                }}
                type="button"
              >
                <div
                  style={{
                    border: `${active ? "1.5px" : "1px"} solid ${active ? BRAND.ink : BRAND.rule}`,
                    borderRadius: 8,
                    height: 36,
                    overflow: "hidden",
                    position: "relative",
                    width: 56,
                    background: shopCoverBackground(p.id),
                  }}
                >
                  <ShopCoverPattern which={shopCoverPatternIndex(p.id)} />
                </div>
                <span
                  style={{
                    color: active ? BRAND.ink : BRAND.ink4,
                    fontSize: 10,
                    textAlign: "center",
                  }}
                >
                  {p.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Linked event */}
      <div>
        <FieldLabel>Linked event ID (optional)</FieldLabel>
        <input
          onChange={(e) => setLinkedEventId(e.target.value || null)}
          placeholder="e.g. 6788abc..."
          style={fieldInputStyle()}
          value={linkedEventId ?? ""}
        />
        <p style={{ color: BRAND.ink4, fontSize: 11.5, marginTop: 5 }}>
          Associates this product with an event page.
        </p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                ReviewStep                                  */
/* -------------------------------------------------------------------------- */

function ReviewStep({
  blocksNo,
  campusId,
  campuses,
  category,
  handleSubmit,
  isPending,
  localImages,
  localVariants,
  regularPrice,
  setActiveStep,
  setStatus,
  status,
  titleNo,
}: {
  blocksNo: DescriptionBlock[];
  campusId: string;
  campuses: Campus[];
  category: string | null;
  handleSubmit: (targetStatus: string) => void;
  isPending: boolean;
  localImages: string[];
  localVariants: ProductVariant[];
  regularPrice: number;
  setActiveStep: (s: 0 | 1 | 2 | 3 | 4) => void;
  setStatus: (
    v: "draft" | "pending_approval" | "published" | "archived"
  ) => void;
  status: "draft" | "pending_approval" | "published" | "archived";
  titleNo: string;
}) {
  const checks = [
    {
      done: Boolean(titleNo.trim()) && Boolean(category) && Boolean(campusId),
      label: "Essentials",
      step: 0 as const,
      detail: "Title · Category · Campus",
    },
    {
      done:
        blocksNo.length > 0 && blocksNo.some((b) => b.text.trim().length > 0),
      label: "Description",
      step: 1 as const,
      detail: "Norwegian description blocks",
    },
    {
      done: regularPrice > 0 || localVariants.length > 0,
      label: "Pricing",
      step: 2 as const,
      detail: "Regular price or variants set",
    },
    {
      done: localImages.length > 0,
      label: "Photos",
      step: 3 as const,
      detail: "At least one product photo",
    },
  ];

  const campus = campuses.find((c) => c.$id === campusId);

  return (
    <div style={{ display: "grid", gap: 28, gridTemplateColumns: "1fr 280px" }}>
      {/* Checklist */}
      <div>
        <div
          style={{
            color: BRAND.ink2,
            fontFamily: SERIF_STACK,
            fontSize: 34,
            lineHeight: 1.1,
            marginBottom: 8,
          }}
        >
          One last look.
        </div>
        <p
          style={{
            color: BRAND.ink3,
            fontSize: 13.5,
            margin: "0 0 20px",
            maxWidth: "42ch",
          }}
        >
          Click any row to jump back and edit. When ready, choose a status and
          save.
        </p>
        <div
          style={{
            background: "rgba(255,255,255,.5)",
            border: `0.5px solid ${BRAND.rule}`,
            borderRadius: 14,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {checks.map((check, i) => (
            <button
              key={check.label}
              onClick={() => setActiveStep(check.step)}
              style={{
                alignItems: "center",
                background: "transparent",
                border: 0,
                borderTop: i > 0 ? `0.5px solid ${BRAND.rule}` : 0,
                cursor: "pointer",
                display: "grid",
                gap: 14,
                gridTemplateColumns: "24px 1fr auto",
                padding: "14px 18px",
                textAlign: "left",
                width: "100%",
              }}
              type="button"
            >
              <span
                style={{
                  alignItems: "center",
                  background: check.done
                    ? "rgba(47,93,58,.12)"
                    : "rgba(176,138,62,.12)",
                  border: `1px solid ${check.done ? "rgba(47,93,58,.3)" : "rgba(176,138,62,.4)"}`,
                  borderRadius: "50%",
                  color: check.done ? BRAND.leaf : BRAND.gold,
                  display: "grid",
                  height: 20,
                  placeItems: "center",
                  width: 20,
                }}
              >
                {check.done ? (
                  <Check size={11} />
                ) : (
                  <span
                    style={{
                      background: BRAND.gold,
                      borderRadius: "50%",
                      display: "block",
                      height: 6,
                      width: 6,
                    }}
                  />
                )}
              </span>
              <div>
                <span
                  style={{
                    color: BRAND.ink,
                    display: "block",
                    fontSize: 13.5,
                    fontWeight: 500,
                  }}
                >
                  {check.label}
                </span>
                <span
                  style={{
                    color: BRAND.ink4,
                    display: "block",
                    fontSize: 11.5,
                    marginTop: 2,
                  }}
                >
                  {check.detail}
                </span>
              </div>
              <span style={{ color: BRAND.ink4, fontSize: 11 }}>Edit →</span>
            </button>
          ))}
        </div>

        {/* Status summary */}
        <div
          style={{
            background: BRAND.paper2,
            border: `0.5px solid ${BRAND.rule2}`,
            borderRadius: 10,
            marginTop: 18,
            padding: "12px 16px",
          }}
        >
          <div style={{ color: BRAND.ink4, fontSize: 11, marginBottom: 4 }}>
            Product summary
          </div>
          <div style={{ color: BRAND.ink, fontSize: 13.5 }}>
            <b>{titleNo || "Untitled product"}</b>
          </div>
          <div style={{ color: BRAND.ink3, fontSize: 12, marginTop: 4 }}>
            {campus?.name ?? "No campus"} ·{" "}
            {PRODUCT_CATEGORIES.find((c) => c.id === category)?.name ??
              "No category"}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 18,
          paddingTop: 4,
        }}
      >
        {/* Status selector */}
        <div>
          <FieldLabel>Status</FieldLabel>
          <div
            style={{
              background: BRAND.paper2,
              border: `0.5px solid ${BRAND.rule2}`,
              borderRadius: 8,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {(
              [
                { value: "draft", label: "Draft" },
                { value: "pending_approval", label: "Pending" },
                { value: "published", label: "Published" },
                { value: "archived", label: "Archived" },
              ] as const
            ).map((opt, idx) => {
              const active = status === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setStatus(opt.value)}
                  style={{
                    background: active ? BRAND.ink : "transparent",
                    border: 0,
                    borderTop: idx > 0 ? `0.5px solid ${BRAND.rule}` : 0,
                    color: active ? "white" : BRAND.ink,
                    cursor: "pointer",
                    fontSize: 13,
                    padding: "10px 14px",
                    textAlign: "left",
                    transition: "background .1s",
                  }}
                  type="button"
                >
                  {active && (
                    <Check
                      size={11}
                      style={{ marginRight: 6, verticalAlign: "middle" }}
                    />
                  )}
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Action buttons */}
        <button
          disabled={isPending}
          onClick={() => handleSubmit("draft")}
          style={{
            alignItems: "center",
            background: "rgba(255,255,255,.7)",
            border: `0.5px solid ${BRAND.rule2}`,
            borderRadius: 10,
            color: BRAND.ink,
            cursor: "pointer",
            display: "flex",
            fontSize: 13.5,
            fontWeight: 500,
            gap: 8,
            justifyContent: "center",
            opacity: isPending ? 0.6 : 1,
            padding: "12px 0",
          }}
          type="button"
        >
          <Save size={14} />
          {isPending ? "Saving…" : "Save draft"}
        </button>

        <button
          disabled={isPending}
          onClick={() => handleSubmit("published")}
          style={{
            alignItems: "center",
            background: BRAND.ink,
            border: `0.5px solid ${BRAND.ink}`,
            borderRadius: 10,
            color: BRAND.paper,
            cursor: "pointer",
            display: "flex",
            fontSize: 13.5,
            fontWeight: 500,
            gap: 8,
            justifyContent: "center",
            opacity: isPending ? 0.6 : 1,
            padding: "12px 0",
          }}
          type="button"
        >
          <Send size={14} />
          {isPending ? "Publishing…" : "Publish"}
        </button>

        <Link
          href="/shop"
          style={{
            color: BRAND.ink4,
            display: "block",
            fontSize: 12.5,
            marginTop: 4,
            textAlign: "center",
            textDecoration: "none",
          }}
        >
          Discard
        </Link>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                               Preview pane                                 */
/* -------------------------------------------------------------------------- */

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Phone preview composes many small visual elements that are clearer when colocated than split across components.
function PreviewPane({
  blocksNo,
  category,
  coverPattern,
  localImages,
  localVariants,
  localeLang,
  memberOnly,
  memberPrice,
  regularPrice,
  setLocaleLang,
  tags,
  titleEn,
  titleNo,
}: {
  blocksNo: DescriptionBlock[];
  category: string | null;
  coverPattern: string;
  localImages: string[];
  localVariants: ProductVariant[];
  localeLang: LocaleCode;
  memberOnly: boolean;
  memberPrice: number | null;
  regularPrice: number;
  setLocaleLang: (l: LocaleCode) => void;
  tags: string[];
  titleEn: string;
  titleNo: string;
}) {
  const [phoneFloat, setPhoneFloat] = useState(true);

  const previewTitle = localeLang === "no" ? titleNo : titleEn;
  const heroImage = localImages[0] ?? null;
  const cat = PRODUCT_CATEGORIES.find((c) => c.id === category);
  const coverBg = heroImage
    ? `url(${heroImage})`
    : shopCoverBackground(coverPattern);
  const coverWhich = shopCoverPatternIndex(coverPattern);
  const hasPrice = regularPrice > 0;
  const hasMemberPrice =
    memberPrice !== null && memberPrice > 0 && memberPrice < regularPrice;
  const descPreview = blocksNo
    .map((b) => b.text)
    .join(" ")
    .slice(0, 120);

  return (
    <div
      style={{
        background: "linear-gradient(180deg, #efe7d4 0%, #e6dcc2 100%)",
        borderLeft: `0.5px solid ${BRAND.rule}`,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes shop-phone-drift {
          0%   { transform: translate(0, 0) rotate(0deg); }
          50%  { transform: translate(6px, -8px) rotate(0.4deg); }
          100% { transform: translate(0, 0) rotate(0deg); }
        }
        .shop-preview-scroll { scrollbar-width: none; }
        .shop-preview-scroll::-webkit-scrollbar { display: none; }
      `}</style>

      {/* Preview header */}
      <div
        style={{
          alignItems: "center",
          background: "rgba(250,247,242,.5)",
          borderBottom: `0.5px solid ${BRAND.rule}`,
          display: "flex",
          fontSize: 12,
          gap: 8,
          padding: "10px 14px",
        }}
      >
        <span
          style={{
            alignItems: "center",
            color: BRAND.leaf,
            display: "flex",
            fontSize: 11,
            fontWeight: 500,
            gap: 5,
          }}
        >
          <span
            style={{
              background: BRAND.leaf,
              borderRadius: "50%",
              height: 6,
              width: 6,
            }}
          />
          Live preview
        </span>
        <div style={{ flex: 1 }} />
        {/* Float toggle */}
        <button
          onClick={() => setPhoneFloat((v) => !v)}
          style={{
            alignItems: "center",
            background: "rgba(255,255,255,.6)",
            border: `0.5px solid ${BRAND.rule2}`,
            borderRadius: 6,
            color: BRAND.ink3,
            cursor: "pointer",
            display: "flex",
            fontSize: 10,
            fontWeight: 500,
            gap: 5,
            padding: "3px 8px",
          }}
          type="button"
        >
          <span
            style={{
              background: phoneFloat ? BRAND.leaf : BRAND.ink4,
              borderRadius: "50%",
              height: 6,
              width: 6,
            }}
          />
          Floating
        </button>
        {/* Lang toggle */}
        <div
          style={{
            background: "rgba(255,255,255,.5)",
            border: `0.5px solid ${BRAND.rule2}`,
            borderRadius: 7,
            display: "flex",
            padding: 2,
          }}
        >
          {(["no", "en"] as const).map((l) => (
            <button
              key={l}
              onClick={() => setLocaleLang(l)}
              style={{
                background: localeLang === l ? "white" : "transparent",
                border: 0,
                borderRadius: 5,
                color: localeLang === l ? BRAND.ink : BRAND.ink3,
                cursor: "pointer",
                fontSize: 10,
                fontWeight: 500,
                padding: "2px 8px",
              }}
              type="button"
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Phone shell wrapper */}
      <div
        style={{
          alignItems: "center",
          display: "flex",
          flex: 1,
          justifyContent: "center",
          minHeight: 0,
          overflow: "auto",
          padding: "24px 20px",
        }}
      >
        {/* Outer bezel */}
        <div
          style={{
            animation: phoneFloat
              ? "shop-phone-drift 8s ease-in-out infinite"
              : "none",
            background: "#0d0b08",
            borderRadius: 44,
            boxShadow:
              "0 32px 64px rgba(0,0,0,.35), 0 8px 24px rgba(0,0,0,.25), inset 0 0 0 1px rgba(255,255,255,.06)",
            flexShrink: 0,
            padding: 8,
            width: 300,
          }}
        >
          {/* Inner screen */}
          <div
            style={{
              borderRadius: 36,
              display: "flex",
              flexDirection: "column",
              height: 620,
              overflow: "hidden",
            }}
          >
            {/* Status bar */}
            <div
              style={{
                alignItems: "center",
                background: BRAND.paper,
                color: BRAND.ink,
                display: "flex",
                flexShrink: 0,
                fontSize: 10,
                fontWeight: 600,
                justifyContent: "space-between",
                padding: "10px 16px 4px",
              }}
            >
              <span>09:41</span>
              <div style={{ alignItems: "center", display: "flex", gap: 4 }}>
                <div
                  style={{ alignItems: "flex-end", display: "flex", gap: 1.5 }}
                >
                  {[3, 5, 7, 9].map((h) => (
                    <span
                      key={h}
                      style={{
                        background: BRAND.ink,
                        borderRadius: 1,
                        height: h,
                        width: 2,
                      }}
                    />
                  ))}
                </div>
                <div
                  style={{
                    border: `1px solid ${BRAND.ink}`,
                    borderRadius: 3,
                    height: 10,
                    position: "relative",
                    width: 20,
                  }}
                >
                  <span
                    style={{
                      background: BRAND.ink,
                      borderRadius: 1.5,
                      display: "block",
                      height: "100%",
                      width: "70%",
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Back nav */}
            <div
              style={{
                alignItems: "center",
                background: BRAND.paper,
                color: BRAND.ink3,
                display: "flex",
                flexShrink: 0,
                fontSize: 12,
                gap: 8,
                padding: "4px 14px 8px",
              }}
            >
              <span
                style={{
                  alignItems: "center",
                  background: BRAND.paper2,
                  borderRadius: "50%",
                  display: "grid",
                  height: 26,
                  placeItems: "center",
                  width: 26,
                }}
              >
                <ArrowLeft size={13} />
              </span>
              <span>Shop</span>
              <span style={{ color: BRAND.ink4, marginLeft: "auto" }}>
                ♡ •••
              </span>
            </div>

            {/* Scrollable content */}
            <div
              className="shop-preview-scroll"
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: "auto",
                overscrollBehavior: "contain",
              }}
            >
              {/* Cover area */}
              <div
                style={{
                  background: coverBg,
                  backgroundPosition: "center",
                  backgroundSize: "cover",
                  height: 190,
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                {!heroImage && <ShopCoverPattern which={coverWhich} />}
                {cat && (
                  <span
                    style={{
                      background: "rgba(255,255,255,.2)",
                      border: "0.5px solid rgba(255,255,255,.25)",
                      borderRadius: 999,
                      bottom: 12,
                      color: "white",
                      fontSize: 10,
                      fontWeight: 600,
                      left: 12,
                      letterSpacing: ".06em",
                      padding: "2px 10px",
                      position: "absolute",
                      textTransform: "uppercase",
                    }}
                  >
                    {cat.crest} · {cat.name}
                  </span>
                )}
                {memberOnly && (
                  <span
                    style={{
                      background: BRAND.claret,
                      border: "0.5px solid rgba(107,30,30,.5)",
                      borderRadius: 999,
                      color: "white",
                      fontSize: 9,
                      letterSpacing: ".06em",
                      padding: "3px 9px",
                      position: "absolute",
                      right: 10,
                      textTransform: "uppercase",
                      top: 10,
                    }}
                  >
                    <Lock size={8} style={{ verticalAlign: "middle" }} />{" "}
                    Members
                  </span>
                )}
              </div>

              {/* Product details */}
              <div
                style={{
                  background: "white",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  padding: "14px 16px 20px",
                }}
              >
                {/* Name */}
                <div
                  style={{
                    color: BRAND.ink,
                    fontFamily: SERIF_STACK,
                    fontSize: 20,
                    lineHeight: 1.2,
                  }}
                >
                  {previewTitle || (
                    <em style={{ color: BRAND.ink4, fontStyle: "italic" }}>
                      Product name…
                    </em>
                  )}
                </div>

                {/* Price */}
                <div
                  style={{ alignItems: "baseline", display: "flex", gap: 8 }}
                >
                  {hasPrice ? (
                    <>
                      {hasMemberPrice && (
                        <span
                          style={{
                            color: BRAND.ink4,
                            fontSize: 15,
                            textDecoration: "line-through",
                          }}
                        >
                          kr {regularPrice.toLocaleString("nb-NO")}
                        </span>
                      )}
                      <span
                        style={{
                          color: hasMemberPrice ? BRAND.leaf : BRAND.ink,
                          fontFamily: SERIF_STACK,
                          fontSize: 22,
                          fontWeight: hasMemberPrice ? 600 : 400,
                        }}
                      >
                        kr{" "}
                        {(hasMemberPrice
                          ? (memberPrice ?? 0)
                          : regularPrice
                        ).toLocaleString("nb-NO")}
                      </span>
                    </>
                  ) : (
                    <span style={{ color: BRAND.ink4, fontSize: 13 }}>
                      Set price above
                    </span>
                  )}
                </div>

                {/* Variant pills */}
                {localVariants.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {localVariants.slice(0, 4).map((v) => (
                      <span
                        key={v.id}
                        style={{
                          background: BRAND.paper2,
                          border: `0.5px solid ${BRAND.rule2}`,
                          borderRadius: 999,
                          color: BRAND.ink2,
                          fontSize: 10,
                          padding: "2px 8px",
                        }}
                      >
                        {v.name || "Variant"} · kr{" "}
                        {v.price.toLocaleString("nb-NO")}
                      </span>
                    ))}
                  </div>
                )}

                {/* Tags */}
                {tags.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        style={{
                          background: BRAND.paper2,
                          border: `0.5px solid ${BRAND.rule2}`,
                          borderRadius: 999,
                          color: BRAND.ink3,
                          fontSize: 9.5,
                          padding: "2px 7px",
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Description preview */}
                {descPreview && (
                  <p
                    style={{
                      color: BRAND.ink3,
                      fontSize: 11.5,
                      lineHeight: 1.5,
                      margin: 0,
                    }}
                  >
                    {descPreview}
                    {descPreview.length >= 120 && "…"}
                  </p>
                )}
              </div>
            </div>

            {/* Fixed bottom CTA — outside the scroll area */}
            <div
              style={{
                background: "rgba(250,247,242,.95)",
                borderTop: `0.5px solid ${BRAND.rule}`,
                flexShrink: 0,
                padding: "10px 16px 14px",
              }}
            >
              <button
                style={{
                  background: BRAND.ink,
                  border: 0,
                  borderRadius: 999,
                  color: BRAND.paper,
                  cursor: "pointer",
                  fontSize: 12.5,
                  fontWeight: 500,
                  padding: 11,
                  width: "100%",
                }}
                type="button"
              >
                Add to bag
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Preview footer */}
      <div
        style={{
          alignItems: "center",
          background: "rgba(250,247,242,.4)",
          borderTop: `0.5px solid ${BRAND.rule}`,
          color: BRAND.ink4,
          display: "flex",
          flexShrink: 0,
          fontSize: 11,
          justifyContent: "space-between",
          padding: "8px 14px",
        }}
      >
        <span>Student-facing preview</span>
        <span style={{ fontFamily: MONO_STACK, fontSize: 10 }}>
          {localeLang.toUpperCase()}
        </span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                           Root editor component                            */
/* -------------------------------------------------------------------------- */

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Root editor manages all form state and wires step components; complexity is inherent to the design.
export function ShopStudioEditor({
  allowedDepartmentIds,
  campuses,
  canChangeCampus = true,
  defaultCampusId,
  departments,
  isNew,
  product,
}: ShopStudioEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Find translations
  const noTranslation = product?.translation_refs.find(
    (t) => t.locale === "no"
  );
  const enTranslation = product?.translation_refs.find(
    (t) => t.locale === "en"
  );

  // --- Form state ---
  const [titleNo, setTitleNo] = useState(noTranslation?.title ?? "");
  const [titleEn, setTitleEn] = useState(enTranslation?.title ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [category, setCategory] = useState<string | null>(
    product?.category ?? null
  );
  const [campusId, setCampusId] = useState(
    product?.campus_id ?? defaultCampusId ?? campuses[0]?.$id ?? ""
  );
  const [departmentId, setDepartmentId] = useState<string | null>(
    product?.departmentId ??
      (allowedDepartmentIds?.length === 1
        ? (allowedDepartmentIds[0] ?? null)
        : null)
  );
  const [shortDescription, setShortDescription] = useState(
    noTranslation?.short_description ?? ""
  );
  const [tags, setTags] = useState<string[]>(product?.tags ?? []);
  const [blocksNo, setBlocksNo] = useState<DescriptionBlock[]>(() =>
    htmlToDescriptionBlocks(noTranslation?.description ?? "")
  );
  const [blocksEn, setBlocksEn] = useState<DescriptionBlock[]>(() =>
    htmlToDescriptionBlocks(enTranslation?.description ?? "")
  );
  const [localVariants, setLocalVariants] = useState<ProductVariant[]>(() => {
    if (!product?.variants_json) {
      return [];
    }
    try {
      return JSON.parse(product.variants_json) as ProductVariant[];
    } catch {
      return [];
    }
  });
  const [regularPrice, setRegularPrice] = useState<number>(
    product?.regular_price ?? 0
  );
  const [memberPrice, setMemberPrice] = useState<number | null>(
    product?.member_price ?? null
  );
  const [memberOnly, setMemberOnly] = useState<boolean>(
    product?.member_only ?? false
  );
  const [inventoryMode, setInventoryMode] = useState<"tracked" | "unlimited">(
    (product?.inventory_mode as "tracked" | "unlimited") ?? "unlimited"
  );
  const [stock, setStock] = useState<number | null>(product?.stock ?? null);
  const [localImages, setLocalImages] = useState<string[]>(
    product?.images ?? []
  );
  const [coverPattern, setCoverPattern] = useState<string>(
    product?.cover_pattern ?? "dotted"
  );
  const [linkedEventId, setLinkedEventId] = useState<string | null>(
    product?.linked_event_id ?? null
  );
  const [finagoAccountNumber, setFinagoAccountNumber] = useState<number | null>(
    product?.finago_account_number ?? null
  );
  const [status, setStatus] = useState<
    "draft" | "pending_approval" | "published" | "archived"
  >(
    (product?.status as
      | "draft"
      | "pending_approval"
      | "published"
      | "archived") ?? "draft"
  );
  const [activeStep, setActiveStep] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [localeLang, setLocaleLang] = useState<"en" | "no">("no");
  const [slugEditing, setSlugEditing] = useState(false);

  function buildPayload(targetStatus: string) {
    return {
      name: titleNo,
      name_en: titleEn || null,
      description: descriptionBlocksToHtml(blocksNo) || null,
      description_en: descriptionBlocksToHtml(blocksEn) || null,
      short_description: shortDescription || null,
      slug: slug || generateSlug(titleNo),
      campus_id: campusId,
      department_id: departmentId,
      category,
      status: targetStatus as
        | "draft"
        | "pending_approval"
        | "published"
        | "archived",
      regular_price: regularPrice,
      member_price: memberPrice,
      member_only: memberOnly,
      image: localImages[0] ?? null,
      stock,
      variants_json:
        localVariants.length > 0 ? JSON.stringify(localVariants) : null,
      tags,
      images: localImages,
      cover_pattern: coverPattern as
        | "dotted"
        | "linear"
        | "concentric"
        | "wave"
        | "grid",
      linked_event_id: linkedEventId,
      inventory_mode: inventoryMode as "tracked" | "unlimited",
      finago_account_number: finagoAccountNumber,
    };
  }

  function handleSubmit(targetStatus: string) {
    startTransition(async () => {
      const values = buildPayload(targetStatus);
      const result = isNew
        ? await createProduct(values)
        : await updateProduct(product!.$id, values);

      if ("error" in result) {
        toast.error("Failed to save product");
      } else {
        const msg =
          targetStatus === "published" ? "Product published!" : "Draft saved";
        toast.success(msg);
        if (isNew) {
          router.push("/shop");
        }
      }
    });
  }

  return (
    <div
      style={{
        background: BRAND.paper,
        display: "flex",
        fontFamily: "Geist, system-ui, sans-serif",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes shop-pulse {
          0% { opacity: 1; }
          50% { opacity: 0.35; }
          100% { opacity: 1; }
        }
        [contenteditable][data-placeholder]:empty::before {
          content: attr(data-placeholder);
          color: ${BRAND.ink4};
          font-style: italic;
        }
      `}</style>

      {/* Main editor area */}
      <div
        style={{
          display: "flex",
          flex: 1,
          flexDirection: "column",
          minWidth: 0,
          overflow: "hidden",
        }}
      >
        {/* Top rail */}
        <div
          style={{
            background: BRAND.paper,
            borderBottom: `0.5px solid ${BRAND.rule}`,
            padding: "16px 36px 0",
          }}
        >
          <div
            style={{
              alignItems: "center",
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 14,
            }}
          >
            <Link
              href="/shop"
              style={{
                alignItems: "center",
                color: BRAND.ink3,
                display: "flex",
                fontSize: 12.5,
                gap: 6,
                textDecoration: "none",
              }}
            >
              <ArrowLeft size={14} />
              Products
            </Link>
            <span
              style={{
                color: BRAND.ink3,
                fontSize: 12.5,
                fontStyle: "italic",
              }}
            >
              {isNew ? "New product" : titleNo || "Untitled product"}
            </span>
          </div>
          <StepRail active={activeStep} />
        </div>

        {/* Step content */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "32px 36px 120px",
          }}
        >
          <div style={{ maxWidth: 860, width: "100%" }}>
            {activeStep === 0 && (
              <EssentialsStep
                allowedDepartmentIds={allowedDepartmentIds}
                campuses={campuses}
                campusId={campusId}
                canChangeCampus={canChangeCampus}
                category={category}
                departmentId={departmentId}
                departments={departments}
                finagoAccountNumber={finagoAccountNumber}
                lang={localeLang}
                onLangChange={setLocaleLang}
                setCampusId={setCampusId}
                setCategory={setCategory}
                setDepartmentId={setDepartmentId}
                setFinagoAccountNumber={setFinagoAccountNumber}
                setShortDescription={setShortDescription}
                setSlug={setSlug}
                setSlugEditing={setSlugEditing}
                setTags={setTags}
                setTitleEn={setTitleEn}
                setTitleNo={setTitleNo}
                shortDescription={shortDescription}
                slug={slug}
                slugEditing={slugEditing}
                tags={tags}
                titleEn={titleEn}
                titleNo={titleNo}
              />
            )}
            {activeStep === 1 && (
              <DescriptionStep
                blocksEn={blocksEn}
                blocksNo={blocksNo}
                lang={localeLang}
                onLangChange={setLocaleLang}
                setBlocksEn={setBlocksEn}
                setBlocksNo={setBlocksNo}
              />
            )}
            {activeStep === 2 && (
              <PricingVariantsStep
                inventoryMode={inventoryMode}
                localVariants={localVariants}
                memberOnly={memberOnly}
                memberPrice={memberPrice}
                regularPrice={regularPrice}
                setInventoryMode={setInventoryMode}
                setLocalVariants={setLocalVariants}
                setMemberOnly={setMemberOnly}
                setMemberPrice={setMemberPrice}
                setRegularPrice={setRegularPrice}
                setStock={setStock}
                stock={stock}
              />
            )}
            {activeStep === 3 && (
              <PhotosVisibilityStep
                coverPattern={coverPattern}
                linkedEventId={linkedEventId}
                localImages={localImages}
                setCoverPattern={setCoverPattern}
                setLinkedEventId={setLinkedEventId}
                setLocalImages={setLocalImages}
              />
            )}
            {activeStep === 4 && (
              <ReviewStep
                blocksNo={blocksNo}
                campuses={campuses}
                campusId={campusId}
                category={category}
                handleSubmit={handleSubmit}
                isPending={isPending}
                localImages={localImages}
                localVariants={localVariants}
                regularPrice={regularPrice}
                setActiveStep={setActiveStep}
                setStatus={setStatus}
                status={status}
                titleNo={titleNo}
              />
            )}
          </div>
        </div>

        {/* Step nav */}
        <div
          style={{
            alignItems: "center",
            background: "rgba(250,247,242,.92)",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            borderTop: `0.5px solid ${BRAND.rule}`,
            display: "flex",
            gap: 10,
            justifyContent: "space-between",
            padding: "14px 36px",
          }}
        >
          {activeStep > 0 ? (
            <button
              onClick={() => setActiveStep((s) => (s - 1) as 0 | 1 | 2 | 3 | 4)}
              style={{
                alignItems: "center",
                background: "rgba(255,255,255,.7)",
                border: `0.5px solid ${BRAND.rule2}`,
                borderRadius: 8,
                color: BRAND.ink,
                cursor: "pointer",
                display: "flex",
                fontSize: 13.5,
                fontWeight: 500,
                gap: 6,
                padding: "9px 18px",
              }}
              type="button"
            >
              ← Back
            </button>
          ) : (
            <div />
          )}
          <div style={{ alignItems: "center", display: "flex", gap: 10 }}>
            <button
              disabled={isPending}
              onClick={() => handleSubmit("draft")}
              style={{
                alignItems: "center",
                background: "rgba(255,255,255,.7)",
                border: `0.5px solid ${BRAND.rule2}`,
                borderRadius: 8,
                color: BRAND.ink,
                cursor: "pointer",
                display: "flex",
                fontSize: 13,
                fontWeight: 500,
                gap: 6,
                opacity: isPending ? 0.6 : 1,
                padding: "9px 16px",
              }}
              type="button"
            >
              <Save size={13} />
              Save draft
            </button>
            {activeStep < 4 && (
              <button
                onClick={() =>
                  setActiveStep((s) => (s + 1) as 0 | 1 | 2 | 3 | 4)
                }
                style={{
                  alignItems: "center",
                  background: BRAND.ink,
                  border: `0.5px solid ${BRAND.ink}`,
                  borderRadius: 8,
                  color: BRAND.paper,
                  cursor: "pointer",
                  display: "flex",
                  fontSize: 13.5,
                  fontWeight: 500,
                  gap: 6,
                  padding: "9px 18px",
                }}
                type="button"
              >
                Continue · {STEPS[activeStep + 1]} →
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Preview pane */}
      <div
        style={{
          borderLeft: `0.5px solid ${BRAND.rule}`,
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          overflow: "hidden",
          width: 340,
        }}
      >
        <PreviewPane
          blocksNo={blocksNo}
          category={category}
          coverPattern={coverPattern}
          localeLang={localeLang}
          localImages={localImages}
          localVariants={localVariants}
          memberOnly={memberOnly}
          memberPrice={memberPrice}
          regularPrice={regularPrice}
          setLocaleLang={setLocaleLang}
          tags={tags}
          titleEn={titleEn}
          titleNo={titleNo}
        />
      </div>
    </div>
  );
}

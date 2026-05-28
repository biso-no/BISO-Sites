"use client";

import {
  type Campus,
  type Departments,
  JobsStatus,
} from "@repo/api/types/appwrite";
import type { RecruitmentVacancy } from "@repo/shared/types/recruitment";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  CalendarDays,
  Check,
  Globe,
  GripVertical,
  Heading1,
  Languages,
  List,
  Lock,
  Newspaper,
  Pencil,
  Pilcrow,
  Plus,
  Save,
  Send,
  Sparkles,
  Trash2,
  Upload,
  Users,
  Wand2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  createJob,
  generateJobNorwegianDraft,
  listDepartmentsForCampus,
  suggestJobDescriptionSection,
  updateJob,
} from "../../../_actions/jobs";
import { type JobFormValues, jobSchema } from "../../../_actions/schemas";
import { uploadMediaFile } from "../../../_actions/upload";

interface JobStudioEditorProps {
  allowedDepartmentIds?: string[];
  campuses: Campus[];
  canChangeCampus?: boolean;
  defaultCampusId?: string;
  initialDepartments: Departments[];
  isNew: boolean;
  job: RecruitmentVacancy | null;
  labels: {
    back: string;
    publish: string;
    publishSuccess: string;
    saveDraft: string;
    saveError: string;
    saveSuccess: string;
  };
}

const BRAND = {
  accent: "#3DA9E0",
  blue: "#001731",
  claret: "#6b1e1e",
  gold: "#F7D64A",
  green: "#4ade80",
  ink: "#1a1814",
  ink2: "#3a342a",
  ink3: "#6b6357",
  ink4: "#9c9385",
  navy: "#000a16",
  paper: "#faf7f2",
  red: "#f87171",
  rule: "#e5dcca",
  rule2: "#d8cdb6",
} as const;

const STEPS = [
  "Essentials",
  "Description",
  "Logistics",
  "Screening",
  "Visibility",
  "Review",
] as const;

const EMPLOYMENT_TYPES = [
  { value: "", label: "Select type" },
  { value: "full_time", label: "Full-time" },
  { value: "part_time", label: "Part-time" },
  { value: "internship", label: "Internship" },
  { value: "freelance", label: "Freelance" },
  { value: "volunteer", label: "Volunteer" },
] as const;

const TAG_OPTIONS = [
  "Volunteer",
  "Paid",
  "Leadership",
  "International",
  "Marketing",
  "Finance",
  "Tech",
  "Sustainability",
  "One-time",
  "Long-term",
  "Remote-friendly",
] as const;

type LocaleCode = "en" | "no";
type DescriptionBlockType = "h" | "l" | "p";

interface DescriptionBlock {
  id: string;
  text: string;
  type: DescriptionBlockType;
}

function getTranslation(job: RecruitmentVacancy | null, locale: "en" | "no") {
  return job?.translations.find((translation) => translation.locale === locale);
}

function generateSlug(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function toDateInput(value: string | null | undefined) {
  return value ? value.slice(0, 10) : "";
}

function toDateTimeInput(value: string | null | undefined) {
  return value ? value.slice(0, 16) : "";
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "Not set";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function stripHtml(value: string) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}

function newBlock(type: DescriptionBlockType, text = ""): DescriptionBlock {
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    text,
    type,
  };
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

function descriptionBlocksToHtml(blocks: DescriptionBlock[]) {
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

function fallback<T>(value: T | null | undefined, fallbackValue: T): T {
  return value ?? fallbackValue;
}

function buildDefaultValues(
  job: RecruitmentVacancy | null,
  campuses: Campus[],
  defaultCampusId?: string
): JobFormValues {
  const no = getTranslation(job, "no");
  const en = getTranslation(job, "en");
  const effectiveCampusId = defaultCampusId ?? campuses[0]?.$id ?? "";
  const metadata = job?.metadata;

  return {
    application_deadline: fallback(job?.application_deadline, null),
    audience: fallback(metadata?.audience, "members"),
    auto_translate: Boolean(metadata?.auto_translate),
    campus_id: fallback(job?.campus_id, effectiveCampusId),
    commitment: fallback(metadata?.commitment, null),
    company: fallback(metadata?.company, null),
    contact_email: fallback(metadata?.contact_email, null),
    contact_name: fallback(metadata?.contact_name, null),
    contact_role: fallback(metadata?.contact_role, null),
    cover_image_file_id: fallback(metadata?.cover_image_file_id, null),
    cover_image_url: fallback(metadata?.cover_image_url, null),
    cover_pattern: fallback(metadata?.cover_pattern, 1),
    cv_required: Boolean(metadata?.cv_required),
    department_id: fallback(job?.department_id, null),
    description_en: fallback(en?.description, ""),
    description_no: fallback(no?.description, ""),
    employment_type: fallback(metadata?.employment_type, null),
    location: fallback(metadata?.location, null),
    newsletter: Boolean(metadata?.newsletter),
    paid: Boolean(metadata?.paid),
    publication_mode: fallback(metadata?.publication_mode, "now"),
    push_to_inboxes: Boolean(metadata?.push_to_inboxes),
    scheduled_publish_at: fallback(metadata?.scheduled_publish_at, null),
    short_description: fallback(metadata?.short_description, null),
    slug: fallback(job?.slug, ""),
    start_date: fallback(metadata?.start_date, null),
    status: fallback(job?.status, JobsStatus.DRAFT),
    tags: fallback(metadata?.tags, []),
    term: fallback(metadata?.term, null),
    title_en: fallback(en?.title, ""),
    title_no: fallback(no?.title, ""),
    auto_screen: job?.auto_screen ?? true,
    custom_questions: [],
    interview_template: { rounds: [] },
    screening_rubric: job?.screening_rubric ?? {
      must_have: [],
      nice_to_have: [],
      criteria: [],
    },
  };
}

function inputClass(extra = "") {
  return `w-full rounded-lg border border-slate-300/80 bg-white/75 px-3 py-2.5 text-sm text-[#07111f] outline-none transition placeholder:text-slate-400 focus:border-[#3DA9E0] focus:bg-white focus:ring-2 focus:ring-[#3DA9E0]/15 ${extra}`;
}

function Field({
  children,
  help,
  label,
  required,
}: {
  children: React.ReactNode;
  help?: string;
  label: string;
  required?: boolean;
}) {
  return (
    <div className="grid gap-1.5">
      <span className="flex items-center gap-2 font-medium text-[11px] text-slate-500 uppercase tracking-[0.12em]">
        {label}
        {required && <span className="text-red-500">*</span>}
        {help && (
          <span className="ml-auto text-[10px] normal-case tracking-normal">
            {help}
          </span>
        )}
      </span>
      {children}
    </div>
  );
}

function LocaleTabs({
  locale,
  setLocale,
}: {
  locale: LocaleCode;
  setLocale: (locale: LocaleCode) => void;
}) {
  return (
    <div className="inline-flex shrink-0 rounded-lg border border-slate-200 bg-slate-100 p-1">
      {(["en", "no"] as const).map((item) => (
        <button
          className="rounded-md px-3 py-1.5 font-medium text-xs"
          key={item}
          onClick={() => setLocale(item)}
          style={
            locale === item
              ? { background: "#fff", color: BRAND.blue }
              : { color: "#64748b" }
          }
          type="button"
        >
          {item.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

function StepRail({
  dirty,
  locale,
  setLocale,
  setStep,
  step,
}: {
  dirty: boolean;
  locale: LocaleCode;
  setLocale: (locale: LocaleCode) => void;
  setStep: (step: number) => void;
  step: number;
}) {
  return (
    <div className="sticky top-0 z-20 flex items-center gap-2 border-slate-200 border-b bg-[#faf7f2]/90 px-4 py-3 backdrop-blur-xl md:px-8">
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        {STEPS.map((name, index) => {
          const active = index === step;
          const done = index < step;
          return (
            <button
              className="inline-flex shrink-0 items-center gap-2 rounded-full px-2 py-1.5 pr-3 text-xs transition"
              key={name}
              onClick={() => setStep(index)}
              style={
                active
                  ? { background: BRAND.blue, color: "#fff" }
                  : { color: done ? "#15803d" : "#64748b" }
              }
              type="button"
            >
              <span
                className="grid h-6 w-6 place-items-center rounded-full border text-[10px]"
                style={{
                  background: done ? "#16a34a" : "#fff",
                  borderColor: done ? "#16a34a" : "rgba(100,116,139,0.25)",
                  color: done ? "#fff" : BRAND.blue,
                }}
              >
                {done ? (
                  <Check size={12} />
                ) : (
                  String(index + 1).padStart(2, "0")
                )}
              </span>
              {name}
            </button>
          );
        })}
      </div>
      {dirty && (
        <span className="hidden items-center gap-1.5 text-slate-500 text-xs sm:inline-flex">
          <span className="h-1.5 w-1.5 rounded-full bg-[#F7D64A]" />
          Unsaved
        </span>
      )}
      <LocaleTabs locale={locale} setLocale={setLocale} />
    </div>
  );
}

function CoverPattern({ value }: { value: number | null | undefined }) {
  const pattern = value ?? 1;
  if (pattern === 2) {
    return (
      <svg
        aria-hidden
        className="absolute inset-0 h-full w-full opacity-35"
        viewBox="0 0 200 130"
      >
        <title>Decorative line pattern</title>
        {Array.from({ length: 8 }).map((_, index) => (
          <line
            key={index}
            stroke="white"
            strokeWidth="0.5"
            x1="0"
            x2="200"
            y1={index * 18}
            y2={index * 18 - 30}
          />
        ))}
      </svg>
    );
  }
  if (pattern === 3) {
    return (
      <svg
        aria-hidden
        className="absolute inset-0 h-full w-full opacity-35"
        viewBox="0 0 200 130"
      >
        <title>Decorative circle pattern</title>
        {[80, 60, 40].map((radius) => (
          <circle
            cx="160"
            cy="20"
            fill="none"
            key={radius}
            r={radius}
            stroke="white"
            strokeWidth="0.5"
          />
        ))}
      </svg>
    );
  }
  if (pattern === 4) {
    return (
      <svg
        aria-hidden
        className="absolute inset-0 h-full w-full opacity-30"
        viewBox="0 0 200 130"
      >
        <title>Decorative wave pattern</title>
        <path
          d="M0 92 C44 56 70 128 120 72 C150 38 166 44 200 18"
          fill="none"
          stroke="white"
          strokeWidth="1"
        />
        <path
          d="M0 44 C46 22 82 78 118 32 C144 0 176 22 200 8"
          fill="none"
          stroke="white"
          strokeWidth="0.7"
        />
      </svg>
    );
  }
  if (pattern === 5) {
    return null;
  }
  return (
    <svg
      aria-hidden
      className="absolute inset-0 h-full w-full opacity-35"
      viewBox="0 0 200 130"
    >
      <title>Decorative dot pattern</title>
      <defs>
        <pattern
          height="14"
          id="job-dots"
          patternUnits="userSpaceOnUse"
          width="14"
        >
          <circle cx="2" cy="2" fill="white" r="1" />
        </pattern>
      </defs>
      <rect fill="url(#job-dots)" height="130" width="200" />
    </svg>
  );
}

function coverBackground(value: number | null | undefined) {
  switch (value ?? 1) {
    case 2:
      return "linear-gradient(135deg, #3DA9E0 0%, #001731 100%)";
    case 3:
      return "linear-gradient(135deg, #4ade80 0%, #001731 100%)";
    case 4:
      return "linear-gradient(135deg, #F7D64A 0%, #001731 100%)";
    case 5:
      return "linear-gradient(180deg, #001731 0%, #000a16 100%)";
    default:
      return "linear-gradient(135deg, #001731 0%, #0b3158 100%)";
  }
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

  let placeholder = "Tell the story. What does a Tuesday afternoon look like?";
  if (block.type === "h") {
    placeholder = "Section heading…";
  } else if (block.type === "l") {
    placeholder = "A responsibility, a perk, a requirement…";
  }

  const contentStyle: React.CSSProperties = (() => {
    if (block.type === "h") {
      return {
        color: BRAND.ink,
        fontFamily: "'Instrument Serif', Georgia, serif",
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
        color: BRAND.ink2,
        fontSize: 15.5,
        lineHeight: 1.6,
        minHeight: 24,
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
              style={{
                background: BRAND.rule,
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

function DescriptionBlockEditor({
  onChange,
  value,
}: {
  onChange: (value: string) => void;
  value: string;
}) {
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
        <div style={{ background: BRAND.rule, flex: 1, height: 0.5 }} />
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
        <div style={{ background: BRAND.rule, flex: 1, height: 0.5 }} />
      </div>
    </div>
  );
}

function descAddBtnStyle(): React.CSSProperties {
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

function PhonePreview({
  campusName,
  departmentName,
  form,
  phoneFloat,
  locale,
}: {
  campusName: string;
  departmentName: string;
  form: JobFormValues;
  locale: LocaleCode;
  phoneFloat: boolean;
}) {
  const title = locale === "no" ? form.title_no : form.title_en;
  const body = locale === "no" ? form.description_no : form.description_en;
  const descriptionBlocks = useMemo(
    () =>
      htmlToDescriptionBlocks(body).filter(
        (block) => block.text.trim().length > 0
      ),
    [body]
  );
  const teaser =
    form.short_description ??
    stripHtml(body).slice(0, 150) ??
    "Add a teaser to show students why this role matters.";
  const crest = departmentName.charAt(0).toUpperCase() || "B";

  return (
    <div
      className="mx-auto w-77.5 max-w-full rounded-4xl bg-[#07111f] p-2 shadow-2xl shadow-slate-950/30"
      style={{
        animation: phoneFloat
          ? "job-phone-drift 8s ease-in-out infinite"
          : "none",
      }}
    >
      <style>{`
        @keyframes job-phone-drift {
          0% { transform: translate(0, 0) rotate(0deg); }
          50% { transform: translate(8px, -6px) rotate(0.4deg); }
          100% { transform: translate(0, 0) rotate(0deg); }
        }
        [contenteditable][data-placeholder]:empty::before {
          content: attr(data-placeholder);
          color: rgb(203 213 225);
          font-style: italic;
        }
        .job-preview-scroll {
          scrollbar-width: none;
        }
        .job-preview-scroll::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      <div className="relative flex h-155 flex-col overflow-hidden rounded-[1.55rem] bg-[#faf7f2] text-[#07111f]">
        <div className="flex items-center justify-between px-5 pt-3 pb-2 font-semibold text-[11px]">
          <span>09:41</span>
          <span>LTE 84%</span>
        </div>
        <div className="flex items-center gap-2 px-4 pb-3 text-slate-500 text-xs">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-slate-200">
            <ArrowLeft size={14} />
          </span>
          Jobs
        </div>
        <div className="job-preview-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div
            className="relative h-34 overflow-hidden"
            style={
              form.cover_image_url
                ? {
                    backgroundImage: `linear-gradient(135deg, rgba(0, 23, 49, 0.28), rgba(0, 10, 22, 0.52)), url(${form.cover_image_url})`,
                    backgroundPosition: "center",
                    backgroundSize: "cover",
                  }
                : { background: coverBackground(form.cover_pattern) }
            }
          >
            {!form.cover_image_url && (
              <CoverPattern value={form.cover_pattern} />
            )}
            <span className="absolute top-3 left-3 rounded-full border border-white/25 bg-white/15 px-2 py-1 text-[9px] text-white uppercase tracking-[0.12em] backdrop-blur">
              {form.audience === "public" ? "Open to all" : "Members only"}
            </span>
            <span className="absolute right-4 bottom-4 grid h-11 w-11 place-items-center rounded-xl bg-white/95 font-light text-2xl">
              {crest}
            </span>
          </div>
          <div className="space-y-3 px-5 py-4">
            <p className="text-[11px] text-slate-500">
              {departmentName} · {campusName}
            </p>
            <h2 className="font-light text-3xl leading-none tracking-tight">
              {title || "Your job title"}
            </h2>
            <p className="text-slate-600 text-sm leading-5">{teaser}</p>
            <div className="flex flex-wrap gap-1.5">
              {form.tags.map((tag) => (
                <span
                  className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] text-slate-600"
                  key={tag}
                >
                  {tag}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-slate-200 bg-slate-200">
              {[
                ["Commitment", form.commitment ?? "TBC"],
                ["Term", form.term ?? "TBC"],
                ["Starts", formatDate(form.start_date)],
                ["Location", form.location ?? "Campus"],
              ].map(([label, value]) => (
                <div className="bg-[#faf7f2] p-2.5" key={label}>
                  <p className="text-[9px] text-slate-400 uppercase tracking-widest">
                    {label}
                  </p>
                  <p className="mt-1 truncate font-medium text-[11px]">
                    {value}
                  </p>
                </div>
              ))}
            </div>
            <div className="space-y-2 text-slate-600 text-xs leading-5">
              {descriptionBlocks.map((block) => {
                if (block.type === "h") {
                  return (
                    <h4
                      className="pt-1 font-light text-[#07111f] text-base leading-tight"
                      key={block.id}
                    >
                      {block.text}
                    </h4>
                  );
                }

                if (block.type === "l") {
                  return (
                    <p className="flex gap-2" key={block.id}>
                      <span className="mt-2 h-px w-2 shrink-0 bg-[#3DA9E0]" />
                      <span>{block.text}</span>
                    </p>
                  );
                }

                return <p key={block.id}>{block.text}</p>;
              })}
            </div>
          </div>
        </div>
        <div className="border-slate-200 border-t bg-[#faf7f2]/90 px-4 py-3">
          <div className="mb-2 flex justify-between text-[11px] text-slate-500">
            <span>Application deadline</span>
            <span className="font-mono text-[#001731]">
              {formatDate(form.application_deadline)}
            </span>
          </div>
          <button
            className="h-10 w-full rounded-full bg-[#001731] font-medium text-sm text-white"
            type="button"
          >
            Apply now
          </button>
        </div>
      </div>
    </div>
  );
}

function ProgressBar({ step }: { step: number }) {
  const progress = Math.round(((step + 1) / STEPS.length) * 100);
  return (
    <div className="flex items-center gap-3 text-slate-500 text-xs">
      <span>Completeness</span>
      <div className="h-1.5 w-32 overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-[#001731]"
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className="font-mono">{progress}%</span>
    </div>
  );
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: This component coordinates the persisted multi-step job editor state.
export function JobStudioEditor({
  allowedDepartmentIds,
  campuses,
  canChangeCampus = true,
  defaultCampusId,
  initialDepartments,
  isNew,
  job,
  labels,
}: JobStudioEditorProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [locale, setLocale] = useState<LocaleCode>("en");
  const [phoneFloat, setPhoneFloat] = useState(true);
  const [departments, setDepartments] = useState(initialDepartments);
  const [form, setForm] = useState(() => {
    const defaults = buildDefaultValues(job, campuses, defaultCampusId);
    if (!job && allowedDepartmentIds?.length === 1) {
      defaults.department_id = allowedDepartmentIds[0] ?? null;
    }
    return defaults;
  });
  const [dirty, setDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const campusName = useMemo(
    () =>
      campuses.find((campus) => campus.$id === form.campus_id)?.name ??
      "Campus",
    [campuses, form.campus_id]
  );
  const departmentName = useMemo(
    () =>
      departments.find((department) => department.$id === form.department_id)
        ?.Name ?? "Any department",
    [departments, form.department_id]
  );

  function setValue<K extends keyof JobFormValues>(
    key: K,
    value: JobFormValues[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }));
    setDirty(true);
  }

  async function handleCampusChange(campusId: string) {
    setValue("campus_id", campusId);
    setValue("department_id", null);
    const nextDepartments = campusId
      ? await listDepartmentsForCampus(campusId)
      : [];
    setDepartments(nextDepartments);
  }

  function toggleTag(tag: string) {
    const next = form.tags.includes(tag)
      ? form.tags.filter((item) => item !== tag)
      : [...form.tags, tag].slice(0, 4);
    setValue("tags", next);
  }

  function setLocalizedTitle(value: string) {
    if (locale === "en") {
      setValue("title_en", value);
      return;
    }
    setValue("title_no", value);
  }

  function setLocalizedDescription(value: string) {
    if (locale === "en") {
      setValue("description_en", value);
      return;
    }
    setValue("description_no", value);
  }

  async function handleTranslateToNorwegian() {
    setIsTranslating(true);
    const result = await generateJobNorwegianDraft({
      description_en: form.description_en,
      short_description: form.short_description,
      title_en: form.title_en,
    });
    setIsTranslating(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }
    if (!result.data) {
      toast.error("Failed to generate Norwegian draft");
      return;
    }

    setForm((current) => ({
      ...current,
      auto_translate: true,
      description_no: result.data.description_no,
      short_description: result.data.short_description,
      title_no: result.data.title_no,
    }));
    setDirty(true);
    setLocale("no");
    toast.success("Norwegian draft generated");
  }

  async function handleSuggestDescriptionSection() {
    const title = locale === "no" ? form.title_no : form.title_en;
    const description =
      locale === "no" ? form.description_no : form.description_en;
    setIsSuggesting(true);
    const result = await suggestJobDescriptionSection({
      campus: campusName,
      commitment: form.commitment,
      department: departmentName,
      description,
      locale,
      tags: form.tags,
      title,
    });
    setIsSuggesting(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }
    if (!result.data) {
      toast.error("Failed to suggest a description section");
      return;
    }

    const nextBlocks = [
      ...htmlToDescriptionBlocks(description),
      newBlock("h", result.data.heading),
      ...result.data.bullets.map((bullet) => newBlock("l", bullet)),
    ];
    setLocalizedDescription(descriptionBlocksToHtml(nextBlocks));
    toast.success("Description section added");
  }

  async function handleCoverFile(file: File | null | undefined) {
    if (!file) {
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    setIsUploading(true);
    const result = await uploadMediaFile(formData);
    setIsUploading(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    setForm((current) => ({
      ...current,
      cover_image_file_id: result.fileId,
      cover_image_url: result.url,
    }));
    setDirty(true);
    toast.success("Cover image uploaded");
  }

  async function submit(status: JobsStatus) {
    const payload = { ...form, status };
    const validated = jobSchema.safeParse(payload);
    if (!validated.success) {
      toast.error(labels.saveError);
      return;
    }

    if (status === JobsStatus.PUBLISHED) {
      setIsPublishing(true);
    } else {
      setIsSaving(true);
    }

    const result = isNew
      ? await createJob(validated.data)
      : await updateJob(job!.$id, validated.data);

    setIsPublishing(false);
    setIsSaving(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    setDirty(false);
    toast.success(
      status === JobsStatus.PUBLISHED
        ? labels.publishSuccess
        : labels.saveSuccess
    );

    if (isNew && result.data) {
      router.push(`/jobs/${result.data}`);
      return;
    }

    router.refresh();
  }

  return (
    <div className="-m-8 min-h-screen overflow-hidden rounded-none bg-[#faf7f2] text-[#07111f] md:-m-12">
      <div className="flex min-h-screen flex-col">
        <header className="flex items-center gap-3 border-slate-200 border-b bg-[#faf7f2] px-4 py-4 md:px-8">
          <Link
            aria-label={labels.back}
            className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:text-[#001731]"
            href="/jobs"
          >
            <ArrowLeft size={16} />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-[#3DA9E0] text-[11px] uppercase tracking-[0.16em]">
              BISO recruitment studio
            </p>
            <h1 className="truncate font-light text-2xl tracking-tight md:text-3xl">
              {isNew
                ? "New vacancy"
                : form.title_en || form.title_no || "Edit vacancy"}
            </h1>
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <button
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 font-medium text-slate-600 text-sm transition hover:text-[#001731]"
              onClick={() => router.push("/jobs")}
              type="button"
            >
              Discard
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 font-medium text-[#001731] text-sm transition hover:border-[#3DA9E0]/50"
              disabled={isSaving}
              onClick={() => submit(JobsStatus.DRAFT)}
              type="button"
            >
              <Save size={15} />
              {isSaving ? "Saving..." : labels.saveDraft}
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-lg bg-[#001731] px-4 py-2 font-medium text-sm text-white shadow-lg shadow-slate-950/10 transition hover:-translate-y-0.5"
              disabled={isPublishing}
              onClick={() => submit(JobsStatus.PUBLISHED)}
              type="button"
            >
              <Send size={15} />
              {isPublishing ? "Publishing..." : labels.publish}
            </button>
          </div>
        </header>

        <StepRail
          dirty={dirty}
          locale={locale}
          setLocale={setLocale}
          setStep={setStep}
          step={step}
        />

        <main className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(360px,460px)]">
          <section className="min-h-0 overflow-y-auto px-4 py-8 md:px-8">
            <div className="mx-auto max-w-3xl">
              <div className="mb-7 flex items-center gap-3 text-slate-500 text-xs">
                <span className="font-medium uppercase tracking-[0.12em]">
                  {departmentName} · {campusName}
                </span>
                <span className="h-1 w-1 rounded-full bg-slate-300" />
                <span>
                  Step {step + 1} of {STEPS.length} · {STEPS[step]}
                </span>
              </div>

              {step === 0 && (
                <div className="space-y-7">
                  <div>
                    <p className="mb-3 font-medium text-[11px] text-slate-500 uppercase tracking-[0.12em]">
                      {locale === "en" ? "English source" : "Norwegian"}
                    </p>
                    <input
                      className="w-full bg-transparent font-light text-5xl leading-none tracking-tight outline-none placeholder:text-slate-300 md:text-6xl"
                      onBlur={() => {
                        if (!form.slug) {
                          setValue(
                            "slug",
                            generateSlug(form.title_en || form.title_no)
                          );
                        }
                      }}
                      onChange={(event) =>
                        setLocalizedTitle(event.target.value)
                      }
                      placeholder="A job title that excites..."
                      value={locale === "en" ? form.title_en : form.title_no}
                    />
                    <div className="mt-4 inline-flex max-w-full items-center gap-2 rounded-lg border border-slate-200 bg-white/70 px-3 py-2 font-mono text-slate-500 text-xs">
                      <span>biso.no/jobs/</span>
                      <input
                        className="min-w-0 bg-transparent text-[#001731] outline-none"
                        onChange={(event) =>
                          setValue("slug", event.target.value)
                        }
                        value={form.slug}
                      />
                      <Pencil size={12} />
                    </div>
                  </div>

                  <div className="grid gap-5 md:grid-cols-2">
                    <Field label="Campus" required>
                      <select
                        className={inputClass()}
                        disabled={!canChangeCampus}
                        onChange={(event) =>
                          handleCampusChange(event.target.value)
                        }
                        value={form.campus_id}
                      >
                        <option value="">Select campus</option>
                        {campuses.map((campus) => (
                          <option key={campus.$id} value={campus.$id}>
                            {campus.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Department">
                      <select
                        className={inputClass()}
                        disabled={
                          allowedDepartmentIds !== undefined &&
                          allowedDepartmentIds.length <= 1
                        }
                        onChange={(event) =>
                          setValue("department_id", event.target.value || null)
                        }
                        value={form.department_id ?? ""}
                      >
                        <option value="">Any department</option>
                        {departments.map((department) => (
                          <option key={department.$id} value={department.$id}>
                            {department.Name}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>

                  <Field
                    help={`${Math.max(0, 280 - (form.short_description?.length ?? 0))} characters left`}
                    label="One-line teaser"
                    required
                  >
                    <textarea
                      className={inputClass("min-h-24 resize-none text-base")}
                      onChange={(event) =>
                        setValue(
                          "short_description",
                          event.target.value || null
                        )
                      }
                      placeholder="Why should someone apply for this role?"
                      value={form.short_description ?? ""}
                    />
                  </Field>

                  <Field label="Tags">
                    <div className="flex flex-wrap gap-2">
                      {TAG_OPTIONS.map((tag) => {
                        const active = form.tags.includes(tag);
                        return (
                          <button
                            className="rounded-full border px-3 py-2 font-medium text-xs transition"
                            key={tag}
                            onClick={() => toggleTag(tag)}
                            style={
                              active
                                ? {
                                    background: BRAND.blue,
                                    borderColor: BRAND.blue,
                                    color: "#fff",
                                  }
                                : {
                                    background: "rgba(255,255,255,0.72)",
                                    borderColor: "rgba(148,163,184,0.35)",
                                    color: "#475569",
                                  }
                            }
                            type="button"
                          >
                            {tag}
                          </button>
                        );
                      })}
                    </div>
                  </Field>

                  <div className="flex gap-3 rounded-xl border border-[#F7D64A]/45 bg-[#F7D64A]/10 p-4">
                    <Sparkles
                      className="mt-0.5 shrink-0 text-[#a16207]"
                      size={20}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm">Translation helper</p>
                      <p className="mt-1 text-slate-600 text-sm">
                        Generate a Norwegian draft from the English title,
                        teaser, and description. Review before publishing.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          className="inline-flex items-center gap-2 rounded-lg bg-[#001731] px-3 py-2 font-medium text-sm text-white transition disabled:cursor-not-allowed disabled:opacity-55"
                          disabled={
                            isTranslating ||
                            !form.title_en.trim() ||
                            !stripHtml(form.description_en).trim()
                          }
                          onClick={handleTranslateToNorwegian}
                          type="button"
                        >
                          <Languages size={15} />
                          {isTranslating
                            ? "Generating..."
                            : "Generate Norwegian"}
                        </button>
                        <button
                          className="inline-flex items-center gap-2 rounded-lg border border-[#F7D64A]/50 bg-white/60 px-3 py-2 font-medium text-[#713f12] text-sm"
                          onClick={() =>
                            setValue("auto_translate", !form.auto_translate)
                          }
                          type="button"
                        >
                          <Wand2 size={15} />
                          Auto-translate {form.auto_translate ? "on" : "off"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="font-light text-4xl tracking-tight">
                      The whole story.
                    </h2>
                    <p className="mt-2 max-w-xl text-slate-500 text-sm">
                      Write it like you would in a lightweight document editor.
                      Switch language in the rail above; the block surface stays
                      in the same place.
                    </p>
                  </div>
                  <DescriptionBlockEditor
                    onChange={setLocalizedDescription}
                    value={
                      locale === "en"
                        ? form.description_en
                        : form.description_no
                    }
                  />
                  <div className="flex gap-3 rounded-xl border border-[#F7D64A]/45 bg-[#F7D64A]/10 p-4">
                    <Sparkles
                      className="mt-0.5 shrink-0 text-[#a16207]"
                      size={20}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm">
                        Need another section?
                      </p>
                      <p className="mt-1 text-slate-600 text-sm">
                        Ask the assistant for one focused section based on the
                        current title, tags, campus, and department.
                      </p>
                      <button
                        className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#001731] px-3 py-2 font-medium text-sm text-white transition disabled:cursor-not-allowed disabled:opacity-55"
                        disabled={
                          isSuggesting ||
                          !(locale === "no" ? form.title_no : form.title_en)
                        }
                        onClick={handleSuggestDescriptionSection}
                        type="button"
                      >
                        <Sparkles size={15} />
                        {isSuggesting ? "Suggesting..." : "Suggest section"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="font-light text-4xl tracking-tight">
                      Time, place, paperwork.
                    </h2>
                    <p className="mt-2 max-w-xl text-slate-500 text-sm">
                      Practical details are optional unless your publishing
                      policy requires them.
                    </p>
                  </div>
                  <div className="grid gap-5 md:grid-cols-2">
                    <Field label="Company">
                      <input
                        className={inputClass()}
                        onChange={(event) =>
                          setValue("company", event.target.value || null)
                        }
                        placeholder="BISO"
                        value={form.company ?? ""}
                      />
                    </Field>
                    <Field label="Employment type">
                      <select
                        className={inputClass()}
                        onChange={(event) =>
                          setValue(
                            "employment_type",
                            event.target.value || null
                          )
                        }
                        value={form.employment_type ?? ""}
                      >
                        {EMPLOYMENT_TYPES.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Weekly commitment">
                      <input
                        className={inputClass()}
                        onChange={(event) =>
                          setValue("commitment", event.target.value || null)
                        }
                        placeholder="6 h/week"
                        value={form.commitment ?? ""}
                      />
                    </Field>
                    <Field label="Term length">
                      <input
                        className={inputClass()}
                        onChange={(event) =>
                          setValue("term", event.target.value || null)
                        }
                        placeholder="1 semester"
                        value={form.term ?? ""}
                      />
                    </Field>
                    <Field label="Start date">
                      <input
                        className={inputClass()}
                        onChange={(event) =>
                          setValue("start_date", event.target.value || null)
                        }
                        type="date"
                        value={toDateInput(form.start_date)}
                      />
                    </Field>
                    <Field label="Application deadline">
                      <input
                        className={inputClass()}
                        onChange={(event) =>
                          setValue(
                            "application_deadline",
                            event.target.value || null
                          )
                        }
                        type="date"
                        value={toDateInput(form.application_deadline)}
                      />
                    </Field>
                  </div>
                  <Field label="Location">
                    <input
                      className={inputClass()}
                      onChange={(event) =>
                        setValue("location", event.target.value || null)
                      }
                      placeholder="BI Oslo, Nydalen"
                      value={form.location ?? ""}
                    />
                  </Field>
                  <div className="grid gap-5 md:grid-cols-3">
                    <Field label="Contact name">
                      <input
                        className={inputClass()}
                        onChange={(event) =>
                          setValue("contact_name", event.target.value || null)
                        }
                        value={form.contact_name ?? ""}
                      />
                    </Field>
                    <Field label="Contact role">
                      <input
                        className={inputClass()}
                        onChange={(event) =>
                          setValue("contact_role", event.target.value || null)
                        }
                        value={form.contact_role ?? ""}
                      />
                    </Field>
                    <Field label="Contact email">
                      <input
                        className={inputClass()}
                        onChange={(event) =>
                          setValue("contact_email", event.target.value || null)
                        }
                        type="email"
                        value={form.contact_email ?? ""}
                      />
                    </Field>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white/70 p-4 text-sm">
                      <input
                        checked={form.paid}
                        onChange={(event) =>
                          setValue("paid", event.target.checked)
                        }
                        type="checkbox"
                      />
                      Paid vacancy
                    </label>
                    <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white/70 p-4 text-sm">
                      <input
                        checked={form.cv_required}
                        onChange={(event) =>
                          setValue("cv_required", event.target.checked)
                        }
                        type="checkbox"
                      />
                      Require CV upload
                    </label>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="font-light text-4xl tracking-tight">
                      AI screening.
                    </h2>
                    <p className="mt-2 max-w-xl text-slate-500 text-sm">
                      Enable automatic screening to let Claude evaluate each
                      application against your rubric and assign a score.
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    {[
                      {
                        description:
                          "Claude evaluates each application and assigns a score when it arrives.",
                        icon: Sparkles,
                        label: "Auto-screen enabled",
                        value: true,
                      },
                      {
                        description:
                          "Applications are not automatically screened. HR reviews each one manually.",
                        icon: Users,
                        label: "Manual review only",
                        value: false,
                      },
                    ].map((option) => {
                      const active = form.auto_screen === option.value;
                      return (
                        <button
                          className="relative rounded-xl border p-5 text-left transition"
                          key={String(option.value)}
                          onClick={() => setValue("auto_screen", option.value)}
                          style={
                            active
                              ? {
                                  background: BRAND.blue,
                                  borderColor: BRAND.blue,
                                  color: "#fff",
                                }
                              : {
                                  background: "rgba(255,255,255,0.72)",
                                  borderColor: "rgba(148,163,184,0.35)",
                                  color: "#07111f",
                                }
                          }
                          type="button"
                        >
                          <option.icon size={20} />
                          <p className="mt-3 font-medium">{option.label}</p>
                          <p
                            className={
                              active
                                ? "mt-2 text-sm text-white/65"
                                : "mt-2 text-slate-500 text-sm"
                            }
                          >
                            {option.description}
                          </p>
                          {active && (
                            <span className="absolute top-4 right-4 grid h-5 w-5 place-items-center rounded-full bg-[#4ade80] text-white">
                              <Check size={12} />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {form.auto_screen && (
                    <div className="space-y-4">
                      <p className="font-medium text-[11px] text-slate-500 uppercase tracking-[0.12em]">
                        Screening rubric
                      </p>

                      <div className="rounded-xl border border-slate-200 bg-white/65 p-5">
                        <p className="mb-1 font-medium text-sm">
                          Must-have qualifications
                        </p>
                        <p className="mb-4 text-slate-500 text-xs">
                          Requirements that every candidate must meet. Heavily
                          weighted in AI scoring.
                        </p>
                        <div className="mb-3 flex flex-wrap gap-2">
                          {(form.screening_rubric?.must_have ?? []).map(
                            (item) => (
                              <span
                                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs"
                                key={item}
                              >
                                {item}
                                <button
                                  onClick={() =>
                                    setValue("screening_rubric", {
                                      ...(form.screening_rubric ?? {
                                        must_have: [],
                                        nice_to_have: [],
                                        criteria: [],
                                      }),
                                      must_have: (
                                        form.screening_rubric?.must_have ?? []
                                      ).filter((h) => h !== item),
                                    })
                                  }
                                  type="button"
                                >
                                  <Trash2
                                    className="text-slate-400 hover:text-[#6b1e1e]"
                                    size={11}
                                  />
                                </button>
                              </span>
                            )
                          )}
                          {(form.screening_rubric?.must_have ?? []).length ===
                            0 && (
                            <p className="text-slate-400 text-xs">
                              No requirements added yet.
                            </p>
                          )}
                        </div>
                        <form
                          className="flex gap-2"
                          onSubmit={(event) => {
                            event.preventDefault();
                            const fd = new FormData(event.currentTarget);
                            const val = String(fd.get("mh") ?? "").trim();
                            if (
                              !val ||
                              (form.screening_rubric?.must_have ?? []).includes(
                                val
                              )
                            ) {
                              return;
                            }
                            setValue("screening_rubric", {
                              ...(form.screening_rubric ?? {
                                must_have: [],
                                nice_to_have: [],
                                criteria: [],
                              }),
                              must_have: [
                                ...(form.screening_rubric?.must_have ?? []),
                                val,
                              ].slice(0, 20),
                            });
                            event.currentTarget.reset();
                          }}
                        >
                          <input
                            className={inputClass("flex-1")}
                            name="mh"
                            placeholder="e.g. 2+ years React experience"
                          />
                          <button
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#001731] px-3 py-2 font-medium text-sm text-white"
                            type="submit"
                          >
                            <Plus size={14} />
                            Add
                          </button>
                        </form>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-white/65 p-5">
                        <p className="mb-1 font-medium text-sm">
                          Nice-to-have qualifications
                        </p>
                        <p className="mb-4 text-slate-500 text-xs">
                          Preferred but not essential. Boost scores when
                          present.
                        </p>
                        <div className="mb-3 flex flex-wrap gap-2">
                          {(form.screening_rubric?.nice_to_have ?? []).map(
                            (item) => (
                              <span
                                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs"
                                key={item}
                              >
                                {item}
                                <button
                                  onClick={() =>
                                    setValue("screening_rubric", {
                                      ...(form.screening_rubric ?? {
                                        must_have: [],
                                        nice_to_have: [],
                                        criteria: [],
                                      }),
                                      nice_to_have: (
                                        form.screening_rubric?.nice_to_have ??
                                        []
                                      ).filter((h) => h !== item),
                                    })
                                  }
                                  type="button"
                                >
                                  <Trash2
                                    className="text-slate-400 hover:text-[#6b1e1e]"
                                    size={11}
                                  />
                                </button>
                              </span>
                            )
                          )}
                          {(form.screening_rubric?.nice_to_have ?? [])
                            .length === 0 && (
                            <p className="text-slate-400 text-xs">
                              No preferences added yet.
                            </p>
                          )}
                        </div>
                        <form
                          className="flex gap-2"
                          onSubmit={(event) => {
                            event.preventDefault();
                            const fd = new FormData(event.currentTarget);
                            const val = String(fd.get("nth") ?? "").trim();
                            if (
                              !val ||
                              (
                                form.screening_rubric?.nice_to_have ?? []
                              ).includes(val)
                            ) {
                              return;
                            }
                            setValue("screening_rubric", {
                              ...(form.screening_rubric ?? {
                                must_have: [],
                                nice_to_have: [],
                                criteria: [],
                              }),
                              nice_to_have: [
                                ...(form.screening_rubric?.nice_to_have ?? []),
                                val,
                              ].slice(0, 20),
                            });
                            event.currentTarget.reset();
                          }}
                        >
                          <input
                            className={inputClass("flex-1")}
                            name="nth"
                            placeholder="e.g. Familiarity with TypeScript"
                          />
                          <button
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#001731] px-3 py-2 font-medium text-sm text-white"
                            type="submit"
                          >
                            <Plus size={14} />
                            Add
                          </button>
                        </form>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {step === 4 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="font-light text-4xl tracking-tight">
                      Who gets to see this?
                    </h2>
                    <p className="mt-2 max-w-xl text-slate-500 text-sm">
                      Audience, artwork, distribution, and scheduling are stored
                      with the posting so launch prep can happen in one pass.
                    </p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    {[
                      {
                        description:
                          "Visible to verified BI students with active member access.",
                        icon: Lock,
                        label: "Members only",
                        value: "members",
                      },
                      {
                        description:
                          "Visible on the public job board for broader recruitment.",
                        icon: Globe,
                        label: "Public",
                        value: "public",
                      },
                    ].map((option) => {
                      const active = form.audience === option.value;
                      return (
                        <button
                          className="relative rounded-xl border p-5 text-left transition"
                          key={option.value}
                          onClick={() =>
                            setValue(
                              "audience",
                              option.value as JobFormValues["audience"]
                            )
                          }
                          style={
                            active
                              ? {
                                  background: BRAND.blue,
                                  borderColor: BRAND.blue,
                                  color: "#fff",
                                }
                              : {
                                  background: "rgba(255,255,255,0.72)",
                                  borderColor: "rgba(148,163,184,0.35)",
                                  color: "#07111f",
                                }
                          }
                          type="button"
                        >
                          <option.icon size={20} />
                          <p className="mt-3 font-medium">{option.label}</p>
                          <p
                            className={
                              active
                                ? "mt-2 text-sm text-white/65"
                                : "mt-2 text-slate-500 text-sm"
                            }
                          >
                            {option.description}
                          </p>
                          {active && (
                            <span className="absolute top-4 right-4 grid h-5 w-5 place-items-center rounded-full bg-[#4ade80] text-white">
                              <Check size={12} />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <Field label="Cover artwork">
                    <div className="flex flex-wrap gap-3">
                      {[1, 2, 3, 4, 5].map((pattern) => (
                        <button
                          className="relative h-16 w-24 overflow-hidden rounded-lg border-2"
                          key={pattern}
                          onClick={() => setValue("cover_pattern", pattern)}
                          style={{
                            background: coverBackground(pattern),
                            borderColor:
                              form.cover_pattern === pattern
                                ? BRAND.blue
                                : "transparent",
                          }}
                          type="button"
                        >
                          <CoverPattern value={pattern} />
                        </button>
                      ))}
                      <input
                        accept="image/*"
                        className="hidden"
                        onChange={(event) =>
                          handleCoverFile(event.target.files?.[0])
                        }
                        ref={fileInputRef}
                        type="file"
                      />
                      <button
                        className="grid h-16 w-24 place-items-center rounded-lg border border-slate-300 border-dashed bg-white/60 text-slate-400 transition hover:text-[#001731]"
                        onClick={() => fileInputRef.current?.click()}
                        type="button"
                      >
                        {isUploading ? (
                          <span className="text-[10px]">Uploading</span>
                        ) : (
                          <Upload size={18} />
                        )}
                      </button>
                    </div>
                    {form.cover_image_url && (
                      <div className="mt-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-white/70 p-3">
                        <div
                          className="h-14 w-20 rounded-lg bg-center bg-cover"
                          style={{
                            backgroundImage: `url(${form.cover_image_url})`,
                          }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm">
                            Uploaded cover image
                          </p>
                          <p className="truncate text-slate-500 text-xs">
                            {form.cover_image_url}
                          </p>
                        </div>
                        <button
                          className="rounded-lg border border-slate-200 px-3 py-2 font-medium text-slate-500 text-xs transition hover:text-[#001731]"
                          onClick={() => {
                            setValue("cover_image_url", null);
                            setValue("cover_image_file_id", null);
                          }}
                          type="button"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </Field>
                  <div className="grid gap-4 md:grid-cols-2">
                    {[
                      {
                        active: form.push_to_inboxes,
                        description:
                          "Queue this vacancy for member inbox placement.",
                        icon: Bell,
                        label: "Push to inboxes",
                        onClick: () =>
                          setValue("push_to_inboxes", !form.push_to_inboxes),
                      },
                      {
                        active: form.newsletter,
                        description:
                          "Flag this vacancy for the Friday jobs newsletter.",
                        icon: Newspaper,
                        label: "Friday newsletter",
                        onClick: () => setValue("newsletter", !form.newsletter),
                      },
                    ].map(
                      ({ active, description, icon: Icon, label, onClick }) => (
                        <button
                          className="relative rounded-xl border p-4 text-left transition"
                          key={label}
                          onClick={onClick}
                          style={
                            active
                              ? {
                                  background: BRAND.blue,
                                  borderColor: BRAND.blue,
                                  color: "#fff",
                                }
                              : {
                                  background: "rgba(255,255,255,0.72)",
                                  borderColor: "rgba(148,163,184,0.35)",
                                  color: "#07111f",
                                }
                          }
                          type="button"
                        >
                          <div className="flex items-center gap-3">
                            <Icon size={18} />
                            <span className="font-medium text-sm">{label}</span>
                          </div>
                          <p
                            className={
                              active
                                ? "mt-2 text-sm text-white/65"
                                : "mt-2 text-slate-500 text-sm"
                            }
                          >
                            {description}
                          </p>
                          {active && (
                            <span className="absolute top-4 right-4 grid h-5 w-5 place-items-center rounded-full bg-[#4ade80] text-white">
                              <Check size={12} />
                            </span>
                          )}
                        </button>
                      )
                    )}
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white/65 p-5">
                    <div className="flex items-start gap-3">
                      <CalendarDays
                        className="mt-0.5 text-[#3DA9E0]"
                        size={20}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm">
                          Publication timing
                        </p>
                        <p className="mt-1 text-slate-500 text-sm">
                          Publish immediately from the final step, or store a
                          scheduled time for the rollout queue.
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {[
                        { label: "Publish now", value: "now" },
                        { label: "Schedule", value: "scheduled" },
                      ].map((option) => {
                        const active = form.publication_mode === option.value;
                        return (
                          <button
                            className="rounded-lg border px-3 py-2 font-medium text-sm transition"
                            key={option.value}
                            onClick={() =>
                              setValue(
                                "publication_mode",
                                option.value as JobFormValues["publication_mode"]
                              )
                            }
                            style={
                              active
                                ? {
                                    background: BRAND.blue,
                                    borderColor: BRAND.blue,
                                    color: "#fff",
                                  }
                                : {
                                    background: "rgba(255,255,255,0.65)",
                                    borderColor: "rgba(148,163,184,0.35)",
                                    color: "#475569",
                                  }
                            }
                            type="button"
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                    {form.publication_mode === "scheduled" && (
                      <div className="mt-4">
                        <Field label="Scheduled publish time">
                          <input
                            className={inputClass()}
                            onChange={(event) =>
                              setValue(
                                "scheduled_publish_at",
                                event.target.value || null
                              )
                            }
                            type="datetime-local"
                            value={toDateTimeInput(form.scheduled_publish_at)}
                          />
                        </Field>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {step === 5 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="font-light text-4xl tracking-tight">
                      One last look.
                    </h2>
                    <p className="mt-2 max-w-xl text-slate-500 text-sm">
                      Jump back to any section before saving or publishing.
                    </p>
                  </div>
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white/65">
                    {[
                      ["Title (EN)", form.title_en, 0],
                      ["Title (NO)", form.title_no, 0],
                      ["Department", `${departmentName} · ${campusName}`, 0],
                      ["Teaser", form.short_description, 0],
                      [
                        "Description",
                        `${stripHtml(form.description_en).length} EN characters`,
                        1,
                      ],
                      [
                        "Commitment",
                        `${form.commitment ?? "TBC"} · ${form.term ?? "TBC"}`,
                        2,
                      ],
                      [
                        "Start / deadline",
                        `${formatDate(form.start_date)} -> ${formatDate(form.application_deadline)}`,
                        2,
                      ],
                      [
                        "Contact",
                        `${form.contact_name ?? "No name"} (${form.contact_email ?? "no email"})`,
                        2,
                      ],
                      [
                        "Screening",
                        form.auto_screen
                          ? "AI screening enabled"
                          : "Manual review",
                        3,
                      ],
                      [
                        "Audience",
                        form.audience === "public" ? "Public" : "Members only",
                        4,
                      ],
                    ].map(([label, value, targetStep]) => (
                      <button
                        className="grid w-full grid-cols-[150px_minmax(0,1fr)_auto] items-center gap-4 border-slate-200 border-t px-4 py-4 text-left first:border-t-0"
                        key={String(label)}
                        onClick={() => setStep(Number(targetStep))}
                        type="button"
                      >
                        <span className="font-medium text-[11px] text-slate-500 uppercase tracking-[0.12em]">
                          {label}
                        </span>
                        <span className="truncate text-sm">
                          {value || "Not set"}
                        </span>
                        <Pencil className="text-slate-400" size={14} />
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-3 rounded-xl border border-[#3DA9E0]/25 bg-[#3DA9E0]/10 p-4">
                    <Sparkles
                      className="mt-0.5 shrink-0 text-[#0369a1]"
                      size={20}
                    />
                    <div>
                      <p className="font-medium text-sm">
                        Publishing checks are based on existing validation.
                      </p>
                      <p className="mt-1 text-slate-600 text-sm">
                        Required title, description, campus, slug, and status
                        are validated by the shared recruitment schema.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          <aside className="hidden min-h-0 border-slate-200 border-l bg-[#e8f2f7] lg:flex lg:flex-col">
            <div className="flex items-center gap-2 border-slate-200 border-b bg-white/35 px-4 py-3">
              <span className="flex items-center gap-1.5 font-medium text-[#15803d] text-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-[#4ade80]" />
                Live preview
              </span>
              <button
                className="ml-auto inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white/60 px-3 py-1.5 font-medium text-slate-500 text-xs transition hover:text-[#001731]"
                onClick={() => setPhoneFloat((current) => !current)}
                type="button"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: phoneFloat ? BRAND.green : "#94a3b8" }}
                />
                Floating device
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-6">
              <PhonePreview
                campusName={campusName}
                departmentName={departmentName}
                form={form}
                locale={locale}
                phoneFloat={phoneFloat}
              />
            </div>
            <div className="flex items-center justify-between border-slate-200 border-t bg-white/40 px-4 py-3 text-slate-500 text-xs">
              <span className="inline-flex items-center gap-1.5">
                <Users size={13} />
                Student-facing preview
              </span>
              <span>{dirty ? "Unsaved changes" : "Saved state"}</span>
            </div>
          </aside>
        </main>

        <footer className="sticky bottom-0 z-20 flex items-center gap-3 border-slate-200 border-t bg-[#faf7f2]/92 px-4 py-3 backdrop-blur-xl md:px-8">
          <ProgressBar step={step} />
          <div className="ml-auto flex items-center gap-2">
            <button
              className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 font-medium text-[#001731] text-sm sm:inline-flex"
              disabled={isSaving}
              onClick={() => submit(JobsStatus.DRAFT)}
              type="button"
            >
              <Save size={15} />
              {isSaving ? "Saving..." : labels.saveDraft}
            </button>
            {step > 0 && (
              <button
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-medium text-slate-600 text-sm"
                onClick={() => setStep(step - 1)}
                type="button"
              >
                Back
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <button
                className="inline-flex items-center gap-2 rounded-lg bg-[#001731] px-4 py-2 font-medium text-sm text-white"
                onClick={() => setStep(step + 1)}
                type="button"
              >
                Continue
                <ArrowRight size={15} />
              </button>
            ) : (
              <button
                className="inline-flex items-center gap-2 rounded-lg bg-[#001731] px-4 py-2 font-medium text-sm text-white"
                disabled={isPublishing}
                onClick={() => submit(JobsStatus.PUBLISHED)}
                type="button"
              >
                <Send size={15} />
                {isPublishing ? "Publishing..." : labels.publish}
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}

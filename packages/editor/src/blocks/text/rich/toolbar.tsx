"use client";

import {
  type PlateEditor,
  useEditorSelector,
  usePluginOption,
} from "platejs/react";
import {
  type ChangeEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  activeList,
  applyLink,
  currentStyle,
  isMarkActive,
  linkUrl,
  normalizeHref,
  type RichMark,
  type RichStyle,
  STYLE_LABELS,
  setStyle,
  toggleRichList,
  toggleRichMark,
} from "./commands";
import { RichKeysPlugin } from "./react-plugins";

/** Buttons take no focus, so the editor keeps its selection. */
const keepSelection = (event: MouseEvent) => event.preventDefault();

const STYLES = Object.keys(STYLE_LABELS) as RichStyle[];

const isStyle = (value: string): value is RichStyle =>
  Object.hasOwn(STYLE_LABELS, value);

type ToolbarMark = Exclude<RichMark, "strikethrough">;

const MARKS: { glyph: ReactNode; label: string; mark: ToolbarMark }[] = [
  { glyph: <b>B</b>, label: "Bold", mark: "bold" },
  { glyph: <i>I</i>, label: "Italic", mark: "italic" },
  { glyph: <u>U</u>, label: "Underline", mark: "underline" },
];

interface ToolbarState {
  bold: boolean;
  italic: boolean;
  link: string | null;
  list: "disc" | "decimal" | null;
  style: RichStyle;
  underline: boolean;
}

const readState = (editor: PlateEditor): ToolbarState => ({
  bold: isMarkActive(editor, "bold"),
  italic: isMarkActive(editor, "italic"),
  link: linkUrl(editor),
  list: activeList(editor),
  style: currentStyle(editor),
  underline: isMarkActive(editor, "underline"),
});

const sameState = (a: ToolbarState, b: ToolbarState): boolean =>
  a.bold === b.bold &&
  a.italic === b.italic &&
  a.link === b.link &&
  a.list === b.list &&
  a.style === b.style &&
  a.underline === b.underline;

interface ToolbarProps {
  editor: PlateEditor;
  tone: "paper" | "ink";
}

/**
 * The formatting row: text style, bold, italic, underline, link, then the
 * two lists. `paper` sits above the panel field; `ink` is the canvas
 * bubble's. Each control shows the state at the selection.
 */
export function RichToolbar({ editor, tone }: ToolbarProps) {
  const state = useEditorSelector(readState, [], { equalityFn: sameState });
  const linkOpen = usePluginOption(RichKeysPlugin, "linkOpen");

  const pickStyle = (event: ChangeEvent<HTMLSelectElement>) => {
    const { value } = event.target;
    if (isStyle(value)) {
      setStyle(editor, value);
    }
    editor.tf.focus();
  };

  // Opening hands focus to the address input; closing hands it back.
  const toggleLink = () => {
    editor.setOption(RichKeysPlugin, "linkOpen", !linkOpen);
    if (linkOpen) {
      editor.tf.focus();
    }
  };

  return (
    <div
      aria-label="Formatting"
      className={tone === "ink" ? "pe-rt-bar pe-rt-bar--ink" : "pe-rt-bar"}
      role="toolbar"
    >
      <select
        aria-label="Text style"
        className="pe-rt-select"
        onChange={pickStyle}
        value={state.style}
      >
        {STYLES.map((style) => (
          <option key={style} value={style}>
            {STYLE_LABELS[style]}
          </option>
        ))}
      </select>
      <span aria-hidden="true" className="pe-rt-sep" />
      {MARKS.map(({ glyph, label, mark }) => (
        <button
          aria-label={label}
          aria-pressed={state[mark]}
          className="pe-rt-btn"
          key={mark}
          onClick={() => toggleRichMark(editor, mark)}
          onMouseDown={keepSelection}
          type="button"
        >
          {glyph}
        </button>
      ))}
      <button
        aria-expanded={linkOpen}
        aria-label="Link"
        className="pe-rt-btn"
        onClick={toggleLink}
        onMouseDown={keepSelection}
        type="button"
      >
        <LinkIcon />
      </button>
      <span aria-hidden="true" className="pe-rt-sep" />
      <button
        aria-label="Bullet list"
        aria-pressed={state.list === "disc"}
        className="pe-rt-btn"
        onClick={() => toggleRichList(editor, "disc")}
        onMouseDown={keepSelection}
        type="button"
      >
        <BulletListIcon />
      </button>
      <button
        aria-label="Numbered list"
        aria-pressed={state.list === "decimal"}
        className="pe-rt-btn"
        onClick={() => toggleRichList(editor, "decimal")}
        onMouseDown={keepSelection}
        type="button"
      >
        <NumberedListIcon />
      </button>
      {linkOpen ? <LinkEditor editor={editor} url={state.link} /> : null}
    </div>
  );
}

/**
 * The address input, on its own line inside the toolbar. It opens on the
 * address of the link in the selection. Enter or Apply links the selection,
 * Remove unlinks it, Escape closes; each hands focus back to the editor,
 * whose selection Slate kept while the input had focus.
 */
function LinkEditor({
  editor,
  url,
}: {
  editor: PlateEditor;
  url: string | null;
}) {
  const [invalid, setInvalid] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
  }, []);

  const close = () => {
    editor.setOption(RichKeysPlugin, "linkOpen", false);
    editor.tf.focus();
  };

  const apply = () => {
    const address = input.current?.value ?? "";
    if (normalizeHref(address) === null) {
      setInvalid(true);
      return;
    }
    applyLink(editor, address);
    close();
  };

  const remove = () => {
    applyLink(editor, null);
    close();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      apply();
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  };

  return (
    <div className="pe-rt-link">
      <input
        aria-invalid={invalid}
        aria-label="Link address"
        className="pe-rt-link__input"
        defaultValue={url ?? ""}
        onInput={() => setInvalid(false)}
        onKeyDown={onKeyDown}
        placeholder="biso.no/events"
        ref={input}
        spellCheck={false}
        type="text"
      />
      <button
        className="pe-rt-btn pe-rt-link__btn"
        onClick={apply}
        onMouseDown={keepSelection}
        type="button"
      >
        Apply
      </button>
      <button
        className="pe-rt-btn pe-rt-link__btn"
        disabled={url === null}
        onClick={remove}
        onMouseDown={keepSelection}
        type="button"
      >
        Remove
      </button>
    </div>
  );
}

function LinkIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="13"
      viewBox="0 0 24 24"
      width="13"
    >
      <path
        d="M9 17H7A5 5 0 0 1 7 7h2M15 7h2a5 5 0 1 1 0 10h-2M8 12h8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function BulletListIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="13"
      viewBox="0 0 24 24"
      width="13"
    >
      <circle cx="4.5" cy="6" fill="currentColor" r="1.5" />
      <circle cx="4.5" cy="12" fill="currentColor" r="1.5" />
      <circle cx="4.5" cy="18" fill="currentColor" r="1.5" />
      <path
        d="M9 6h12M9 12h12M9 18h12"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function NumberedListIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="13"
      viewBox="0 0 24 24"
      width="13"
    >
      <path
        d="M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

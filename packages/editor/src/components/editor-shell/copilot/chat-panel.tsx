"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PageEditorToolName } from "@/ai/tools";
import { type ToolResult, validateSetTheme } from "@/ai/tools/theme";
import { getBlock } from "@/blocks/registry";
import {
  canonicalBodyHtml,
  preloadRichHtml,
} from "@/blocks/text/canonical-body";
import { useEditorCallbacks } from "@/editor/callbacks";
import { useSelection } from "@/editor/hooks";
import { isInsideTextBody } from "@/editor/operations";
import { COLUMN_COUNT } from "@/editor/sections";
import { LAYOUT_VALUES, pageStateForAI } from "@/editor/serialize";
import { useEditorStore } from "@/editor/store";
import { findBlock, findSection, targetAfterBlock } from "@/editor/tree";
import type {
  BlockType,
  EditorDepartment,
  InsertTarget,
  PageDoc,
  SectionBackground,
  SectionColumns,
} from "@/editor/types";

type ToolArgs = Record<string, unknown>;

/** The section the most recent insert_section made, for `sectionId: "new"`. */
const NEW_SECTION = "new";
let lastInsertedSectionId: string | null = null;

/**
 * The text blocks whose body this turn's page state showed the copilot cut
 * or not at all (`pageStateForAI`).
 */
let partBodies: ReadonlySet<string> = new Set();

/** The page state a new turn sends, kept for the turn's tool calls. */
export function pageStateForTurn(
  doc: PageDoc,
  selection: string | null,
  departments: EditorDepartment[] = []
): string {
  const state = pageStateForAI(doc, selection, departments);
  partBodies = state.partBodies;
  return state.text;
}

function toolError(message: string): ToolResult {
  return { message, status: "error" };
}

/** The column an insert_block aimed at a section lands in, or why it cannot. */
function resolveColumnTarget(
  doc: PageDoc,
  sectionRef: string,
  columnIndex: unknown
): { target: InsertTarget } | { error: ToolResult } {
  const sectionId =
    sectionRef === NEW_SECTION ? (lastInsertedSectionId ?? "") : sectionRef;
  const found = findSection(doc, sectionId);
  if (!found) {
    return { error: toolError(`There is no section ${sectionRef}.`) };
  }
  const index = columnIndex ?? 0;
  const count = found.section.columns.length;
  if (
    typeof index !== "number" ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= count
  ) {
    return {
      error: toolError(
        `Section ${sectionRef} has ${count} column${count === 1 ? "" : "s"} (columnIndex 0 to ${count - 1}); columnIndex ${String(index)} does not exist.`
      ),
    };
  }
  return { target: { columnId: found.section.columns[index].id } };
}

function applyInsertBlock(args: ToolArgs): ToolResult {
  const store = useEditorStore.getState();
  if (typeof args.type !== "string" || !getBlock(args.type as BlockType)) {
    return toolError(`${String(args.type)} is not a block type.`);
  }
  const type = args.type as BlockType;
  const { afterBlockId, columnIndex, sectionId } = args;
  if (columnIndex !== undefined && typeof sectionId !== "string") {
    return toolError("columnIndex needs a sectionId.");
  }
  // Without any target (or an afterBlockId that is gone) the tool promises
  // the end of the page, so this must not fall back to the user's pending
  // insert target or selection the way the palette does.
  let target: InsertTarget | null =
    typeof afterBlockId === "string"
      ? targetAfterBlock(store.doc, afterBlockId)
      : null;
  if (!target && typeof sectionId === "string") {
    const resolved = resolveColumnTarget(store.doc, sectionId, columnIndex);
    if ("error" in resolved) {
      return resolved.error;
    }
    target = resolved.target;
  }
  if (target) {
    store.insertBlock(type, target);
  } else {
    store.insertBlockInNewSection(type, store.doc.sections.length);
  }
  return { message: `Inserted ${type} block.`, status: "applied" };
}

function applyInsertSection(args: ToolArgs): ToolResult {
  const store = useEditorStore.getState();
  const columns = args.columns as SectionColumns;
  if (!(columns in COLUMN_COUNT)) {
    return toolError(`${String(args.columns)} is not a column preset.`);
  }
  let background: SectionBackground | undefined;
  if (args.background !== undefined) {
    if (
      !LAYOUT_VALUES.background.includes(args.background as SectionBackground)
    ) {
      return toolError(
        `${String(args.background)} is not a section background.`
      );
    }
    background = args.background as SectionBackground;
  }
  let index = store.doc.sections.length;
  if (typeof args.afterSectionId === "string") {
    const found = findSection(store.doc, args.afterSectionId);
    if (!found) {
      return toolError(`There is no section ${args.afterSectionId}.`);
    }
    index = found.index + 1;
  }
  const sectionId = store.insertSection(columns, index, background);
  lastInsertedSectionId = sectionId;
  return {
    message: `Inserted section ${sectionId}.`,
    sectionId,
    status: "applied",
  };
}

/** Canonical body writes still on their way. */
const canonicalWrites = new Set<Promise<void>>();

/** Resolves once every canonical body write under way has settled. */
export async function whenBodiesCanonical(): Promise<void> {
  await Promise.allSettled([...canonicalWrites]);
}

/**
 * Replaces the raw body the copilot wrote with the field's canonical form,
 * unless something else changed the body first. Under the raw write's
 * coalesce key, so both are one undo step. If the form cannot be made, the
 * raw body stays: the server sanitises it on save anyway.
 */
async function writeCanonicalBody(
  id: string,
  raw: string,
  coalesce: string
): Promise<void> {
  let canonical: string;
  try {
    canonical = await canonicalBodyHtml(raw);
  } catch {
    return;
  }
  const store = useEditorStore.getState();
  const block = findBlock(store.doc, id)?.block;
  if (block?.type === "text" && block.body === raw && canonical !== raw) {
    store.setProp(id, "body", canonical, { coalesce });
  }
}

function applySetProp(args: ToolArgs): ToolResult {
  const store = useEditorStore.getState();
  const id = args.id as string;
  const path = args.path as string;
  const { value } = args;
  const found = findBlock(store.doc, id);
  if (found && isInsideTextBody(found.block, path)) {
    return toolError(
      `Set the whole body as one HTML string: block ${id}'s body is HTML, so set_prop it with path "body", not ${path}.`
    );
  }
  // A rewrite of a body the copilot saw only in part would lose the rest.
  if (found?.block.type === "text" && path === "body" && partBodies.has(id)) {
    return toolError(
      `Block ${id}'s body is longer than the page state showed you, so set_prop body would lose the rest of it. Ask the volunteer to select the block, then rewrite it.`
    );
  }
  if (
    found?.block.type !== "text" ||
    path !== "body" ||
    typeof value !== "string"
  ) {
    store.setProp(id, path, value);
    return { message: "Applied.", status: "applied" };
  }
  // The raw body at once, so the next tool call sees it; then the form the
  // field writes, so the saved page shows what the canvas does.
  const coalesce = `copilot:${id}:body`;
  store.setProp(id, path, value, { coalesce });
  const write = writeCanonicalBody(id, value, coalesce).finally(() => {
    canonicalWrites.delete(write);
  });
  canonicalWrites.add(write);
  return { message: "Applied.", status: "applied" };
}

function applySetTheme(args: ToolArgs): ToolResult {
  const checked = validateSetTheme(args);
  if ("error" in checked) {
    return checked.error;
  }
  useEditorStore.getState().setTheme(checked.theme);
  return {
    message: checked.theme ? "Theme set." : "Theme reset to BISO.",
    status: "applied",
  };
}

/** Applies one Copilot tool call to the editor store. */
export function applyToolCall(toolName: string, args: ToolArgs): ToolResult {
  const store = useEditorStore.getState();
  switch (toolName as PageEditorToolName) {
    case "insert_block":
      return applyInsertBlock(args);
    case "insert_section":
      return applyInsertSection(args);
    case "set_theme":
      return applySetTheme(args);
    case "remove_block":
      store.removeBlock(args.id as string);
      break;
    case "set_prop":
      return applySetProp(args);
    case "bind_collection":
      store.bindCollection(args.id as string, args.source as string);
      break;
    case "list_blocks":
    case "generate_copy":
      // Server-only: the model's own tool result is all there is to apply.
      break;
    default:
      return toolError(`Unknown tool ${toolName}.`);
  }
  return { message: "Applied.", status: "applied" };
}

export function CopilotPanel() {
  const setCopilotOpen = useEditorStore((s) => s.setCopilotOpen);
  const doc = useEditorStore((s) => s.doc);
  const selection = useSelection();
  const { departments } = useEditorCallbacks();

  const getPageContext = useCallback(
    () => pageStateForTurn(doc, selection, departments),
    [doc, selection, departments]
  );

  const [input, setInput] = useState("");
  const [streamError, setStreamError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/page-editor/ai/chat" }),
    onToolCall: ({ toolCall }) => {
      applyToolCall(
        toolCall.toolName as string,
        (toolCall.input as ToolArgs) ?? {}
      );
    },
    onError: (err) =>
      setStreamError((err as Error).message ?? "Something went wrong."),
  });

  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // A body the copilot writes is canonicalised in the rich chunk; load it
  // now, so the canonical write lands inside the raw one's coalesce window.
  useEffect(() => {
    preloadRichHtml();
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isLoading) {
      return;
    }
    const text = input.trim();
    setInput("");
    setStreamError(null);
    lastInsertedSectionId = null;
    sendMessage({ text }, { body: { pageContext: getPageContext() } });
  }

  return (
    <div aria-label="AI copilot" className="pe-copilot-panel" role="dialog">
      {/* Header */}
      <div className="pe-copilot-panel__hd">
        <div aria-hidden="true" className="pe-copilot-panel__gem">
          ✦
        </div>
        <span>AI Copilot</span>
        <button
          aria-label="Close copilot"
          className="pe-copilot-panel__close"
          onClick={() => setCopilotOpen(false)}
          type="button"
        >
          ✕
        </button>
      </div>

      {/* Messages */}
      <div className="scroll pe-copilot-panel__messages">
        {streamError && (
          <div
            style={{
              background: "#fee2e2",
              color: "#991b1b",
              borderRadius: 8,
              padding: "8px 12px",
              fontSize: 12,
              display: "flex",
              gap: 8,
              alignItems: "center",
              margin: "0 0 8px",
            }}
          >
            <span style={{ flex: 1 }}>{streamError}</span>
            <button
              onClick={() => setStreamError(null)}
              style={{
                background: "none",
                border: 0,
                cursor: "pointer",
                color: "inherit",
                fontSize: 14,
                lineHeight: 1,
              }}
              type="button"
            >
              ✕
            </button>
          </div>
        )}
        {messages.length === 0 && (
          <div className="pe-copilot-panel__empty">
            <div aria-hidden="true" className="pe-copilot-panel__empty-gem">
              ✦
            </div>
            <p>
              I can add, edit, or rearrange any block on this page. Ask me
              anything.
            </p>
            <div className="pe-copilot-panel__suggestions">
              {[
                "Add an events feed to this page",
                "Write an intro paragraph for my page",
                "Change the accent colour to BISO blue",
                "Bind the events block to Appwrite",
              ].map((s) => (
                <button
                  className="pe-copilot-panel__suggestion"
                  key={s}
                  onClick={() => {
                    lastInsertedSectionId = null;
                    sendMessage(
                      { text: s },
                      { body: { pageContext: getPageContext() } }
                    );
                  }}
                  type="button"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div
            className={`pe-copilot-panel__msg pe-copilot-panel__msg--${message.role}`}
            key={message.id}
          >
            {message.role === "assistant" && (
              <div aria-hidden="true" className="pe-copilot-panel__avatar">
                ✦
              </div>
            )}
            <div className="pe-copilot-panel__bubble">
              {message.parts?.map((part, i) => {
                if (part.type === "text") {
                  return (
                    <p key={i}>
                      {(part as { type: "text"; text: string }).text}
                    </p>
                  );
                }
                if (
                  typeof part.type === "string" &&
                  part.type.startsWith("tool-")
                ) {
                  const tp = part as {
                    type: string;
                    state: string;
                    toolCallId: string;
                  };
                  const toolName = part.type.slice(5); // strip "tool-" prefix
                  return (
                    <div className="pe-copilot-panel__tool-call" key={i}>
                      <span className="pe-copilot-panel__tool-name">
                        {tp.state === "output-available" ? "✓" : "⟳"}{" "}
                        {toolName.replace(/_/g, " ")}
                      </span>
                    </div>
                  );
                }
                return null;
              })}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="pe-copilot-panel__msg pe-copilot-panel__msg--assistant">
            <div aria-hidden="true" className="pe-copilot-panel__avatar">
              ✦
            </div>
            <div className="pe-copilot-panel__bubble pe-copilot-panel__bubble--thinking">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form className="pe-copilot-panel__form" onSubmit={handleSubmit}>
        <input
          autoFocus
          className="pe-copilot-panel__input"
          disabled={isLoading}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask the copilot…"
          value={input}
        />
        <button
          aria-label="Send"
          className="pe-copilot-panel__send"
          disabled={!input.trim() || isLoading}
          type="submit"
        >
          ↑
        </button>
      </form>
    </div>
  );
}

"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEditorStore } from "@/editor/store";
import { useSelection } from "@/editor/hooks";
import { serializePageForAI } from "@/editor/serialize";
import type { PageEditorToolName } from "@/ai/tools";

type ToolArgs = Record<string, unknown>;

function applyToolCall(toolName: string, args: ToolArgs) {
  const store = useEditorStore.getState();
  switch (toolName as PageEditorToolName) {
    case "insert_block":
      store.insertBlock(args.type as never, args.afterId as string | undefined);
      break;
    case "remove_block":
      store.removeBlock(args.id as string);
      break;
    case "set_prop":
      store.setProp(args.id as string, args.path as string, args.value);
      break;
    case "set_variant":
      store.setVariant(args.id as string, args.variant as string);
      break;
    case "apply_accent":
      store.applyAccent(args.hex as string);
      break;
    case "bind_collection":
      store.bindCollection(args.id as string, args.source as string);
      break;
  }
}

export function CopilotPanel() {
  const setCopilotOpen = useEditorStore((s) => s.setCopilotOpen);
  const doc = useEditorStore((s) => s.doc);
  const selection = useSelection();

  const getPageContext = useCallback(
    () => serializePageForAI(doc, selection),
    [doc, selection]
  );

  const [input, setInput] = useState("");
  const [streamError, setStreamError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/page-editor/ai/chat" }),
    onToolCall: ({ toolCall }) => {
      applyToolCall(toolCall.toolName as string, (toolCall.input as ToolArgs) ?? {});
    },
    onError: (err) => setStreamError((err as Error).message ?? "Something went wrong."),
  });

  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    const text = input.trim();
    setInput("");
    setStreamError(null);
    sendMessage({ text }, { body: { pageContext: getPageContext() } });
  }

  return (
    <div className="pe-copilot-panel" role="dialog" aria-label="AI copilot">
      {/* Header */}
      <div className="pe-copilot-panel__hd">
        <div className="pe-copilot-panel__gem" aria-hidden="true">✦</div>
        <span>AI Copilot</span>
        <button
          type="button"
          className="pe-copilot-panel__close"
          onClick={() => setCopilotOpen(false)}
          aria-label="Close copilot"
        >
          ✕
        </button>
      </div>

      {/* Messages */}
      <div className="pe-copilot-panel__messages scroll">
        {streamError && (
          <div style={{ background: "#fee2e2", color: "#991b1b", borderRadius: 8, padding: "8px 12px", fontSize: 12, display: "flex", gap: 8, alignItems: "center", margin: "0 0 8px" }}>
            <span style={{ flex: 1 }}>{streamError}</span>
            <button type="button" onClick={() => setStreamError(null)} style={{ background: "none", border: 0, cursor: "pointer", color: "inherit", fontSize: 14, lineHeight: 1 }}>✕</button>
          </div>
        )}
        {messages.length === 0 && (
          <div className="pe-copilot-panel__empty">
            <div className="pe-copilot-panel__empty-gem" aria-hidden="true">✦</div>
            <p>I can add, edit, or rearrange any block on this page. Ask me anything.</p>
            <div className="pe-copilot-panel__suggestions">
              {[
                "Add a hero section at the top",
                "Write a subtitle for my hero",
                "Change the accent colour to leaf green",
                "Bind the events block to Appwrite",
              ].map((s) => (
                <button
                  key={s}
                  type="button"
                  className="pe-copilot-panel__suggestion"
                  onClick={() => {
                    sendMessage({ text: s }, { body: { pageContext: getPageContext() } });
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`pe-copilot-panel__msg pe-copilot-panel__msg--${message.role}`}
          >
            {message.role === "assistant" && (
              <div className="pe-copilot-panel__avatar" aria-hidden="true">✦</div>
            )}
            <div className="pe-copilot-panel__bubble">
              {message.parts?.map((part, i) => {
                if (part.type === "text") {
                  return <p key={i}>{(part as { type: "text"; text: string }).text}</p>;
                }
                if (typeof part.type === "string" && part.type.startsWith("tool-")) {
                  const tp = part as { type: string; state: string; toolCallId: string };
                  const toolName = part.type.slice(5); // strip "tool-" prefix
                  return (
                    <div key={i} className="pe-copilot-panel__tool-call">
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
            <div className="pe-copilot-panel__avatar" aria-hidden="true">✦</div>
            <div className="pe-copilot-panel__bubble pe-copilot-panel__bubble--thinking">
              <span/>
              <span/>
              <span/>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form className="pe-copilot-panel__form" onSubmit={handleSubmit}>
        <input
          className="pe-copilot-panel__input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask the copilot…"
          disabled={isLoading}
          autoFocus
        />
        <button
          type="submit"
          className="pe-copilot-panel__send"
          disabled={!input.trim() || isLoading}
          aria-label="Send"
        >
          ↑
        </button>
      </form>
    </div>
  );
}

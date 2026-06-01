"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Loader2, Send, Sparkles, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createApprovalRequest } from "@/app/(portal)/_actions/approvals";
import type { UserRolesForClient } from "@/lib/authorization";
import { resolveApproverTeamId } from "@/lib/campus-constants";
import { MONO_STACK, SERIF_STACK, STUDIO } from "../studio";
import { fillFormFieldsWithDelay, getActiveFormSchemaId } from "./form-bridge";
import { ApprovalRequestCard } from "./parts/approval-request-card";
import { ConfirmActionCard } from "./parts/confirm-action-card";
import { DraftPreviewCard } from "./parts/draft-preview-card";
import { EntityResultCard } from "./parts/entity-result-card";
import { NavigationChip } from "./parts/navigation-chip";
import { QueryResultCard } from "./parts/query-result-card";

// Event name for programmatic open (mirrors admin:open-palette pattern)
export const OPEN_ASSISTANT_EVENT = "admin:open-assistant";

interface AssistantShellUser {
  email: string | null;
  name: string | null;
}

interface AssistantWidgetProps {
  roles: UserRolesForClient;
  user: AssistantShellUser;
}

// ---------------------------------------------------------------------------
// Suggestion chips shown on empty state
// ---------------------------------------------------------------------------

const SUGGESTIONS_BY_ROLE = {
  campusadmin: [
    "Show pending approvals",
    "Create a job posting",
    "Show this week's events",
  ],
  default: ["Show my draft content", "What can you help me with?"],
  department: [
    "Draft a job posting",
    "Create a news article",
    "Show my recent drafts",
  ],
  globaladmin: [
    "Show dashboard overview",
    "Create a job posting for Operations",
    "Show all pending approvals",
    "Create M365 user",
  ],
};

function getSuggestions(roles: UserRolesForClient): string[] {
  if (roles.isGlobalAdmin) {
    return SUGGESTIONS_BY_ROLE.globaladmin;
  }
  if (roles.isCampusAdmin) {
    return SUGGESTIONS_BY_ROLE.campusadmin;
  }
  if (roles.hasDepartmentMembership) {
    return SUGGESTIONS_BY_ROLE.department;
  }
  return SUGGESTIONS_BY_ROLE.default;
}

// ---------------------------------------------------------------------------
// Tool part types
// ---------------------------------------------------------------------------

interface ToolPartRecord {
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  state?: string;
  toolCallId?: string;
  type: string;
}

type AddToolResult = (params: {
  output: unknown;
  tool: string;
  toolCallId: string;
}) => void;

type SetApprovalResults = React.Dispatch<
  React.SetStateAction<Record<string, { error?: string; submitted: boolean }>>
>;

function getToolName(partType: string): string {
  return partType.startsWith("tool-") ? partType.slice(5) : partType;
}

// ---------------------------------------------------------------------------
// Module-level tool part renderers (extracted to reduce component complexity)
// ---------------------------------------------------------------------------

function renderNavigatePart(inputData: Record<string, unknown>, key: number) {
  return (
    <NavigationChip
      key={key}
      path={inputData.path as string}
      reason={inputData.reason as string | undefined}
    />
  );
}

function renderConfirmPart(
  inputData: Record<string, unknown>,
  outputData: Record<string, unknown>,
  resolved: boolean,
  toolCallId: string,
  key: number,
  addResult: AddToolResult
) {
  const result = resolved ? (outputData as { confirmed: boolean }) : undefined;
  return (
    <ConfirmActionCard
      actionLabel={inputData.actionLabel as string}
      danger={inputData.danger as boolean | undefined}
      description={inputData.description as string}
      key={key}
      onCancel={() =>
        addResult({
          tool: "confirmAction",
          toolCallId,
          output: { confirmed: false },
        })
      }
      onConfirm={() =>
        addResult({
          tool: "confirmAction",
          toolCallId,
          output: { confirmed: true },
        })
      }
      result={result}
    />
  );
}

function renderDraftPreviewPart(
  inputData: Record<string, unknown>,
  outputData: Record<string, unknown>,
  resolved: boolean,
  toolCallId: string,
  key: number,
  addResult: AddToolResult
) {
  const result = resolved ? (outputData as { approved: boolean }) : undefined;
  return (
    <DraftPreviewCard
      descriptionEN={inputData.descriptionEN as string}
      descriptionNO={inputData.descriptionNO as string}
      domain={inputData.domain as string}
      key={key}
      meta={inputData.meta as Record<string, string> | undefined}
      onApprove={(editedDraft) =>
        addResult({
          tool: "showDraftPreview",
          toolCallId,
          output: { approved: true, editedDraft },
        })
      }
      onCancel={() =>
        addResult({
          tool: "showDraftPreview",
          toolCallId,
          output: { approved: false },
        })
      }
      result={result}
      titleEN={inputData.titleEN as string}
      titleNO={inputData.titleNO as string}
    />
  );
}

function renderApprovalPart(
  inputData: Record<string, unknown>,
  outputData: Record<string, unknown>,
  resolved: boolean,
  toolCallId: string,
  key: number,
  addResult: AddToolResult,
  approvalResults: Record<string, { error?: string; submitted: boolean }>,
  setApprovalResults: SetApprovalResults
) {
  const cardResult = approvalResults[toolCallId];
  const result = resolved ? (outputData as { submitted: boolean }) : cardResult;

  return (
    <ApprovalRequestCard
      action={inputData.action as string}
      approverTeam={inputData.approverTeam as string}
      key={key}
      onCancel={() => {
        setApprovalResults((prev) => ({
          ...prev,
          [toolCallId]: { submitted: false },
        }));
        addResult({
          tool: "requestApproval",
          toolCallId,
          output: { submitted: false },
        });
      }}
      onSubmit={async () => {
        const approvalResult = await createApprovalRequest({
          action: inputData.action as string,
          approverTeamId: resolveApproverTeamId(
            inputData.action as string,
            (inputData.campusId as string) ?? undefined
          ),
          payload: inputData.payload as Record<string, unknown>,
          resourceId: inputData.resourceId as string | undefined,
          resourceType: inputData.resourceType as string,
        });
        if ("error" in approvalResult) {
          throw new Error(approvalResult.error);
        }
        setApprovalResults((prev) => ({
          ...prev,
          [toolCallId]: { submitted: true },
        }));
        addResult({
          tool: "requestApproval",
          toolCallId,
          output: { submitted: true, requestId: approvalResult.data },
        });
      }}
      payload={inputData.payload as Record<string, unknown>}
      resourceType={inputData.resourceType as string}
      result={result}
    />
  );
}

function renderServerToolResult(
  toolName: string,
  inputData: Record<string, unknown>,
  outputData: Record<string, unknown>,
  key: number
) {
  if (toolName === "searchContent") {
    return (
      <QueryResultCard
        data={outputData.data}
        domain={inputData.domain as string}
        key={key}
      />
    );
  }

  const opMap: Record<string, "created" | "deleted" | "published" | "updated"> =
    {
      createContent: "created",
      deleteContent: "deleted",
      publishContent: "published",
      updateContent: "updated",
    };
  const op = opMap[toolName];
  if (op && (outputData.success as boolean) && outputData.data !== undefined) {
    return (
      <EntityResultCard
        data={outputData.data}
        domain={inputData.domain as string}
        key={key}
        operation={op}
      />
    );
  }

  return null;
}

function renderPendingIndicator(toolName: string, key: number) {
  return (
    <div
      className="flex items-center gap-1.5 text-[11px]"
      key={key}
      style={{ color: STUDIO.ink4, fontFamily: MONO_STACK }}
    >
      <Loader2 className="animate-spin" size={11} />
      {toolName.replace(/_/g, " ")}…
    </div>
  );
}

function renderToolPart(
  tp: ToolPartRecord,
  key: number,
  addResult: AddToolResult,
  approvalResults: Record<string, { error?: string; submitted: boolean }>,
  setApprovalResults: SetApprovalResults
) {
  const toolName = getToolName(tp.type);
  const toolCallId = tp.toolCallId ?? "";
  const inputData = tp.input ?? {};
  const outputData = tp.output ?? {};
  const resolved = tp.state === "output-available";

  if (toolName === "navigate") {
    return renderNavigatePart(inputData, key);
  }
  if (toolName === "confirmAction") {
    return renderConfirmPart(
      inputData,
      outputData,
      resolved,
      toolCallId,
      key,
      addResult
    );
  }
  if (toolName === "showDraftPreview") {
    return renderDraftPreviewPart(
      inputData,
      outputData,
      resolved,
      toolCallId,
      key,
      addResult
    );
  }
  if (toolName === "requestApproval") {
    return renderApprovalPart(
      inputData,
      outputData,
      resolved,
      toolCallId,
      key,
      addResult,
      approvalResults,
      setApprovalResults
    );
  }
  if (resolved) {
    return renderServerToolResult(toolName, inputData, outputData, key);
  }
  return renderPendingIndicator(toolName, key);
}

// ---------------------------------------------------------------------------
// Main Widget
// ---------------------------------------------------------------------------

export function AssistantWidget({ roles, user: _user }: AssistantWidgetProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const pathname = usePathname();
  const router = useRouter();
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastMessageIdRef = useRef<string | null>(null);

  const [approvalResults, setApprovalResults] = useState<
    Record<string, { error?: string; submitted: boolean }>
  >({});

  // Open via DOM event (from sidebar, command palette, shortcut)
  useEffect(() => {
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener(OPEN_ASSISTANT_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_ASSISTANT_EVENT, onOpen);
  }, []);

  const { messages, sendMessage, status, addToolResult } = useChat({
    transport: new DefaultChatTransport({ api: "/api/assistant" }),
    onToolCall: ({ toolCall }) => {
      const toolName = toolCall.toolName as string;
      const toolInput = (toolCall.input ?? {}) as Record<string, unknown>;

      if (toolName === "navigate") {
        const path = toolInput.path as string;
        if (path) {
          router.push(path);
        }
        addToolResult({
          tool: "navigate",
          toolCallId: toolCall.toolCallId,
          output: { navigated: true, path },
        });
        return;
      }

      if (toolName === "fillForm") {
        const schemaId = toolInput.schemaId as string;
        const activeId = getActiveFormSchemaId();
        if (!activeId || activeId !== schemaId) {
          addToolResult({
            tool: "fillForm",
            toolCallId: toolCall.toolCallId,
            output: { filled: false, reason: "No matching form registered" },
          });
          return;
        }
        const fields =
          (toolInput.fields as Array<{ path: string; value: string }>) ?? [];
        // Async fill — resolve the tool result when done
        fillFormFieldsWithDelay(schemaId, fields, 80)
          .then((count) => {
            addToolResult({
              tool: "fillForm",
              toolCallId: toolCall.toolCallId,
              output: { filled: true, count },
            });
          })
          .catch(() => {
            addToolResult({
              tool: "fillForm",
              toolCallId: toolCall.toolCallId,
              output: { filled: false },
            });
          });
        // keep pending — async fill resolves the tool result above
        return;
      }

      // confirmAction, showDraftPreview, requestApproval: stay pending
    },
    onError: () => {
      // Error shown via failed stream in message list
    },
  });

  const isLoading = status === "submitted" || status === "streaming";

  // Auto-scroll when a new message arrives (ref-based to avoid dep warning)
  useEffect(() => {
    const lastId = messages.at(-1)?.id;
    if (lastId && lastId !== lastMessageIdRef.current) {
      lastMessageIdRef.current = lastId;
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isLoading) {
      return;
    }
    setInput("");
    sendMessage(
      { text },
      {
        body: {
          activeFormSchemaId: getActiveFormSchemaId(),
          currentPath: pathname,
        },
      }
    );
  }

  const suggestions = getSuggestions(roles);

  function sendSuggestion(s: string) {
    if (isLoading) {
      return;
    }
    sendMessage(
      { text: s },
      {
        body: {
          activeFormSchemaId: getActiveFormSchemaId(),
          currentPath: pathname,
        },
      }
    );
  }

  return (
    <>
      {/* Floating launcher (mobile) */}
      <button
        aria-label="Open BISO Assistant"
        className="fixed right-5 bottom-5 z-40 flex h-11 w-11 items-center justify-center rounded-full shadow-lg transition md:hidden"
        onClick={() => setOpen(true)}
        style={{ background: STUDIO.ink, color: STUDIO.paper }}
        type="button"
      >
        <Sparkles size={18} />
      </button>

      {/* Backdrop */}
      {open && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-30 md:hidden"
          onClick={() => setOpen(false)}
          style={{ background: "rgba(26,24,20,0.28)" }}
        />
      )}

      {/* Panel */}
      <div
        aria-label="BISO Assistant"
        className="fixed inset-y-0 right-0 z-40 flex w-[380px] flex-col overflow-hidden transition-transform duration-300 md:w-[400px]"
        role="dialog"
        style={{
          background: STUDIO.paper,
          borderLeft: `0.5px solid ${STUDIO.rule2}`,
          boxShadow: "-8px 0 32px rgba(26,24,20,0.08)",
          transform: open ? "translateX(0)" : "translateX(100%)",
        }}
      >
        {/* Header */}
        <div
          className="flex h-[52px] shrink-0 items-center gap-2.5 px-4"
          style={{
            background: "rgba(250,247,242,0.92)",
            backdropFilter: "blur(12px)",
            borderBottom: `0.5px solid ${STUDIO.rule}`,
          }}
        >
          <div
            className="flex h-7 w-7 items-center justify-center rounded-full"
            style={{ background: STUDIO.ink }}
          >
            <Sparkles size={13} style={{ color: STUDIO.paper }} />
          </div>
          <p
            className="flex-1 font-semibold text-[13px]"
            style={{ color: STUDIO.ink }}
          >
            BISO Assistant
          </p>
          <button
            aria-label="Close assistant"
            className="flex h-7 w-7 items-center justify-center rounded-lg transition"
            onClick={() => setOpen(false)}
            style={{ color: STUDIO.ink3 }}
            type="button"
          >
            <X size={15} />
          </button>
        </div>

        {/* Messages */}
        <div className="portal-scrollbar min-h-0 flex-1 overflow-y-auto p-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center py-8 text-center">
              <div
                className="mb-4 flex h-12 w-12 items-center justify-center rounded-full"
                style={{ background: STUDIO.paper3 }}
              >
                <Sparkles size={20} style={{ color: STUDIO.ink3 }} />
              </div>
              <p
                className="mb-1 font-semibold text-[15px]"
                style={{ color: STUDIO.ink, fontFamily: SERIF_STACK }}
              >
                What can I help with?
              </p>
              <p
                className="mb-5 max-w-[260px] text-[13px] leading-5"
                style={{ color: STUDIO.ink3 }}
              >
                Ask me to create, search, or manage anything in BISO Studio.
                I&apos;ll ask before making changes.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {suggestions.map((s) => (
                  <button
                    className="rounded-full border px-3 py-1.5 text-[12px] transition hover:bg-white/70"
                    key={s}
                    onClick={() => sendSuggestion(s)}
                    style={{
                      background: "rgba(255,255,255,0.58)",
                      borderColor: STUDIO.rule2,
                      color: STUDIO.ink2,
                    }}
                    type="button"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message) => {
            const isUser = message.role === "user";
            return (
              <div
                className={`mb-4 flex ${isUser ? "justify-end" : "justify-start"}`}
                key={message.id}
              >
                {!isUser && (
                  <div
                    className="mt-1 mr-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                    style={{ background: STUDIO.ink }}
                  >
                    <Sparkles size={11} style={{ color: STUDIO.paper }} />
                  </div>
                )}
                <div
                  className={`space-y-2 ${isUser ? "max-w-[88%]" : "min-w-0 flex-1"}`}
                >
                  {isUser ? (
                    <div
                      className="inline-block rounded-2xl rounded-tr-sm px-3.5 py-2.5 text-[13.5px] leading-5"
                      style={{ background: STUDIO.ink, color: STUDIO.paper }}
                    >
                      {message.parts?.map((p, i) =>
                        p.type === "text" ? (
                          <span key={i}>
                            {(p as { text: string; type: "text" }).text}
                          </span>
                        ) : null
                      ) ?? (message as { content?: string }).content}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {message.parts?.map((p, i) => {
                        const part = p as {
                          type: string;
                          [k: string]: unknown;
                        };
                        if (part.type === "text") {
                          return (
                            <p
                              className="whitespace-pre-wrap break-words text-[13.5px] leading-[1.55]"
                              key={i}
                              style={{ color: STUDIO.ink }}
                            >
                              {part.text as string}
                            </p>
                          );
                        }
                        if (
                          typeof part.type === "string" &&
                          part.type.startsWith("tool-")
                        ) {
                          return renderToolPart(
                            part as ToolPartRecord,
                            i,
                            addToolResult,
                            approvalResults,
                            setApprovalResults
                          );
                        }
                        return null;
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="mb-4 flex justify-start">
              <div
                className="mt-1 mr-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                style={{ background: STUDIO.ink }}
              >
                <Sparkles size={11} style={{ color: STUDIO.paper }} />
              </div>
              <div
                className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm px-4 py-3"
                style={{
                  background: "rgba(255,255,255,0.7)",
                  border: `0.5px solid ${STUDIO.rule}`,
                }}
              >
                {[0, 1, 2].map((i) => (
                  <span
                    className="block h-1.5 w-1.5 animate-bounce rounded-full"
                    key={i}
                    style={{
                      animationDelay: `${i * 120}ms`,
                      background: STUDIO.ink3,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <form
          className="shrink-0 p-3"
          onSubmit={handleSubmit}
          style={{ borderTop: `0.5px solid ${STUDIO.rule}` }}
        >
          <div
            className="flex items-end gap-2 rounded-xl border px-3 py-2"
            style={{
              background: "rgba(255,255,255,0.72)",
              borderColor: STUDIO.rule2,
            }}
          >
            <textarea
              className="flex-1 resize-none bg-transparent text-[13.5px] outline-none"
              disabled={isLoading}
              maxLength={2000}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder="Ask BISO Assistant…"
              rows={1}
              style={{ color: STUDIO.ink, lineHeight: "1.5" }}
              value={input}
            />
            <button
              aria-label="Send"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition disabled:opacity-40"
              disabled={!input.trim() || isLoading}
              style={{
                background:
                  input.trim() && !isLoading ? STUDIO.ink : STUDIO.rule2,
                color: input.trim() && !isLoading ? STUDIO.paper : STUDIO.ink4,
              }}
              type="submit"
            >
              {isLoading ? (
                <Loader2 className="animate-spin" size={13} />
              ) : (
                <Send size={13} />
              )}
            </button>
          </div>
          <p
            className="mt-1.5 text-center text-[10px]"
            style={{ color: STUDIO.ink4, fontFamily: MONO_STACK }}
          >
            Enter to send • Shift+Enter for newline
          </p>
        </form>
      </div>
    </>
  );
}

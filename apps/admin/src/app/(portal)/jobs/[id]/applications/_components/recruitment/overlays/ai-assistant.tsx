"use client";

import { CornerDownLeft, Send, Sparkles, X } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import {
  type AssistantAction,
  type AssistantCandidate,
  askRecruitmentAssistant,
} from "../../../_actions/recruitment-ai";
import { candidateById, useRecruitment } from "../recruitment-context";
import { Avatar } from "../shared";

const SUGGESTIONS = [
  "Show me the top 3 shortlist candidates",
  "Who is stalling and who should I nudge?",
  "What's missing in this pipeline?",
  "Draft rejection notes for the archived candidates",
];

interface ChatMessage {
  actions?: AssistantAction[];
  citationIds?: string[];
  from: "user" | "bot";
  text: string;
}

function toSummaries(
  candidates: ReturnType<typeof useRecruitment>["candidates"]
): AssistantCandidate[] {
  return candidates.map((candidate) => ({
    days: candidate.days,
    gaps: candidate.gaps,
    id: candidate.id,
    name: candidate.name,
    score: candidate.score,
    skills: candidate.skills,
    source: candidate.source,
    stage: candidate.stage,
    strengths: candidate.strengths,
    summary: candidate.summary,
  }));
}

export function AiAssistant({ onClose }: { onClose: () => void }) {
  const { candidates, job, jobId, actions } = useRecruitment();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, startSend] = useTransition();
  const listRef = useRef<HTMLDivElement>(null);

  const send = (text: string) => {
    const message = text.trim();
    if (!message || sending) {
      return;
    }
    setMessages((prev) => [...prev, { from: "user", text: message }]);
    setInput("");
    startSend(async () => {
      const result = await askRecruitmentAssistant({
        candidates: toSummaries(candidates),
        jobId,
        jobTitle: job.titleEn,
        message,
      });
      setMessages((prev) => [
        ...prev,
        {
          actions: result.actions.filter((action) => action.kind !== "none"),
          citationIds: result.citationIds,
          from: "bot",
          text: result.reply,
        },
      ]);
      requestAnimationFrame(() => {
        listRef.current?.scrollTo({
          behavior: "smooth",
          top: listRef.current.scrollHeight,
        });
      });
    });
  };

  const runAction = (action: AssistantAction) => {
    if (action.kind === "compare" && action.ids.length >= 2) {
      actions.openCompare(action.ids.slice(0, 3));
    } else if (action.kind === "email" && action.ids.length > 0) {
      actions.openEmail(action.ids, "shortlist");
    } else if (action.kind === "schedule" && action.ids.length > 0) {
      const candidate = candidateById(candidates, action.ids[0]);
      if (candidate) {
        actions.openSchedule(candidate);
      }
    }
  };

  return (
    <>
      <button
        aria-label="Close"
        className="ai-overlay"
        onClick={onClose}
        type="button"
      />
      <aside className="ai-panel" role="dialog">
        <div className="ai-head">
          <span className="ai-glyph">
            <Sparkles size={16} />
          </span>
          <div className="ai-head-id">
            <span className="ai-eyebrow">AI Assistant · model v4.2</span>
            <h2>Pipeline copilot</h2>
            <span className="ai-status">
              Reading {candidates.length} applicants
            </span>
          </div>
          <button className="ai-close" onClick={onClose} type="button">
            <X size={16} />
          </button>
        </div>

        <div className="ai-body scroll" ref={listRef}>
          {messages.length === 0 ? (
            <div className="ai-suggestions">
              <p className="ai-suggest-label">Try asking</p>
              {SUGGESTIONS.map((suggestion) => (
                <button
                  className="ai-suggest"
                  key={suggestion}
                  onClick={() => send(suggestion)}
                  type="button"
                >
                  <Sparkles size={12} /> {suggestion}
                </button>
              ))}
            </div>
          ) : null}

          {messages.map((message, index) => (
            <div className={`ai-msg ${message.from}`} key={index}>
              <div className="ai-bubble">{message.text}</div>
              {message.citationIds && message.citationIds.length > 0 ? (
                <div className="ai-cites">
                  {message.citationIds.map((id) => {
                    const candidate = candidateById(candidates, id);
                    if (!candidate) {
                      return null;
                    }
                    return (
                      <button
                        className="ai-cite"
                        key={id}
                        onClick={() => actions.openCandidate(id)}
                        type="button"
                      >
                        <Avatar name={candidate.name} size={18} />
                        {candidate.name.split(" ")[0]}
                      </button>
                    );
                  })}
                </div>
              ) : null}
              {message.actions && message.actions.length > 0 ? (
                <div className="ai-actions">
                  {message.actions.map((action) => (
                    <button
                      className="ai-action"
                      key={action.label}
                      onClick={() => runAction(action)}
                      type="button"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
          {sending ? <div className="ai-thinking">Thinking…</div> : null}
        </div>

        <div className="ai-foot">
          <div className="ai-input">
            <textarea
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  send(input);
                }
              }}
              placeholder="Ask about your pipeline…"
              value={input}
            />
            <button
              className="ai-send"
              disabled={!input.trim() || sending}
              onClick={() => send(input)}
              type="button"
            >
              <Send size={15} />
            </button>
          </div>
          <span className="ai-kbd">
            <CornerDownLeft size={11} /> to send · Shift+Enter for newline
          </span>
        </div>
      </aside>
    </>
  );
}

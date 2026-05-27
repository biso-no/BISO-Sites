"use client";

import { Check, ChevronDown, Copy, Mail, X } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import {
  type BulkEmailDraft,
  draftBulkCandidateEmails,
} from "../../../_actions/recruitment-ai";
import type { EmailIntent } from "../recruitment-context";
import { useRecruitment } from "../recruitment-context";
import { Avatar } from "../shared";
import { cx } from "../view-model";

function badgeLabel(draft: BulkEmailDraft | undefined): string {
  if (draft?.error) {
    return "Failed";
  }
  if (draft) {
    return "Drafted";
  }
  return "…";
}

const INTENTS: { id: EmailIntent; label: string }[] = [
  { id: "shortlist", label: "You're shortlisted" },
  { id: "schedule", label: "Schedule interview" },
  { id: "reject", label: "Not this round" },
  { id: "offer", label: "Offer letter" },
];

export function BulkEmailComposer({
  ids,
  intent: initialIntent,
  onClose,
}: {
  ids: string[];
  intent: EmailIntent;
  onClose: () => void;
}) {
  const { candidates } = useRecruitment();
  const [intent, setIntent] = useState<EmailIntent>(initialIntent);
  const [drafts, setDrafts] = useState<Map<string, BulkEmailDraft>>(new Map());
  const [loading, startLoad] = useTransition();
  const [expanded, setExpanded] = useState<string | null>(ids[0] ?? null);
  const [copiedAll, setCopiedAll] = useState(false);

  const recipients = ids
    .map((id) => candidates.find((candidate) => candidate.id === id))
    .filter(Boolean);

  useEffect(() => {
    startLoad(async () => {
      const result = await draftBulkCandidateEmails(ids, intent);
      const map = new Map<string, BulkEmailDraft>();
      for (const draft of result.data ?? []) {
        map.set(draft.id, draft);
      }
      setDrafts(map);
    });
  }, [ids, intent]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const updateDraft = (id: string, patch: Partial<BulkEmailDraft>) => {
    setDrafts((prev) => {
      const next = new Map(prev);
      const current = next.get(id);
      if (current) {
        next.set(id, { ...current, ...patch });
      }
      return next;
    });
  };

  const copyAll = () => {
    const text = recipients
      .map((candidate) => {
        if (!candidate) {
          return "";
        }
        const draft = drafts.get(candidate.id);
        return draft
          ? `To: ${candidate.email}\nSubject: ${draft.subject}\n\n${draft.body}`
          : "";
      })
      .filter(Boolean)
      .join("\n\n———\n\n");
    navigator.clipboard?.writeText(text).then(
      () => {
        setCopiedAll(true);
        setTimeout(() => setCopiedAll(false), 1800);
      },
      () => undefined
    );
  };

  const readyCount = Array.from(drafts.values()).filter(
    (draft) => !draft.error && draft.subject
  ).length;

  return (
    <div className="email-panel">
      <div className="email-head">
        <span className="email-tag">
          <Mail size={13} /> Bulk AI-personalized email · {ids.length}{" "}
          recipients
        </span>
        <button className="email-close" onClick={onClose} type="button">
          <X size={16} />
        </button>
      </div>
      <h2 className="email-title">One message, tailored {ids.length} ways.</h2>

      <div className="email-config">
        {INTENTS.map((option) => (
          <button
            className={cx("email-intent", intent === option.id && "on")}
            key={option.id}
            onClick={() => setIntent(option.id)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="email-summary">
        {loading
          ? "Drafting a unique email for each candidate…"
          : `${readyCount} of ${ids.length} drafts ready · personalized from each candidate's strengths.`}
      </div>

      <div className="email-list scroll">
        {recipients.map((candidate) => {
          if (!candidate) {
            return null;
          }
          const draft = drafts.get(candidate.id);
          const isOpen = expanded === candidate.id;
          return (
            <div className="email-item" key={candidate.id}>
              <button
                className="email-item-top"
                onClick={() => setExpanded(isOpen ? null : candidate.id)}
                type="button"
              >
                <Avatar name={candidate.name} size={28} />
                <span className="email-item-id">
                  <span className="email-item-name">{candidate.name}</span>
                  <span className="email-item-mail">{candidate.email}</span>
                </span>
                <span className={cx("email-item-badge", draft?.error && "err")}>
                  {badgeLabel(draft)}
                </span>
                <ChevronDown
                  size={15}
                  style={{ transform: isOpen ? "rotate(180deg)" : "none" }}
                />
              </button>
              {isOpen && draft && !draft.error ? (
                <div className="email-draft">
                  <input
                    className="email-subject"
                    onChange={(event) =>
                      updateDraft(candidate.id, { subject: event.target.value })
                    }
                    value={draft.subject}
                  />
                  <textarea
                    className="email-body"
                    onChange={(event) =>
                      updateDraft(candidate.id, { body: event.target.value })
                    }
                    value={draft.body}
                  />
                </div>
              ) : null}
              {isOpen && draft?.error ? (
                <p className="email-draft-error">{draft.error}</p>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="email-foot">
        <span className="email-foot-note">
          Drafts are copy-ready — paste into your mail client to send.
        </span>
        <button className="btn-dark" onClick={copyAll} type="button">
          {copiedAll ? <Check size={13} /> : <Copy size={13} />} Copy all drafts
        </button>
      </div>
    </div>
  );
}

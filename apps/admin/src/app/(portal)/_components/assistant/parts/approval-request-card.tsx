"use client";

import { Clock, Send, X } from "lucide-react";
import { useState } from "react";
import { MONO_STACK, STUDIO } from "../../studio";

const TEAM_PREFIX_RE = /^sg-app-dept-/i;
const HYPHEN_RE = /-/g;
const WORD_START_RE = /\b\w/g;

interface ApprovalRequestCardProps {
  action: string;
  approverTeam: string;
  onCancel: () => void;
  onSubmit: () => Promise<void>;
  payload: Record<string, unknown>;
  resourceType: string;
  result?: { submitted: boolean; error?: string };
}

export function ApprovalRequestCard({
  action,
  approverTeam,
  onCancel,
  onSubmit,
  resourceType,
  result,
}: ApprovalRequestCardProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (result !== undefined) {
    return (
      <div
        className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs"
        style={{
          background: result.submitted
            ? "rgba(176,138,62,0.09)"
            : "rgba(26,24,20,0.05)",
          borderColor: result.submitted
            ? "rgba(176,138,62,0.22)"
            : STUDIO.rule2,
          color: result.submitted ? STUDIO.gold : STUDIO.ink3,
          fontFamily: MONO_STACK,
        }}
      >
        {result.submitted ? (
          <>
            <Clock size={11} /> Approval request sent to {approverTeam}
          </>
        ) : (
          <>Request cancelled</>
        )}
      </div>
    );
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit");
      setSubmitting(false);
    }
  }

  // Format approver team for display
  const teamDisplay = approverTeam
    .replace(TEAM_PREFIX_RE, "")
    .replace(HYPHEN_RE, " ")
    .replace(WORD_START_RE, (c) => c.toUpperCase());

  return (
    <div
      className="mt-2 w-full max-w-sm rounded-xl border p-4"
      style={{
        background: "rgba(255,255,255,0.72)",
        borderColor: "rgba(176,138,62,0.28)",
        boxShadow: "0 2px 8px rgba(26,24,20,0.06)",
      }}
    >
      <div
        className="mb-2 flex items-center gap-2 rounded-lg px-2.5 py-1.5"
        style={{
          background: "rgba(176,138,62,0.09)",
          border: "0.5px solid rgba(176,138,62,0.22)",
        }}
      >
        <Clock size={13} style={{ color: STUDIO.gold, flexShrink: 0 }} />
        <span className="font-medium text-xs" style={{ color: STUDIO.gold }}>
          Approval required
        </span>
      </div>

      <p className="mb-1 font-medium text-[13px]" style={{ color: STUDIO.ink }}>
        {action.replace(".", " → ").replace(/\b\w/g, (c) => c.toUpperCase())}
      </p>
      <p className="mb-3 text-[12px]" style={{ color: STUDIO.ink3 }}>
        This {resourceType} requires approval from{" "}
        <strong style={{ color: STUDIO.ink2 }}>{teamDisplay}</strong> before it
        can be published.
      </p>

      {error && (
        <p className="mb-2 text-[11px]" style={{ color: STUDIO.claret }}>
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 font-medium text-xs transition disabled:opacity-50"
          disabled={submitting}
          onClick={handleSubmit}
          style={{
            background: STUDIO.gold,
            color: STUDIO.white,
          }}
          type="button"
        >
          <Send size={11} />
          {submitting ? "Sending…" : "Send approval request"}
        </button>
        <button
          className="rounded-lg px-3 py-2 text-xs transition"
          disabled={submitting}
          onClick={onCancel}
          style={{
            background: "rgba(26,24,20,0.06)",
            color: STUDIO.ink3,
          }}
          type="button"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
}

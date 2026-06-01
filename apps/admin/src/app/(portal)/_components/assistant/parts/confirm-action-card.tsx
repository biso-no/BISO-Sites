"use client";

import { AlertTriangle, CheckCircle } from "lucide-react";
import { MONO_STACK, STUDIO } from "../../studio";

interface ConfirmActionCardProps {
  actionLabel: string;
  danger?: boolean;
  description: string;
  onCancel: () => void;
  onConfirm: () => void;
  /** If true, show the result instead of the prompt */
  result?: { confirmed: boolean };
}

export function ConfirmActionCard({
  actionLabel,
  danger,
  description,
  onCancel,
  onConfirm,
  result,
}: ConfirmActionCardProps) {
  // Show a compact result chip once resolved
  if (result !== undefined) {
    return (
      <div
        className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs"
        style={{
          background: result.confirmed
            ? "rgba(47,93,58,0.08)"
            : "rgba(26,24,20,0.05)",
          borderColor: result.confirmed ? "rgba(47,93,58,0.18)" : STUDIO.rule2,
          color: result.confirmed ? STUDIO.leaf : STUDIO.ink3,
          fontFamily: MONO_STACK,
        }}
      >
        {result.confirmed ? (
          <>
            <CheckCircle size={11} /> {actionLabel} confirmed
          </>
        ) : (
          <>Cancelled</>
        )}
      </div>
    );
  }

  const accentColor = danger ? STUDIO.claret : STUDIO.sky;
  const accentBg = danger ? "rgba(107,30,30,0.07)" : "rgba(42,74,122,0.07)";
  const accentBorder = danger ? "rgba(107,30,30,0.18)" : "rgba(42,74,122,0.18)";

  return (
    <div
      className="mt-2 w-full max-w-sm rounded-xl border p-4"
      style={{
        background: "rgba(255,255,255,0.72)",
        borderColor: STUDIO.rule2,
        boxShadow: "0 2px 8px rgba(26,24,20,0.06)",
      }}
    >
      <div
        className="mb-2 flex items-center gap-2 rounded-lg px-2.5 py-1.5"
        style={{ background: accentBg, border: `0.5px solid ${accentBorder}` }}
      >
        {danger ? (
          <AlertTriangle
            size={14}
            style={{ color: accentColor, flexShrink: 0 }}
          />
        ) : (
          <CheckCircle
            size={14}
            style={{ color: accentColor, flexShrink: 0 }}
          />
        )}
        <span className="font-medium text-xs" style={{ color: accentColor }}>
          {actionLabel}
        </span>
      </div>

      <p className="mb-4 text-[13px] leading-5" style={{ color: STUDIO.ink2 }}>
        {description}
      </p>

      <div className="flex gap-2">
        <button
          className="flex-1 rounded-lg py-2 text-center font-medium text-xs transition"
          onClick={onConfirm}
          style={{
            background: danger ? STUDIO.claret : STUDIO.ink,
            color: STUDIO.paper,
          }}
          type="button"
        >
          {danger ? "Delete" : "Confirm"}
        </button>
        <button
          className="rounded-lg px-3 py-2 text-xs transition"
          onClick={onCancel}
          style={{
            background: "rgba(26,24,20,0.06)",
            color: STUDIO.ink3,
          }}
          type="button"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

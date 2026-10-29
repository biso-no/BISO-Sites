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

interface ToolCallSummary {
  actionLabel: string;
  danger: boolean;
  description: string;
}

const MAX_SHOWN_CHARS = 80;
const MAX_SHOWN_FIELDS = 6;

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function shown(value: unknown): string {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  if (text === undefined) {
    return "";
  }
  return text.length > MAX_SHOWN_CHARS
    ? `${text.slice(0, MAX_SHOWN_CHARS)}…`
    : text;
}

function describeChanges(payload: Record<string, unknown>): string {
  const entries = Object.entries(payload);
  if (entries.length === 0) {
    return "No fields change.";
  }
  const lines = entries
    .slice(0, MAX_SHOWN_FIELDS)
    .map(([field, value]) => `${field}: ${shown(value)}`);
  const more = entries.length - MAX_SHOWN_FIELDS;
  return `Changes ${lines.join("; ")}${more > 0 ? ` (+${more} more)` : ""}.`;
}

function describeCreate(input: Record<string, unknown>): ToolCallSummary {
  const payload = asRecord(input.payload);
  const title = shown(
    payload.title_no ?? payload.title_en ?? payload.title ?? payload.name ?? ""
  );
  const publish = input.publish === true;
  return {
    actionLabel: publish
      ? `Create and publish ${shown(input.domain)}`
      : `Create ${shown(input.domain)} draft`,
    danger: false,
    description: `${title ? `"${title}". ` : ""}${
      publish ? "It goes live right away." : "It is saved as a draft."
    }`,
  };
}

/**
 * What a confirmed assistant tool call will do, built from the call's real
 * tool name and input rather than from text the model wrote.
 */
export function describeToolCall(
  toolName: string,
  input: Record<string, unknown>
): ToolCallSummary {
  const target = `${shown(input.domain)} ${shown(input.id)}`;
  switch (toolName) {
    case "createContent":
      return describeCreate(input);
    case "updateContent":
      return {
        actionLabel: `Update ${target}`,
        danger: false,
        description: describeChanges(asRecord(input.payload)),
      };
    case "publishContent":
      return {
        actionLabel: `Publish ${target}`,
        danger: false,
        description: "It goes live on the site.",
      };
    case "deleteContent":
      return {
        actionLabel: `Delete ${target}`,
        danger: true,
        description: "This can't be undone.",
      };
    case "approveRequest":
      return {
        actionLabel: "Approve request",
        danger: false,
        description: `Approves request ${shown(input.requestId)}.`,
      };
    case "rejectRequest":
      return {
        actionLabel: "Reject request",
        danger: false,
        description: `Rejects request ${shown(input.requestId)}. Reason: ${shown(input.reason)}`,
      };
    case "createM365User":
      return {
        actionLabel: "Create Microsoft 365 user",
        danger: false,
        description: `${shown(input.firstName)} ${shown(input.lastName)} (${shown(input.upnPrefix)}@biso.no), ${shown(input.department)}, ${shown(input.campus)}.`,
      };
    case "toggleFeatureFlag":
      return {
        actionLabel: `Turn ${input.enabled === true ? "on" : "off"} feature flag`,
        danger: false,
        description: `Flag: ${shown(input.flagKey)}.`,
      };
    default:
      return {
        actionLabel: `Run ${toolName}`,
        danger: false,
        description: shown(input),
      };
  }
}

interface ToolApprovalCardProps {
  input: Record<string, unknown>;
  onRespond: (approved: boolean) => void;
  /** Set once the user has answered */
  result?: { confirmed: boolean };
  toolName: string;
}

/** Confirmation card the server requires before an assistant write runs. */
export function ToolApprovalCard({
  input,
  onRespond,
  result,
  toolName,
}: ToolApprovalCardProps) {
  const { actionLabel, danger, description } = describeToolCall(
    toolName,
    input
  );
  return (
    <ConfirmActionCard
      actionLabel={actionLabel}
      danger={danger}
      description={description}
      onCancel={() => onRespond(false)}
      onConfirm={() => onRespond(true)}
      result={result}
    />
  );
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

  const toneColor = danger ? STUDIO.claret : STUDIO.sky;
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
            style={{ color: toneColor, flexShrink: 0 }}
          />
        ) : (
          <CheckCircle size={14} style={{ color: toneColor, flexShrink: 0 }} />
        )}
        <span className="font-medium text-xs" style={{ color: toneColor }}>
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

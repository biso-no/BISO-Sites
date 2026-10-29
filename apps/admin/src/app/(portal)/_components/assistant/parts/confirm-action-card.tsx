"use client";

import { READ_ONLY_TOOL_NAMES } from "@repo/ai/assistant/read-only-tools";
import { AlertTriangle, CheckCircle } from "lucide-react";
import { resolveConfirmedCampusId } from "@/lib/assistant-campus";
import { CAMPUS_ID_TO_NAME } from "@/lib/campus-constants";
import { MONO_STACK, STUDIO } from "../../studio";

interface ConfirmActionCardProps {
  actionLabel: string;
  danger?: boolean;
  description: string;
  /** Extra lines under the description, e.g. each changed field */
  details?: string[];
  /** Buttons can't be used, e.g. a later message has moved past the card */
  disabled?: boolean;
  /** Values the detail lines cut short, to read in full */
  longValues?: LongValue[];
  onCancel: () => void;
  onConfirm: () => void;
  /** If true, show the result instead of the prompt */
  result?: { confirmed: boolean };
}

interface LongValue {
  field: string;
  value: string;
}

interface ToolCallSummary {
  actionLabel: string;
  danger: boolean;
  description: string;
  /** One line per detail; never cut short, only each value is */
  details: string[];
  /** Full text of each value a detail line cut short */
  longValues: LongValue[];
}

/** Titles of rows that earlier tool results in the conversation returned, by row id. */
export type KnownTitles = ReadonlyMap<string, string>;

const MAX_SHOWN_CHARS = 80;
const MAX_TITLE_SCAN_DEPTH = 6;
const TITLE_FIELDS = ["title_no", "title_en", "title", "name"] as const;
const NO_TITLES: KnownTitles = new Map();

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function nonEmpty(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function fullText(value: unknown): string {
  return (typeof value === "string" ? value : JSON.stringify(value)) ?? "";
}

function shown(value: unknown): string {
  const text = fullText(value);
  return text.length > MAX_SHOWN_CHARS
    ? `${text.slice(0, MAX_SHOWN_CHARS)}…`
    : text;
}

/** `field: value` with the value cut short; the full text goes to `longValues`. */
function fieldLine(
  field: string,
  value: unknown,
  longValues: LongValue[]
): string {
  const text = fullText(value);
  if (text.length > MAX_SHOWN_CHARS) {
    longValues.push({ field, value: text });
  }
  return `${field}: ${shown(value)}`;
}

function orNone(value: unknown): string {
  return value === undefined || value === null || value === ""
    ? "none"
    : shown(value);
}

/** A readable name for a row: its title, or for an approval request what it asks for. */
function titleOf(record: Record<string, unknown>): string | null {
  for (const field of TITLE_FIELDS) {
    const title = nonEmpty(record[field]);
    if (title) {
      return title;
    }
  }
  const action = nonEmpty(record.action);
  const resourceType = nonEmpty(record.resource_type);
  if (action && resourceType) {
    const requester = nonEmpty(record.requester_email);
    return `${action} (${resourceType})${requester ? `, asked by ${requester}` : ""}`;
  }
  return null;
}

function collectTitles(
  value: unknown,
  depth: number,
  titles: Map<string, string>
) {
  if (depth > MAX_TITLE_SCAN_DEPTH || typeof value !== "object" || !value) {
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectTitles(item, depth + 1, titles);
    }
    return;
  }
  const record = value as Record<string, unknown>;
  const id = nonEmpty(record.$id) ?? nonEmpty(record.id);
  const title = titleOf(record);
  if (id && title) {
    titles.set(id, title);
  }
  for (const nested of Object.values(record)) {
    collectTitles(nested, depth + 1, titles);
  }
}

function isReadToolPart(type: unknown): boolean {
  return (
    typeof type === "string" &&
    type.startsWith("tool-") &&
    READ_ONLY_TOOL_NAMES.has(type.slice("tool-".length))
  );
}

/**
 * Titles by row id from finished results of read tools; later results win.
 * Other tool outputs (client tools the model fills in) are not trusted.
 */
export function collectKnownTitles(
  messages: ReadonlyArray<{ parts?: readonly unknown[] }>
): Map<string, string> {
  const titles = new Map<string, string>();
  for (const message of messages) {
    for (const part of message.parts ?? []) {
      const record = asRecord(part);
      if (isReadToolPart(record.type) && record.state === "output-available") {
        collectTitles(record.output, 0, titles);
      }
    }
  }
  return titles;
}

/**
 * Only cards in the newest message can still be answered: the server ignores
 * an answer to a card that a later message has moved past.
 */
export function isAnswerableMessage(
  messages: ReadonlyArray<{ role: string }>,
  index: number
): boolean {
  return index === messages.length - 1 && messages[index]?.role === "assistant";
}

function campusLabel(campusId: unknown): string {
  const id =
    nonEmpty(campusId) ??
    (typeof campusId === "number" ? String(campusId) : null);
  if (!id) {
    return "none";
  }
  const name = CAMPUS_ID_TO_NAME[id];
  return name ? `${name} (${id})` : id;
}

/** `"Title" (jobs abc)` when a title is known, else `jobs abc`. */
function itemLine(
  input: Record<string, unknown>,
  knownTitles: KnownTitles
): string {
  const id = shown(input.id);
  const target = `${shown(input.domain)} ${id}`;
  const title = knownTitles.get(id);
  return title ? `"${shown(title)}" (${target})` : target;
}

function requestLine(
  input: Record<string, unknown>,
  knownTitles: KnownTitles
): string {
  const id = shown(input.requestId);
  const title = knownTitles.get(id);
  return title ? `"${shown(title)}" (request ${id})` : `Request ${id}`;
}

/** Payload fields the route replaces with the facts shown above them. */
const CREATE_FACT_FIELDS = new Set([
  "campus_id",
  "campusId",
  "department",
  "department_id",
  "departmentId",
  "notify_push",
  "status",
]);

/** Domains whose create always sends a push notification. */
const PUSH_ON_CREATE_DOMAINS = new Set(["events", "jobs", "news"]);

function describeCreate(input: Record<string, unknown>): ToolCallSummary {
  const payload = asRecord(input.payload);
  const title = titleOf(payload);
  const publish = input.publish === true;
  const longValues: LongValue[] = [];
  const details = [
    `Campus: ${campusLabel(resolveConfirmedCampusId(input.campusId, payload))}`,
    `Department: ${orNone(input.departmentId ?? payload.department_id ?? payload.department)}`,
    `Publishes now: ${publish ? "yes" : "no"}`,
  ];
  if (PUSH_ON_CREATE_DOMAINS.has(String(input.domain))) {
    details.push("Push notification: yes");
  }
  for (const [field, value] of Object.entries(payload)) {
    if (!CREATE_FACT_FIELDS.has(field)) {
      details.push(fieldLine(field, value, longValues));
    }
  }
  return {
    actionLabel: publish
      ? `Create and publish ${shown(input.domain)}`
      : `Create ${shown(input.domain)} draft`,
    danger: false,
    description: `${title ? `"${shown(title)}". ` : ""}${
      publish ? "It goes live right away." : "It is saved as a draft."
    }`,
    details,
    longValues,
  };
}

function describeUpdate(
  input: Record<string, unknown>,
  knownTitles: KnownTitles
): ToolCallSummary {
  const entries = Object.entries(asRecord(input.payload));
  const longValues: LongValue[] = [];
  const item = itemLine(input, knownTitles);
  return {
    actionLabel: `Update ${shown(input.domain)}`,
    danger: false,
    description:
      entries.length === 0
        ? `${item}. No fields change.`
        : `${item}. Changes ${entries.length} ${
            entries.length === 1 ? "field" : "fields"
          }:`,
    details: entries.map(([field, value]) =>
      fieldLine(field, value, longValues)
    ),
    longValues,
  };
}

function describeM365User(input: Record<string, unknown>): ToolCallSummary {
  return {
    actionLabel: "Create Microsoft 365 user",
    danger: false,
    description: `${shown(input.firstName)} ${shown(input.lastName)} (${shown(input.upnPrefix)}@biso.no).`,
    details: [
      `Department: ${orNone(input.department)}`,
      `Campus: ${orNone(input.campus)}`,
      `Job title: ${orNone(input.jobTitle)}`,
      `Manager: ${orNone(input.manager)}`,
    ],
    longValues: [],
  };
}

function describeRejection(
  input: Record<string, unknown>,
  knownTitles: KnownTitles
): ToolCallSummary {
  return {
    actionLabel: "Reject request",
    danger: false,
    description: `${requestLine(input, knownTitles)}.`,
    details: [`Reason: ${nonEmpty(input.reason) ?? "none"}`],
    longValues: [],
  };
}

/**
 * What a confirmed assistant tool call will do, built from the call's real
 * tool name and input rather than from text the model wrote. Titles come from
 * the input or from earlier tool results; the id is always shown.
 */
export function describeToolCall(
  toolName: string,
  input: Record<string, unknown>,
  knownTitles: KnownTitles = NO_TITLES
): ToolCallSummary {
  switch (toolName) {
    case "createContent":
      return describeCreate(input);
    case "updateContent":
      return describeUpdate(input, knownTitles);
    case "publishContent":
      return {
        actionLabel: `Publish ${shown(input.domain)}`,
        danger: false,
        description: `${itemLine(input, knownTitles)}. It goes live on the site.`,
        details: [],
        longValues: [],
      };
    case "deleteContent":
      return {
        actionLabel: `Delete ${shown(input.domain)}`,
        danger: true,
        description: `${itemLine(input, knownTitles)}. This can't be undone.`,
        details: [],
        longValues: [],
      };
    case "approveRequest":
      return {
        actionLabel: "Approve request",
        danger: false,
        description: `${requestLine(input, knownTitles)}.`,
        details: [],
        longValues: [],
      };
    case "rejectRequest":
      return describeRejection(input, knownTitles);
    case "createM365User":
      return describeM365User(input);
    case "toggleFeatureFlag":
      return {
        actionLabel: `Turn ${input.enabled === true ? "on" : "off"} feature flag`,
        danger: false,
        description: `Flag: ${shown(input.flagKey)}.`,
        details: [],
        longValues: [],
      };
    default: {
      const longValues: LongValue[] = [];
      return {
        actionLabel: `Run ${toolName}`,
        danger: false,
        description: "With these inputs:",
        details: Object.entries(input).map(([field, value]) =>
          fieldLine(field, value, longValues)
        ),
        longValues,
      };
    }
  }
}

interface ToolApprovalCardProps {
  /** False once a later message has moved past this card */
  answerable: boolean;
  input: Record<string, unknown>;
  knownTitles: KnownTitles;
  onRespond: (approved: boolean) => void;
  /** Set once the user has answered */
  result?: { confirmed: boolean };
  toolName: string;
}

/** Confirmation card the server requires before an assistant write runs. */
export function ToolApprovalCard({
  answerable,
  input,
  knownTitles,
  onRespond,
  result,
  toolName,
}: ToolApprovalCardProps) {
  const { actionLabel, danger, description, details, longValues } =
    describeToolCall(toolName, input, knownTitles);
  return (
    <ConfirmActionCard
      actionLabel={actionLabel}
      danger={danger}
      description={description}
      details={details}
      disabled={!answerable}
      longValues={longValues}
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
  details,
  disabled = false,
  longValues,
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

      {details && details.length > 0 && (
        <ul
          className="-mt-2 mb-4 list-disc space-y-0.5 pl-4 text-[12px] leading-5"
          style={{ color: STUDIO.ink2 }}
        >
          {details.map((detail) => (
            <li className="break-words" key={detail}>
              {detail}
            </li>
          ))}
        </ul>
      )}

      {longValues && longValues.length > 0 && (
        <div className="mb-4 space-y-1 text-[12px]">
          {longValues.map(({ field, value }) => (
            <details key={field} style={{ color: STUDIO.ink2 }}>
              <summary className="cursor-pointer">
                Show full value: {field}
              </summary>
              <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-words">
                {value}
              </pre>
            </details>
          ))}
        </div>
      )}

      {disabled && (
        <p className="mb-3 text-[11px]" style={{ color: STUDIO.ink3 }}>
          This card is no longer active. Ask again to make this change.
        </p>
      )}

      <div className="flex gap-2">
        <button
          className="flex-1 rounded-lg py-2 text-center font-medium text-xs transition disabled:cursor-not-allowed disabled:opacity-40"
          disabled={disabled}
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
          className="rounded-lg px-3 py-2 text-xs transition disabled:cursor-not-allowed disabled:opacity-40"
          disabled={disabled}
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

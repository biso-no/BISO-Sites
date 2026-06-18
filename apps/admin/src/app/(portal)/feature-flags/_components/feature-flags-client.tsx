"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { STUDIO, StudioButton, studioSurface } from "../../_components/studio";
import {
  createFeatureFlag,
  type FeatureFlagItem,
  setFeatureFlagEnabled,
} from "../actions";

interface FeatureFlagsLabels {
  columnFlag: string;
  columnState: string;
  create: {
    title: string;
    key: string;
    keyHint: string;
    name: string;
    descriptionLabel: string;
    submit: string;
    creating: string;
  };
  createError: string;
  createSuccess: string;
  disabled: string;
  empty: string;
  emptyDescription: string;
  enabled: string;
  toggleError: string;
  toggleSuccess: string;
}

function Toggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      aria-pressed={checked}
      className="relative h-6 w-10 shrink-0 rounded-full transition-all disabled:opacity-50"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        background: checked ? STUDIO.leaf : STUDIO.rule2,
        boxShadow: checked ? "0 4px 14px rgba(47,93,58,0.18)" : "none",
      }}
      type="button"
    >
      <span
        className="absolute top-1 h-4 w-4 rounded-full transition-all"
        style={{
          background: "#fff",
          left: checked ? "calc(100% - 20px)" : "4px",
        }}
      />
    </button>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl p-6" style={studioSurface}>
      <h3 className="mb-4 font-medium text-sm" style={{ color: STUDIO.ink }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function fieldStyle() {
  return {
    background: "rgba(255,255,255,0.62)",
    border: `0.5px solid ${STUDIO.rule2}`,
    color: STUDIO.ink,
  };
}

export function FeatureFlagsClient({
  initialFlags,
  labels,
}: {
  initialFlags: FeatureFlagItem[];
  labels: FeatureFlagsLabels;
}) {
  const [flags, setFlags] = useState<FeatureFlagItem[]>(initialFlags);
  const [keyValue, setKeyValue] = useState("");
  const [titleValue, setTitleValue] = useState("");
  const [descriptionValue, setDescriptionValue] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isCreating, startCreate] = useTransition();

  function handleToggle(flag: FeatureFlagItem, next: boolean) {
    setPendingId(flag.id);
    // Optimistic update; revert on error.
    setFlags((current) =>
      current.map((f) => (f.id === flag.id ? { ...f, enabled: next } : f))
    );
    startCreate(async () => {
      const result = await setFeatureFlagEnabled(flag.id, next);
      setPendingId(null);
      if ("error" in result) {
        setFlags((current) =>
          current.map((f) => (f.id === flag.id ? { ...f, enabled: !next } : f))
        );
        toast.error(result.error || labels.toggleError);
        return;
      }
      setFlags((current) =>
        current.map((f) => (f.id === flag.id ? result.data : f))
      );
      toast.success(labels.toggleSuccess);
    });
  }

  function handleCreate() {
    startCreate(async () => {
      const result = await createFeatureFlag({
        key: keyValue,
        title: titleValue,
        description: descriptionValue,
      });
      if ("error" in result) {
        toast.error(result.error || labels.createError);
        return;
      }
      setFlags((current) =>
        [...current, result.data].sort((a, b) => a.title.localeCompare(b.title))
      );
      setKeyValue("");
      setTitleValue("");
      setDescriptionValue("");
      toast.success(labels.createSuccess);
    });
  }

  const canSubmit =
    keyValue.trim().length > 0 && titleValue.trim().length > 0 && !isCreating;

  return (
    <div className="space-y-5">
      <SectionCard title={labels.create.title}>
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label
                className="text-xs"
                htmlFor="flag-key"
                style={{ color: STUDIO.ink3 }}
              >
                {labels.create.key}
              </label>
              <input
                className="rounded-xl px-3 py-2 text-sm outline-none"
                id="flag-key"
                onChange={(event) => setKeyValue(event.target.value)}
                placeholder="new_checkout"
                style={fieldStyle()}
                value={keyValue}
              />
              <span className="text-xs" style={{ color: STUDIO.ink4 }}>
                {labels.create.keyHint}
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              <label
                className="text-xs"
                htmlFor="flag-title"
                style={{ color: STUDIO.ink3 }}
              >
                {labels.create.name}
              </label>
              <input
                className="rounded-xl px-3 py-2 text-sm outline-none"
                id="flag-title"
                onChange={(event) => setTitleValue(event.target.value)}
                style={fieldStyle()}
                value={titleValue}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              className="text-xs"
              htmlFor="flag-description"
              style={{ color: STUDIO.ink3 }}
            >
              {labels.create.descriptionLabel}
            </label>
            <input
              className="rounded-xl px-3 py-2 text-sm outline-none"
              id="flag-description"
              onChange={(event) => setDescriptionValue(event.target.value)}
              style={fieldStyle()}
              value={descriptionValue}
            />
          </div>
          <div className="flex justify-end">
            <StudioButton
              className={canSubmit ? "" : "opacity-50"}
              disabled={!canSubmit}
              onClick={handleCreate}
              variant="primary"
            >
              {isCreating ? labels.create.creating : labels.create.submit}
            </StudioButton>
          </div>
        </div>
      </SectionCard>

      <div className="rounded-2xl p-6" style={studioSurface}>
        {flags.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-sm" style={{ color: STUDIO.ink2 }}>
              {labels.empty}
            </p>
            <p className="mt-1 text-xs" style={{ color: STUDIO.ink4 }}>
              {labels.emptyDescription}
            </p>
          </div>
        ) : (
          <div>
            <div
              className="flex items-center justify-between gap-4 pb-2.5 text-[11px] uppercase tracking-[0.04em]"
              style={{
                borderBottom: `0.5px solid ${STUDIO.rule}`,
                color: STUDIO.ink4,
              }}
            >
              <span>{labels.columnFlag}</span>
              <span>{labels.columnState}</span>
            </div>
            {flags.map((flag) => (
              <div
                className="flex items-center justify-between gap-4 py-3.5"
                key={flag.id}
                style={{ borderBottom: `0.5px solid ${STUDIO.rule}` }}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p
                      className="truncate text-sm"
                      style={{ color: STUDIO.ink }}
                    >
                      {flag.title}
                    </p>
                    <code
                      className="rounded px-1.5 py-0.5 text-[11px]"
                      style={{
                        background: STUDIO.paper2,
                        color: STUDIO.ink3,
                      }}
                    >
                      {flag.key}
                    </code>
                  </div>
                  {flag.description && (
                    <p
                      className="mt-0.5 truncate text-xs"
                      style={{ color: STUDIO.ink4 }}
                    >
                      {flag.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className="text-xs"
                    style={{
                      color: flag.enabled ? STUDIO.leaf : STUDIO.ink4,
                    }}
                  >
                    {flag.enabled ? labels.enabled : labels.disabled}
                  </span>
                  <Toggle
                    checked={flag.enabled}
                    disabled={pendingId === flag.id}
                    onChange={(next) => handleToggle(flag, next)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

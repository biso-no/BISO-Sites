"use client";

import type { FeatureFlagGroup } from "@repo/shared/utils/feature-flags";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { STUDIO, studioSurface } from "../../../_components/studio";
import {
  type CatalogFlagGroup,
  type CatalogFlagItem,
  setFeatureFlagByKey,
} from "../actions";

interface FeatureFlagsLabels {
  disabled: string;
  enabled: string;
  groups: Record<FeatureFlagGroup, string>;
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

function FlagRow({
  flag,
  enabledLabel,
  disabledLabel,
  pending,
  onToggle,
}: {
  flag: CatalogFlagItem;
  enabledLabel: string;
  disabledLabel: string;
  pending: boolean;
  onToggle: (next: boolean) => void;
}) {
  return (
    <div
      className="flex items-start justify-between gap-4 py-3.5"
      style={{ borderBottom: `0.5px solid ${STUDIO.rule}` }}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm" style={{ color: STUDIO.ink }}>
            {flag.title}
          </p>
          <code
            className="rounded px-1.5 py-0.5 text-[11px]"
            style={{ background: STUDIO.paper2, color: STUDIO.ink3 }}
          >
            {flag.key}
          </code>
        </div>
        <p
          className="mt-0.5 max-w-prose text-xs"
          style={{ color: STUDIO.ink4 }}
        >
          {flag.description}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span
          className="text-xs"
          style={{ color: flag.enabled ? STUDIO.leaf : STUDIO.ink4 }}
        >
          {flag.enabled ? enabledLabel : disabledLabel}
        </span>
        <Toggle checked={flag.enabled} disabled={pending} onChange={onToggle} />
      </div>
    </div>
  );
}

export function FeatureFlagsClient({
  initialGroups,
  labels,
}: {
  initialGroups: CatalogFlagGroup[];
  labels: FeatureFlagsLabels;
}) {
  const [groups, setGroups] = useState<CatalogFlagGroup[]>(initialGroups);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function applyEnabled(key: string, enabled: boolean) {
    setGroups((current) =>
      current.map((group) => ({
        ...group,
        flags: group.flags.map((flag) =>
          flag.key === key ? { ...flag, enabled } : flag
        ),
      }))
    );
  }

  function handleToggle(flag: CatalogFlagItem, next: boolean) {
    setPendingKey(flag.key);
    applyEnabled(flag.key, next); // optimistic
    startTransition(async () => {
      const result = await setFeatureFlagByKey(flag.key, next);
      setPendingKey(null);
      if ("error" in result) {
        applyEnabled(flag.key, !next); // revert
        toast.error(result.error || labels.toggleError);
        return;
      }
      applyEnabled(flag.key, result.data.enabled);
      toast.success(labels.toggleSuccess);
    });
  }

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <div
          className="rounded-2xl p-6"
          key={group.group}
          style={studioSurface}
        >
          <h3
            className="mb-2 font-medium text-sm"
            style={{ color: STUDIO.ink }}
          >
            {labels.groups[group.group]}
          </h3>
          <div>
            {group.flags.map((flag) => (
              <FlagRow
                disabledLabel={labels.disabled}
                enabledLabel={labels.enabled}
                flag={flag}
                key={flag.key}
                onToggle={(next) => handleToggle(flag, next)}
                pending={pendingKey === flag.key}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

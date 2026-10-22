"use client";

import { cn } from "@repo/ui/lib/utils";
import { Check, Copy, ExternalLink, Loader2, Sparkles } from "lucide-react";
import {
  statusPanelPrimaryAction,
  statusPanelSecondaryAction,
} from "@/components/ui/status-panel";

interface CodeRevealProps {
  copiedCode: boolean;
  copiedLabel: string;
  copyLabel: string;
  onCopy: () => void;
  value: string;
}

/** A revealed discount code, with a copy button that confirms in words. */
export function CodeReveal({
  value,
  copiedCode,
  onCopy,
  copyLabel,
  copiedLabel,
}: CodeRevealProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-biso-md border-2 border-edge border-dashed bg-surface-sunken p-4">
      <code className="type-data min-w-0 break-all text-ink text-lg">
        {value}
      </code>
      <button
        className={cn(statusPanelSecondaryAction, "shrink-0 px-4 py-2")}
        onClick={onCopy}
        type="button"
      >
        {copiedCode ? (
          <Check aria-hidden="true" className="size-4 shrink-0 text-success" />
        ) : (
          <Copy aria-hidden="true" className="size-4 shrink-0" />
        )}
        <span aria-live="polite">{copiedCode ? copiedLabel : copyLabel}</span>
      </button>
    </div>
  );
}

interface LinkRevealProps {
  label: string;
  value: string;
}

/** The partner's redemption link, opened in a new tab. */
export function LinkReveal({ value, label }: LinkRevealProps) {
  return (
    <a
      className={cn(statusPanelPrimaryAction, "w-full justify-center")}
      href={value}
      rel="noopener noreferrer"
      target="_blank"
    >
      <ExternalLink aria-hidden="true" className="size-4 shrink-0" />
      {label}
    </a>
  );
}

interface RevealButtonProps {
  isRevealing: boolean;
  onReveal: () => void;
  revealingLabel: string;
  revealLabel: string;
}

/** Records the reveal server-side, then shows the code, QR or link. */
export function RevealButton({
  isRevealing,
  onReveal,
  revealLabel,
  revealingLabel,
}: RevealButtonProps) {
  return (
    <button
      aria-busy={isRevealing}
      className={cn(
        statusPanelPrimaryAction,
        "w-full justify-center disabled:opacity-60"
      )}
      disabled={isRevealing}
      onClick={onReveal}
      type="button"
    >
      {isRevealing ? (
        <Loader2 aria-hidden="true" className="size-4 shrink-0 animate-spin" />
      ) : (
        <Sparkles aria-hidden="true" className="size-4 shrink-0" />
      )}
      {isRevealing ? revealingLabel : revealLabel}
    </button>
  );
}

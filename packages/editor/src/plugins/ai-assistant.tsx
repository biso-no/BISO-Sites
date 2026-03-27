"use client";

import type { Plugin } from "@puckeditor/core";
import { usePuck } from "@puckeditor/core";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import {
  Sparkles,
  Wand2,
  PenLine,
  Type,
  FileText,
  MousePointerClick,
  SpellCheck,
  Languages,
  Lightbulb,
  Loader2,
  Copy,
  Check,
  X,
} from "lucide-react";
import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import {
  useAiAssistant,
  type AssistAction,
} from "../contexts/ai-assistant-context";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LoadingKey =
  | "generate"
  | "improve-rewrite"
  | "improve-engaging"
  | "improve-simplify"
  | "copy-headline"
  | "copy-description"
  | "copy-cta"
  | "action-grammar"
  | "action-translate-en"
  | "action-translate-no"
  | "action-suggest";

type AssistResult = {
  key: string;
  text: string;
  isStreaming: boolean;
};

// ---------------------------------------------------------------------------
// Helpers – extract readable text from Puck block props
// ---------------------------------------------------------------------------

function extractBlockText(props: Record<string, unknown>): string {
  const texts: string[] = [];
  function walk(val: unknown) {
    if (typeof val === "string" && val.trim().length > 0) texts.push(val.trim());
    else if (Array.isArray(val)) val.forEach(walk);
    else if (val && typeof val === "object") {
      for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
        if (k === "id" || k === "href" || k === "image") continue;
        walk(v);
      }
    }
  }
  const { id, image, backgroundImage, ...rest } = props as Record<string, unknown>;
  walk(rest);
  return texts.join("\n");
}

function extractPageSummary(
  content: { type: string; props: Record<string, unknown> }[]
): string {
  if (content.length === 0) return "Empty page — no blocks yet.";
  const lines = content.map((block, i) => {
    const p = block.props as Record<string, unknown>;
    const title =
      typeof p.title === "string"
        ? p.title
        : typeof p.text === "string"
          ? p.text
          : "";
    const sub =
      typeof p.subtitle === "string"
        ? p.subtitle
        : typeof p.description === "string"
          ? String(p.description).slice(0, 60)
          : "";
    return `${i + 1}. ${block.type}${title ? `: "${title}"` : ""}${sub ? ` — ${sub}` : ""}`;
  });
  return `Page has ${content.length} block(s):\n${lines.join("\n")}`;
}

// ---------------------------------------------------------------------------
// StreamingTextResult — shows live-streaming text with copy button
// ---------------------------------------------------------------------------

function StreamingTextResult({
  result,
  onDismiss,
}: {
  result: AssistResult;
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(result.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [result.text]);

  return (
    <div className="mt-2 rounded-md border border-border bg-muted/40 p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="whitespace-pre-wrap leading-relaxed text-foreground flex-1">
          {result.text}
          {result.isStreaming && (
            <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-primary align-middle" />
          )}
        </p>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          <X size={14} />
        </button>
      </div>
      {!result.isStreaming && result.text.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 h-7 gap-1 text-xs"
          onClick={handleCopy}
        >
          {copied ? (
            <Check size={12} className="text-green-500" />
          ) : (
            <Copy size={12} />
          )}
          {copied ? "Copied" : "Copy"}
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ActionButton — shared button with loading spinner
// ---------------------------------------------------------------------------

function ActionButton({
  icon: Icon,
  label,
  loadingKey,
  activeLoading,
  onClick,
  variant = "outline",
  className = "",
  disabled = false,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  loadingKey: LoadingKey;
  activeLoading: LoadingKey | null;
  onClick: (key: LoadingKey) => void;
  variant?: "outline" | "default" | "secondary" | "ghost";
  className?: string;
  disabled?: boolean;
}) {
  const isLoading = activeLoading === loadingKey;
  const isDisabled = disabled || activeLoading !== null;

  return (
    <Button
      variant={variant}
      size="sm"
      className={`justify-start ${className}`}
      disabled={isDisabled}
      onClick={() => onClick(loadingKey)}
    >
      {isLoading ? (
        <Loader2 size={14} className="mr-2 animate-spin" />
      ) : (
        <Icon size={14} className="mr-2" />
      )}
      {label}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// CopyGenerator — expandable input + generate button
// ---------------------------------------------------------------------------

function CopyGenerator({
  label,
  placeholder,
  loadingKey,
  activeLoading,
  onGenerate,
  result,
  onDismissResult,
}: {
  label: string;
  placeholder: string;
  loadingKey: LoadingKey;
  activeLoading: LoadingKey | null;
  onGenerate: (key: LoadingKey, context: string) => void;
  result: AssistResult | null;
  onDismissResult: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [context, setContext] = useState("");
  const isLoading = activeLoading === loadingKey;
  const isDisabled = activeLoading !== null;
  const showResult = result?.key === loadingKey;

  if (!expanded && !showResult) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="justify-start"
        disabled={isDisabled}
        onClick={() => setExpanded(true)}
      >
        <PenLine size={14} className="mr-2" />
        {label}
      </Button>
    );
  }

  return (
    <div className="space-y-2 rounded-md border border-border p-2">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {expanded && (
        <>
          <Input
            placeholder={placeholder}
            value={context}
            onChange={(e) => setContext(e.target.value)}
            className="h-8 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" && context.trim()) {
                onGenerate(loadingKey, context);
                setExpanded(false);
                setContext("");
              }
            }}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              className="h-7 text-xs"
              disabled={isDisabled || !context.trim()}
              onClick={() => {
                onGenerate(loadingKey, context);
                setExpanded(false);
                setContext("");
              }}
            >
              {isLoading ? (
                <Loader2 size={12} className="mr-1 animate-spin" />
              ) : (
                <Sparkles size={12} className="mr-1" />
              )}
              Generate
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                setExpanded(false);
                setContext("");
              }}
            >
              Cancel
            </Button>
          </div>
        </>
      )}
      {showResult && result && (
        <StreamingTextResult
          result={result}
          onDismiss={() => {
            onDismissResult();
            setExpanded(false);
          }}
        />
      )}
      {showResult && !expanded && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-full text-xs"
          disabled={isDisabled}
          onClick={() => setExpanded(true)}
        >
          Regenerate
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

function AiAssistantPanel() {
  const { selectedItem, appState, dispatch } = usePuck();
  const ai = useAiAssistant();

  const [prompt, setPrompt] = useState("");
  const [activeLoading, setActiveLoading] = useState<LoadingKey | null>(null);
  const [assistResult, setAssistResult] = useState<AssistResult | null>(null);

  // Register Puck's dispatch with the context so that AI-generated data patches
  // are applied directly to the canvas via dispatch({ type: "setData" }).
  // Puck's `data` prop is initialization-only — this is the only correct update path.
  useEffect(() => {
    if (!ai) return;
    ai.onDataReady((newData) => {
      dispatch({ type: "setData", data: newData });
    });
    return () => {
      ai.onDataReady(null);
    };
  }, [ai, dispatch]);

  // Derive selected block index from Puck state
  const selectedIndex =
    selectedItem != null
      ? appState.data.content.findIndex(
          (b) => b.props.id === selectedItem.props.id
        )
      : -1;
  const effectiveSelectedIndex = selectedIndex >= 0 ? selectedIndex : undefined;

  // Clear result if a different action starts
  const startLoading = useCallback((key: LoadingKey) => {
    setActiveLoading(key);
    setAssistResult(null);
  }, []);

  // Clear loading when canvas streaming ends (for generate actions)
  useEffect(() => {
    if (!ai?.isStreaming && (activeLoading === "generate" || activeLoading === "improve-rewrite" || activeLoading === "improve-engaging" || activeLoading === "improve-simplify")) {
      setActiveLoading(null);
    }
  }, [ai?.isStreaming, activeLoading]);

  // ------------------------------------------------------------------
  // Generate full page
  // ------------------------------------------------------------------
  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      toast.warning("Please describe the page you want to generate.");
      return;
    }
    if (!ai) {
      toast.error("AI assistant not connected.");
      return;
    }
    startLoading("generate");
    await ai.generate(prompt.trim());
    // activeLoading cleared by useEffect above when isStreaming → false
  }, [prompt, ai, startLoading]);

  // ------------------------------------------------------------------
  // Improve selected block
  // ------------------------------------------------------------------
  const handleImproveBlock = useCallback(
    async (key: LoadingKey) => {
      if (!ai) {
        toast.error("AI assistant not connected.");
        return;
      }
      if (!selectedItem) {
        toast.warning("Select a block on the canvas first.");
        return;
      }
      if (effectiveSelectedIndex === undefined) {
        toast.warning("Improvement of nested blocks is not yet supported.");
        return;
      }

      const instruction: Record<LoadingKey, string> = {
        "improve-rewrite":
          "Rewrite the copy to be more professional and polished. Keep the same structure.",
        "improve-engaging":
          "Rewrite the copy to be more dynamic, energetic, and compelling.",
        "improve-simplify":
          "Simplify the text — use shorter sentences and plainer language.",
        generate: "",
        "copy-headline": "",
        "copy-description": "",
        "copy-cta": "",
        "action-grammar": "",
        "action-translate-en": "",
        "action-translate-no": "",
        "action-suggest": "",
      };

      const blockText = extractBlockText(selectedItem.props as Record<string, unknown>);
      const blockJson = JSON.stringify(selectedItem.props, null, 2);

      const generationPrompt = [
        instruction[key],
        `\nBlock type: ${selectedItem.type}`,
        `Block index: ${effectiveSelectedIndex}`,
        `Current text content:\n${blockText}`,
        `Full block props:\n${blockJson}`,
        `\nOutput a single JSONL patch that replaces block at index ${effectiveSelectedIndex} with the improved version.`,
        "Preserve the block type and all non-text props (images, links, layout settings, etc.).",
      ].join("\n");

      startLoading(key);
      await ai.generate(generationPrompt, effectiveSelectedIndex);
      // activeLoading cleared by useEffect
    },
    [ai, selectedItem, effectiveSelectedIndex, startLoading]
  );

  // ------------------------------------------------------------------
  // Generate copy (headline / description / CTA)
  // ------------------------------------------------------------------
  const actionForKey: Record<string, AssistAction> = {
    "copy-headline": "headline",
    "copy-description": "description",
    "copy-cta": "cta",
    "action-grammar": "grammar",
    "action-translate-en": "translate-en",
    "action-translate-no": "translate-no",
    "action-suggest": "suggest",
  };

  const handleCopyGenerate = useCallback(
    async (key: LoadingKey, context: string) => {
      if (!ai) {
        toast.error("AI assistant not connected.");
        return;
      }
      if (!context.trim()) return;
      startLoading(key);
      setAssistResult({ key, text: "", isStreaming: true });

      await ai.assist(actionForKey[key] as AssistAction, context.trim(), {
        onToken: (token) =>
          setAssistResult((prev) =>
            prev ? { ...prev, text: prev.text + token } : null
          ),
        onComplete: () => {
          setAssistResult((prev) =>
            prev ? { ...prev, isStreaming: false } : null
          );
          setActiveLoading(null);
        },
        onError: (err) => {
          toast.error(`Copy generation failed: ${err.message}`);
          setAssistResult(null);
          setActiveLoading(null);
        },
      });
    },
    [ai, startLoading]
  );

  // ------------------------------------------------------------------
  // Quick actions (grammar, translate, suggest)
  // ------------------------------------------------------------------
  const handleQuickAction = useCallback(
    async (key: LoadingKey) => {
      if (!ai) {
        toast.error("AI assistant not connected.");
        return;
      }

      let content = "";

      if (key === "action-suggest") {
        content = extractPageSummary(
          appState.data.content as { type: string; props: Record<string, unknown> }[]
        );
      } else if (
        key === "action-grammar" ||
        key === "action-translate-en" ||
        key === "action-translate-no"
      ) {
        if (!selectedItem) {
          toast.warning("Select a block on the canvas first.");
          return;
        }
        content = extractBlockText(selectedItem.props as Record<string, unknown>);
        if (!content.trim()) {
          toast.warning("Selected block has no readable text.");
          return;
        }
      }

      startLoading(key);
      setAssistResult({ key, text: "", isStreaming: true });

      await ai.assist(actionForKey[key] as AssistAction, content, {
        onToken: (token) =>
          setAssistResult((prev) =>
            prev ? { ...prev, text: prev.text + token } : null
          ),
        onComplete: () => {
          setAssistResult((prev) =>
            prev ? { ...prev, isStreaming: false } : null
          );
          setActiveLoading(null);
        },
        onError: (err) => {
          toast.error(`Action failed: ${err.message}`);
          setAssistResult(null);
          setActiveLoading(null);
        },
      });
    },
    [ai, appState.data.content, selectedItem, startLoading]
  );

  const selectedBlockType = selectedItem?.type ?? null;
  const isAnyRunning = activeLoading !== null;
  const quickActionResult =
    assistResult?.key?.startsWith("action-") ? assistResult : null;

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  if (!ai) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        AI assistant is not available in this context.
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 font-semibold text-foreground text-lg">
          <Sparkles size={18} className="text-primary" />
          AI Assistant
        </div>
        <p className="text-muted-foreground text-sm">
          Generate and improve content with AI.
        </p>
      </div>

      {/* ── Section: Generate Page ── */}
      <section className="space-y-3">
        <h3 className="font-medium text-foreground text-sm">Generate Page</h3>
        <Textarea
          placeholder="Describe the page you want to create, e.g. 'A landing page for our spring career fair with event details, schedule, and sign-up CTA'"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          className="text-sm"
        />
        <Button
          size="sm"
          disabled={isAnyRunning || !prompt.trim()}
          onClick={handleGenerate}
        >
          {activeLoading === "generate" ? (
            <Loader2 size={14} className="mr-2 animate-spin" />
          ) : (
            <Wand2 size={14} className="mr-2" />
          )}
          Generate full page
        </Button>
        {activeLoading === "generate" && (
          <p className="animate-pulse text-xs text-muted-foreground">
            Generating page…
          </p>
        )}
      </section>

      {/* ── Section: Improve Block ── */}
      <section className="space-y-3">
        <h3 className="font-medium text-foreground text-sm">Improve Block</h3>
        {selectedBlockType ? (
          <>
            <p className="text-xs text-muted-foreground">
              Selected:{" "}
              <span className="font-medium text-foreground">
                {selectedBlockType}
              </span>
              {effectiveSelectedIndex === undefined && (
                <span className="ml-1 text-yellow-600">(nested — limited support)</span>
              )}
            </p>
            <div className="flex flex-col gap-2">
              <ActionButton
                icon={PenLine}
                label="Rewrite copy"
                loadingKey="improve-rewrite"
                activeLoading={activeLoading}
                onClick={handleImproveBlock}
              />
              <ActionButton
                icon={Sparkles}
                label="Make more engaging"
                loadingKey="improve-engaging"
                activeLoading={activeLoading}
                onClick={handleImproveBlock}
              />
              <ActionButton
                icon={Type}
                label="Simplify text"
                loadingKey="improve-simplify"
                activeLoading={activeLoading}
                onClick={handleImproveBlock}
              />
            </div>
            {(activeLoading === "improve-rewrite" ||
              activeLoading === "improve-engaging" ||
              activeLoading === "improve-simplify") && (
              <p className="animate-pulse text-xs text-muted-foreground">
                Rewriting block on canvas…
              </p>
            )}
          </>
        ) : (
          <Card className="p-3">
            <p className="text-xs text-muted-foreground text-center">
              Select a block on the canvas to see improvement options.
            </p>
          </Card>
        )}
      </section>

      {/* ── Section: Generate Copy ── */}
      <section className="space-y-3">
        <h3 className="font-medium text-foreground text-sm">Generate Copy</h3>
        <div className="flex flex-col gap-2">
          <CopyGenerator
            label="Write a headline"
            placeholder="Topic or context for the headline…"
            loadingKey="copy-headline"
            activeLoading={activeLoading}
            onGenerate={handleCopyGenerate}
            result={assistResult?.key === "copy-headline" ? assistResult : null}
            onDismissResult={() => setAssistResult(null)}
          />
          <CopyGenerator
            label="Write a description"
            placeholder="What should the description be about…"
            loadingKey="copy-description"
            activeLoading={activeLoading}
            onGenerate={handleCopyGenerate}
            result={
              assistResult?.key === "copy-description" ? assistResult : null
            }
            onDismissResult={() => setAssistResult(null)}
          />
          <CopyGenerator
            label="Write CTA text"
            placeholder="What action should the user take…"
            loadingKey="copy-cta"
            activeLoading={activeLoading}
            onGenerate={handleCopyGenerate}
            result={assistResult?.key === "copy-cta" ? assistResult : null}
            onDismissResult={() => setAssistResult(null)}
          />
        </div>
      </section>

      {/* ── Section: Quick Actions ── */}
      <section className="space-y-3">
        <h3 className="font-medium text-foreground text-sm">Quick Actions</h3>
        <div className="flex flex-col gap-2">
          <ActionButton
            icon={SpellCheck}
            label="Check grammar & spelling"
            loadingKey="action-grammar"
            activeLoading={activeLoading}
            onClick={handleQuickAction}
          />
          <ActionButton
            icon={Languages}
            label="Translate to English"
            loadingKey="action-translate-en"
            activeLoading={activeLoading}
            onClick={handleQuickAction}
          />
          <ActionButton
            icon={Languages}
            label="Translate to Norwegian"
            loadingKey="action-translate-no"
            activeLoading={activeLoading}
            onClick={handleQuickAction}
          />
          <ActionButton
            icon={Lightbulb}
            label="Suggest improvements"
            loadingKey="action-suggest"
            activeLoading={activeLoading}
            onClick={handleQuickAction}
          />
        </div>
        {quickActionResult && (
          <StreamingTextResult
            result={quickActionResult}
            onDismiss={() => setAssistResult(null)}
          />
        )}
        {(activeLoading === "action-grammar" ||
          activeLoading === "action-translate-en" ||
          activeLoading === "action-translate-no" ||
          activeLoading === "action-suggest") &&
          !quickActionResult?.text && (
            <p className="animate-pulse text-xs text-muted-foreground">
              Working…
            </p>
          )}
        <p className="text-xs text-muted-foreground">
          Grammar, translate, and suggest operate on the selected block.
          Suggestions analyse the full page.
        </p>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Plugin export
// ---------------------------------------------------------------------------

export const aiAssistantPlugin: Plugin = {
  name: "ai-assistant",
  label: "AI Assistant",
  icon: <Sparkles size={18} />,
  render: () => <AiAssistantPanel />,
};

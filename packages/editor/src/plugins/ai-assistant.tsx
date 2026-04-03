"use client";

import type { Plugin } from "@puckeditor/core";
import { createUsePuck, useGetPuck } from "@puckeditor/core";

const usePuck = createUsePuck();

import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { Textarea } from "@repo/ui/components/ui/textarea";
import {
  Check,
  Copy,
  Languages,
  Lightbulb,
  Loader2,
  PenLine,
  Sparkles,
  SpellCheck,
  Type,
  Wand2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  type AssistAction,
  useAiAssistant,
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
    if (typeof val === "string" && val.trim().length > 0) {
      texts.push(val.trim());
    } else if (Array.isArray(val)) {
      val.forEach(walk);
    } else if (val && typeof val === "object") {
      for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
        if (k === "id" || k === "href" || k === "image") {
          continue;
        }
        walk(v);
      }
    }
  }
  const { id, image, backgroundImage, ...rest } = props as Record<
    string,
    unknown
  >;
  walk(rest);
  return texts.join("\n");
}

function extractPageSummary(
  content: { type: string; props: Record<string, unknown> }[]
): string {
  if (content.length === 0) {
    return "Empty page — no blocks yet.";
  }
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
        <p className="flex-1 whitespace-pre-wrap text-foreground leading-relaxed">
          {result.text}
          {result.isStreaming && (
            <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-primary align-middle" />
          )}
        </p>
        <button
          className="shrink-0 text-muted-foreground hover:text-foreground"
          onClick={onDismiss}
          type="button"
        >
          <X size={14} />
        </button>
      </div>
      {!result.isStreaming && result.text.length > 0 && (
        <Button
          className="mt-2 h-7 gap-1 text-xs"
          onClick={handleCopy}
          size="sm"
          variant="ghost"
        >
          {copied ? (
            <Check className="text-green-500" size={12} />
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
      className={`justify-start ${className}`}
      disabled={isDisabled}
      onClick={() => onClick(loadingKey)}
      size="sm"
      variant={variant}
    >
      {isLoading ? (
        <Loader2 className="mr-2 animate-spin" size={14} />
      ) : (
        <Icon className="mr-2" size={14} />
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

  if (!(expanded || showResult)) {
    return (
      <Button
        className="justify-start"
        disabled={isDisabled}
        onClick={() => setExpanded(true)}
        size="sm"
        variant="outline"
      >
        <PenLine className="mr-2" size={14} />
        {label}
      </Button>
    );
  }

  return (
    <div className="space-y-2 rounded-md border border-border p-2">
      <Label className="text-muted-foreground text-xs">{label}</Label>
      {expanded && (
        <>
          <Input
            className="h-8 text-sm"
            onChange={(e) => setContext(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && context.trim()) {
                onGenerate(loadingKey, context);
                setExpanded(false);
                setContext("");
              }
            }}
            placeholder={placeholder}
            value={context}
          />
          <div className="flex gap-2">
            <Button
              className="h-7 text-xs"
              disabled={isDisabled || !context.trim()}
              onClick={() => {
                onGenerate(loadingKey, context);
                setExpanded(false);
                setContext("");
              }}
              size="sm"
            >
              {isLoading ? (
                <Loader2 className="mr-1 animate-spin" size={12} />
              ) : (
                <Sparkles className="mr-1" size={12} />
              )}
              Generate
            </Button>
            <Button
              className="h-7 text-xs"
              onClick={() => {
                setExpanded(false);
                setContext("");
              }}
              size="sm"
              variant="ghost"
            >
              Cancel
            </Button>
          </div>
        </>
      )}
      {showResult && result && (
        <StreamingTextResult
          onDismiss={() => {
            onDismissResult();
            setExpanded(false);
          }}
          result={result}
        />
      )}
      {showResult && !expanded && (
        <Button
          className="h-7 w-full text-xs"
          disabled={isDisabled}
          onClick={() => setExpanded(true)}
          size="sm"
          variant="ghost"
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
  // Granular selectors — re-render only when the specific slice changes.
  const selectedItem = usePuck((s) => s.selectedItem);
  const content = usePuck((s) => s.appState.data.content);
  const getPuck = useGetPuck();
  const ai = useAiAssistant();

  const [prompt, setPrompt] = useState("");
  const [activeLoading, setActiveLoading] = useState<LoadingKey | null>(null);
  const [assistResult, setAssistResult] = useState<AssistResult | null>(null);

  // Register Puck's dispatch with the context so that AI-generated data patches
  // are applied directly to the canvas via dispatch({ type: "setData" }).
  // Puck's `data` prop is initialization-only — this is the only correct update path.
  useEffect(() => {
    if (!ai) {
      return;
    }
    ai.onDataReady((newData) => {
      const { dispatch } = getPuck();
      dispatch({ type: "setData", data: newData });
    });
    return () => {
      ai.onDataReady(null);
    };
  }, [ai, getPuck]);

  // Derive selected block index for the "nested block" warning in the JSX.
  const selectedIndex =
    selectedItem == null
      ? -1
      : content.findIndex((b) => b.props.id === selectedItem.props.id);
  const effectiveSelectedIndex = selectedIndex >= 0 ? selectedIndex : undefined;

  // Clear result if a different action starts
  const startLoading = useCallback((key: LoadingKey) => {
    setActiveLoading(key);
    setAssistResult(null);
  }, []);

  // Clear loading when canvas streaming ends (for generate actions)
  useEffect(() => {
    if (
      !ai?.isStreaming &&
      (activeLoading === "generate" ||
        activeLoading === "improve-rewrite" ||
        activeLoading === "improve-engaging" ||
        activeLoading === "improve-simplify")
    ) {
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

      // Read selected item and content at call time to avoid stale closure issues.
      const { selectedItem: currentSelectedItem, appState } = getPuck();
      if (!currentSelectedItem) {
        toast.warning("Select a block on the canvas first.");
        return;
      }
      const selectedIndex = appState.data.content.findIndex(
        (b) => b.props.id === currentSelectedItem.props.id
      );
      const effectiveSelectedIndex =
        selectedIndex >= 0 ? selectedIndex : undefined;
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

      const blockText = extractBlockText(
        currentSelectedItem.props as Record<string, unknown>
      );
      const blockJson = JSON.stringify(currentSelectedItem.props, null, 2);

      const generationPrompt = [
        instruction[key],
        `\nBlock type: ${currentSelectedItem.type}`,
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
    [ai, getPuck, startLoading]
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
      if (!context.trim()) {
        return;
      }
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

      // Read current Puck state at call time to avoid stale closure issues.
      const { appState, selectedItem: currentSelectedItem } = getPuck();
      let content = "";

      if (key === "action-suggest") {
        content = extractPageSummary(
          appState.data.content as {
            type: string;
            props: Record<string, unknown>;
          }[]
        );
      } else if (
        key === "action-grammar" ||
        key === "action-translate-en" ||
        key === "action-translate-no"
      ) {
        if (!currentSelectedItem) {
          toast.warning("Select a block on the canvas first.");
          return;
        }
        content = extractBlockText(
          currentSelectedItem.props as Record<string, unknown>
        );
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
    [ai, getPuck, startLoading]
  );

  const selectedBlockType = selectedItem?.type ?? null;
  const isAnyRunning = activeLoading !== null;
  const quickActionResult = assistResult?.key?.startsWith("action-")
    ? assistResult
    : null;

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  if (!ai) {
    return (
      <div className="p-4 text-center text-muted-foreground text-sm">
        AI assistant is not available in this context.
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 font-semibold text-foreground text-lg">
          <Sparkles className="text-primary" size={18} />
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
          className="text-sm"
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the page you want to create, e.g. 'A landing page for our spring career fair with event details, schedule, and sign-up CTA'"
          rows={3}
          value={prompt}
        />
        <Button
          disabled={isAnyRunning || !prompt.trim()}
          onClick={handleGenerate}
          size="sm"
        >
          {activeLoading === "generate" ? (
            <Loader2 className="mr-2 animate-spin" size={14} />
          ) : (
            <Wand2 className="mr-2" size={14} />
          )}
          Generate full page
        </Button>
        {activeLoading === "generate" && (
          <p className="animate-pulse text-muted-foreground text-xs">
            Generating page…
          </p>
        )}
      </section>

      {/* ── Section: Improve Block ── */}
      <section className="space-y-3">
        <h3 className="font-medium text-foreground text-sm">Improve Block</h3>
        {selectedBlockType ? (
          <>
            <p className="text-muted-foreground text-xs">
              Selected:{" "}
              <span className="font-medium text-foreground">
                {selectedBlockType}
              </span>
              {effectiveSelectedIndex === undefined && (
                <span className="ml-1 text-yellow-600">
                  (nested — limited support)
                </span>
              )}
            </p>
            <div className="flex flex-col gap-2">
              <ActionButton
                activeLoading={activeLoading}
                icon={PenLine}
                label="Rewrite copy"
                loadingKey="improve-rewrite"
                onClick={handleImproveBlock}
              />
              <ActionButton
                activeLoading={activeLoading}
                icon={Sparkles}
                label="Make more engaging"
                loadingKey="improve-engaging"
                onClick={handleImproveBlock}
              />
              <ActionButton
                activeLoading={activeLoading}
                icon={Type}
                label="Simplify text"
                loadingKey="improve-simplify"
                onClick={handleImproveBlock}
              />
            </div>
            {(activeLoading === "improve-rewrite" ||
              activeLoading === "improve-engaging" ||
              activeLoading === "improve-simplify") && (
              <p className="animate-pulse text-muted-foreground text-xs">
                Rewriting block on canvas…
              </p>
            )}
          </>
        ) : (
          <Card className="p-3">
            <p className="text-center text-muted-foreground text-xs">
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
            activeLoading={activeLoading}
            label="Write a headline"
            loadingKey="copy-headline"
            onDismissResult={() => setAssistResult(null)}
            onGenerate={handleCopyGenerate}
            placeholder="Topic or context for the headline…"
            result={assistResult?.key === "copy-headline" ? assistResult : null}
          />
          <CopyGenerator
            activeLoading={activeLoading}
            label="Write a description"
            loadingKey="copy-description"
            onDismissResult={() => setAssistResult(null)}
            onGenerate={handleCopyGenerate}
            placeholder="What should the description be about…"
            result={
              assistResult?.key === "copy-description" ? assistResult : null
            }
          />
          <CopyGenerator
            activeLoading={activeLoading}
            label="Write CTA text"
            loadingKey="copy-cta"
            onDismissResult={() => setAssistResult(null)}
            onGenerate={handleCopyGenerate}
            placeholder="What action should the user take…"
            result={assistResult?.key === "copy-cta" ? assistResult : null}
          />
        </div>
      </section>

      {/* ── Section: Quick Actions ── */}
      <section className="space-y-3">
        <h3 className="font-medium text-foreground text-sm">Quick Actions</h3>
        <div className="flex flex-col gap-2">
          <ActionButton
            activeLoading={activeLoading}
            icon={SpellCheck}
            label="Check grammar & spelling"
            loadingKey="action-grammar"
            onClick={handleQuickAction}
          />
          <ActionButton
            activeLoading={activeLoading}
            icon={Languages}
            label="Translate to English"
            loadingKey="action-translate-en"
            onClick={handleQuickAction}
          />
          <ActionButton
            activeLoading={activeLoading}
            icon={Languages}
            label="Translate to Norwegian"
            loadingKey="action-translate-no"
            onClick={handleQuickAction}
          />
          <ActionButton
            activeLoading={activeLoading}
            icon={Lightbulb}
            label="Suggest improvements"
            loadingKey="action-suggest"
            onClick={handleQuickAction}
          />
        </div>
        {quickActionResult && (
          <StreamingTextResult
            onDismiss={() => setAssistResult(null)}
            result={quickActionResult}
          />
        )}
        {(activeLoading === "action-grammar" ||
          activeLoading === "action-translate-en" ||
          activeLoading === "action-translate-no" ||
          activeLoading === "action-suggest") &&
          !quickActionResult?.text && (
            <p className="animate-pulse text-muted-foreground text-xs">
              Working…
            </p>
          )}
        <p className="text-muted-foreground text-xs">
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

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
} from "lucide-react";
import { useState, useCallback } from "react";
import { toast } from "sonner";

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

function ActionButton({
  icon: Icon,
  label,
  loadingKey,
  activeLoading,
  onClick,
  variant = "outline",
  className = "",
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  loadingKey: LoadingKey;
  activeLoading: LoadingKey | null;
  onClick: (key: LoadingKey) => void;
  variant?: "outline" | "default" | "secondary" | "ghost";
  className?: string;
}) {
  const isLoading = activeLoading === loadingKey;
  const isDisabled = activeLoading !== null;

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

function CopyGenerator({
  label,
  placeholder,
  loadingKey,
  activeLoading,
  onGenerate,
}: {
  label: string;
  placeholder: string;
  loadingKey: LoadingKey;
  activeLoading: LoadingKey | null;
  onGenerate: (key: LoadingKey, context: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [context, setContext] = useState("");
  const isLoading = activeLoading === loadingKey;
  const isDisabled = activeLoading !== null;

  if (!expanded) {
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
      <Input
        placeholder={placeholder}
        value={context}
        onChange={(e) => setContext(e.target.value)}
        className="h-8 text-sm"
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          className="h-7 text-xs"
          disabled={isDisabled}
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
    </div>
  );
}

function AiAssistantPanel() {
  const { selectedItem } = usePuck();
  const [prompt, setPrompt] = useState("");
  const [activeLoading, setActiveLoading] = useState<LoadingKey | null>(null);

  const simulateAction = useCallback(
    (key: LoadingKey, message?: string) => {
      setActiveLoading(key);
      setTimeout(() => {
        setActiveLoading(null);
        toast.info(message ?? "Feature coming soon — AI integration pending.");
      }, 800);
    },
    []
  );

  const handleGenerate = useCallback(() => {
    if (!prompt.trim()) {
      toast.warning("Please describe the page you want to generate.");
      return;
    }
    simulateAction("generate", `Generate page: "${prompt.trim().slice(0, 60)}…" — AI integration pending.`);
  }, [prompt, simulateAction]);

  const handleCopyGenerate = useCallback(
    (key: LoadingKey, _context: string) => {
      simulateAction(key);
    },
    [simulateAction]
  );

  const selectedBlockType = selectedItem?.type ?? null;

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

      {/* Section: Generate Page */}
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
          disabled={activeLoading !== null}
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
          <p className="text-xs text-muted-foreground animate-pulse">
            Generating…
          </p>
        )}
      </section>

      {/* Section: Improve Block */}
      <section className="space-y-3">
        <h3 className="font-medium text-foreground text-sm">Improve Block</h3>
        {selectedBlockType ? (
          <>
            <p className="text-xs text-muted-foreground">
              Selected:{" "}
              <span className="font-medium text-foreground">
                {selectedBlockType}
              </span>
            </p>
            <div className="flex flex-col gap-2">
              <ActionButton
                icon={PenLine}
                label="Rewrite copy"
                loadingKey="improve-rewrite"
                activeLoading={activeLoading}
                onClick={simulateAction}
              />
              <ActionButton
                icon={Sparkles}
                label="Make more engaging"
                loadingKey="improve-engaging"
                activeLoading={activeLoading}
                onClick={simulateAction}
              />
              <ActionButton
                icon={Type}
                label="Simplify text"
                loadingKey="improve-simplify"
                activeLoading={activeLoading}
                onClick={simulateAction}
              />
            </div>
          </>
        ) : (
          <Card className="p-3">
            <p className="text-xs text-muted-foreground text-center">
              Select a block on the canvas to see improvement options.
            </p>
          </Card>
        )}
      </section>

      {/* Section: Generate Copy */}
      <section className="space-y-3">
        <h3 className="font-medium text-foreground text-sm">Generate Copy</h3>
        <div className="flex flex-col gap-2">
          <CopyGenerator
            label="Write a headline"
            placeholder="Topic or context for the headline…"
            loadingKey="copy-headline"
            activeLoading={activeLoading}
            onGenerate={handleCopyGenerate}
          />
          <CopyGenerator
            label="Write a description"
            placeholder="What should the description be about…"
            loadingKey="copy-description"
            activeLoading={activeLoading}
            onGenerate={handleCopyGenerate}
          />
          <CopyGenerator
            label="Write CTA text"
            placeholder="What action should the user take…"
            loadingKey="copy-cta"
            activeLoading={activeLoading}
            onGenerate={handleCopyGenerate}
          />
        </div>
      </section>

      {/* Section: Quick Actions */}
      <section className="space-y-3">
        <h3 className="font-medium text-foreground text-sm">Quick Actions</h3>
        <div className="flex flex-col gap-2">
          <ActionButton
            icon={SpellCheck}
            label="Check grammar & spelling"
            loadingKey="action-grammar"
            activeLoading={activeLoading}
            onClick={simulateAction}
          />
          <ActionButton
            icon={Languages}
            label="Translate to English"
            loadingKey="action-translate-en"
            activeLoading={activeLoading}
            onClick={simulateAction}
          />
          <ActionButton
            icon={Languages}
            label="Translate to Norwegian"
            loadingKey="action-translate-no"
            activeLoading={activeLoading}
            onClick={simulateAction}
          />
          <ActionButton
            icon={Lightbulb}
            label="Suggest improvements"
            loadingKey="action-suggest"
            activeLoading={activeLoading}
            onClick={simulateAction}
          />
        </div>
      </section>
    </div>
  );
}

export const aiAssistantPlugin: Plugin = {
  name: "ai-assistant",
  label: "AI Assistant",
  icon: <Sparkles size={18} />,
  render: () => <AiAssistantPanel />,
};

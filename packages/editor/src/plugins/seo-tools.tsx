"use client";

import type { Plugin } from "@puckeditor/core";
import { usePuck } from "@puckeditor/core";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { Textarea } from "@repo/ui/components/ui/textarea";
import {
  Search,
  Share2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Globe,
  Type,
  Image as ImageIcon,
  Sparkles,
  Loader2,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

type CheckStatus = "pass" | "warn" | "fail";

interface SeoCheck {
  label: string;
  status: CheckStatus;
  message: string;
}

function CharCounter({
  label,
  value,
  min,
  max,
}: {
  label: string;
  value: string;
  min: number;
  max: number;
}) {
  const len = value.length;
  const color =
    len === 0
      ? "text-muted-foreground"
      : len >= min && len <= max
        ? "text-green-600"
        : len < min
          ? "text-yellow-600"
          : "text-red-600";

  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={color}>
        {len} / {min}-{max}
      </span>
    </div>
  );
}

function StatusIndicator({ status }: { status: CheckStatus }) {
  if (status === "pass") {
    return <CheckCircle2 size={16} className="shrink-0 text-green-600" />;
  }
  if (status === "warn") {
    return <AlertTriangle size={16} className="shrink-0 text-yellow-600" />;
  }
  return <XCircle size={16} className="shrink-0 text-red-600" />;
}

function GooglePreview({
  title,
  description,
  slug,
}: {
  title: string;
  description: string;
  slug: string;
}) {
  const displayUrl = `example.com${slug ? `/${slug}` : ""}`;
  const truncatedTitle =
    title.length > 60 ? `${title.slice(0, 57)}...` : title;
  const truncatedDesc =
    description.length > 160
      ? `${description.slice(0, 157)}...`
      : description;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Search size={14} />
        Google Search Preview
      </div>
      <div className="rounded-lg border border-border bg-white p-4 dark:bg-zinc-900">
        <div className="space-y-1">
          <div className="text-xs text-green-700 dark:text-green-500">
            {displayUrl}
          </div>
          <div className="text-lg leading-snug text-blue-700 dark:text-blue-400">
            {truncatedTitle || (
              <span className="italic text-muted-foreground">
                No title set
              </span>
            )}
          </div>
          <div className="text-sm leading-relaxed text-muted-foreground">
            {truncatedDesc || (
              <span className="italic">No description set</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SocialPreview({
  title,
  description,
  ogImage,
}: {
  title: string;
  description: string;
  ogImage: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Share2 size={14} />
        Social Media Preview
      </div>
      <div className="overflow-hidden rounded-lg border border-border">
        <div className="flex h-40 items-center justify-center bg-muted">
          {ogImage ? (
            <img
              src={ogImage}
              alt="Social preview"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center gap-1 text-muted-foreground">
              <ImageIcon size={24} />
              <span className="text-xs">No OG image set</span>
            </div>
          )}
        </div>
        <div className="space-y-1 bg-white p-3 dark:bg-zinc-900">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            example.com
          </div>
          <div className="text-sm font-semibold text-foreground leading-tight">
            {title || (
              <span className="italic text-muted-foreground">
                No title set
              </span>
            )}
          </div>
          <div className="line-clamp-2 text-xs text-muted-foreground">
            {description || (
              <span className="italic">No description set</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SeoChecklist({ checks }: { checks: SeoCheck[] }) {
  const passCount = checks.filter((c) => c.status === "pass").length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <CheckCircle2 size={14} />
          SEO Checklist
        </div>
        <span className="text-xs text-muted-foreground">
          {passCount}/{checks.length} passed
        </span>
      </div>
      <div className="space-y-1">
        {checks.map((check) => (
          <div
            key={check.label}
            className="flex items-start gap-2 rounded-md border border-border p-2"
          >
            <StatusIndicator status={check.status} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-foreground">
                {check.label}
              </div>
              <div className="text-xs text-muted-foreground">
                {check.message}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Write a single root prop via Puck dispatch without touching other props.
 */
function useRootPropSetter() {
  const { dispatch } = usePuck();
  return useCallback(
    (key: string, value: unknown) => {
      dispatch({
        type: "setData",
        recordHistory: true,
        data: (prev) => ({
          ...prev,
          root: {
            ...prev.root,
            props: {
              ...(prev.root?.props ?? {}),
              [key]: value,
            },
          },
        }),
      });
    },
    [dispatch],
  );
}

function SeoToolsPanel() {
  const { appState } = usePuck();
  const setRootProp = useRootPropSetter();
  const [generating, setGenerating] = useState(false);

  const rootProps = (appState.data.root?.props ?? {}) as Record<
    string,
    unknown
  >;

  // SEO fields — editable directly in this panel.
  // The values live in root.props so the SEO checklist + previews stay in sync.
  const seoTitle = ((rootProps.seoTitle ?? "") as string).trim();
  const seoDescription = ((rootProps.seoDescription ?? "") as string).trim();
  const ogImage = ((rootProps.ogImage ?? "") as string).trim();

  // Fallback display values for preview (prefer explicit SEO fields)
  const displayTitle = seoTitle || ((rootProps.title ?? "") as string).trim();
  const displayDescription =
    seoDescription || ((rootProps.description ?? "") as string).trim();
  const slug = ((rootProps.slug ?? rootProps.path ?? "") as string).trim();

  const content = appState.data.content ?? [];

  const hasHeading = useMemo(
    () =>
      content.some((block) => {
        const type = block.type?.toLowerCase() ?? "";
        if (type === "heading" || type === "pageheader" || type === "hero") {
          return true;
        }
        const props = (block.props ?? {}) as Record<string, unknown>;
        if (props.tag === "h1" || props.level === 1 || props.level === "h1") {
          return true;
        }
        return false;
      }),
    [content],
  );

  const hasImages = useMemo(
    () =>
      content.some((block) => {
        const type = block.type?.toLowerCase() ?? "";
        return (
          type === "image" ||
          type === "hero" ||
          type === "gallery" ||
          type === "featuregrid"
        );
      }),
    [content],
  );

  const slugIsClean = useMemo(() => {
    if (!slug) return false;
    return /^[a-z0-9]+(?:[-/][a-z0-9]+)*$/.test(slug);
  }, [slug]);

  const checks: SeoCheck[] = useMemo(
    () => [
      {
        label: "Page title length",
        status:
          displayTitle.length === 0
            ? "fail"
            : displayTitle.length >= 50 && displayTitle.length <= 60
              ? "pass"
              : displayTitle.length >= 30 && displayTitle.length <= 70
                ? "warn"
                : "fail",
        message:
          displayTitle.length === 0
            ? "No title set. Add a title for search engines."
            : displayTitle.length >= 50 && displayTitle.length <= 60
              ? `${displayTitle.length} characters. Ideal length.`
              : `${displayTitle.length} characters. Aim for 50-60 characters.`,
      },
      {
        label: "Meta description length",
        status:
          displayDescription.length === 0
            ? "fail"
            : displayDescription.length >= 150 &&
                displayDescription.length <= 160
              ? "pass"
              : displayDescription.length >= 120 &&
                  displayDescription.length <= 170
                ? "warn"
                : "fail",
        message:
          displayDescription.length === 0
            ? "No description set. Add a meta description."
            : displayDescription.length >= 150 &&
                displayDescription.length <= 160
              ? `${displayDescription.length} characters. Ideal length.`
              : `${displayDescription.length} characters. Aim for 150-160 characters.`,
      },
      {
        label: "Heading (H1) present",
        status: hasHeading ? "pass" : "warn",
        message: hasHeading
          ? "Page has a heading component."
          : "No heading found. Add a Hero, PageHeader, or Heading block.",
      },
      {
        label: "Images in content",
        status: hasImages ? "pass" : "warn",
        message: hasImages
          ? "Page includes visual content."
          : "No images detected. Visual content improves engagement.",
      },
      {
        label: "URL slug",
        status: !slug ? "fail" : slugIsClean ? "pass" : "warn",
        message: !slug
          ? "No URL slug set."
          : slugIsClean
            ? "Clean, SEO-friendly URL."
            : "Slug should be lowercase with hyphens only.",
      },
    ],
    [displayTitle, displayDescription, hasHeading, hasImages, slug, slugIsClean],
  );

  /** Call the AI assist API to generate SEO fields from page content. */
  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    try {
      const pageTitle = (rootProps.title as string) || "";
      const pageDescription = (rootProps.description as string) || "";
      const blockSummary = content
        .slice(0, 8)
        .map((b) => {
          const p = (b.props ?? {}) as Record<string, unknown>;
          return `[${b.type}] ${(p.title as string) || (p.text as string) || ""}`.trim();
        })
        .filter(Boolean)
        .join("; ");

      const prompt = `Page: "${pageTitle}". Description: "${pageDescription}". Blocks: ${blockSummary || "none"}. Generate an SEO title (50-60 chars) and meta description (150-160 chars). Reply as JSON: {"title":"...","description":"..."}`;

      const res = await fetch("/api/ai/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "suggest", content: prompt }),
      });

      if (!res.ok) return;

      // Collect the streamed text
      const reader = res.body?.getReader();
      if (!reader) return;
      const dec = new TextDecoder();
      let raw = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        raw += dec.decode(value, { stream: true });
      }

      // Extract JSON from the response (AI may wrap it in markdown)
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return;
      const parsed = JSON.parse(jsonMatch[0]) as {
        title?: string;
        description?: string;
      };
      if (parsed.title) setRootProp("seoTitle", parsed.title.trim());
      if (parsed.description)
        setRootProp("seoDescription", parsed.description.trim());
    } catch {
      // Silently swallow — the user can retry or fill in manually
    } finally {
      setGenerating(false);
    }
  }, [content, rootProps, setRootProp]);

  return (
    <div className="space-y-6 p-4">
      <div>
        <div className="text-lg font-semibold text-foreground">SEO Tools</div>
        <div className="text-sm text-muted-foreground">
          Optimize your page for search engines and social sharing.
        </div>
      </div>

      {/* ── Editable SEO Fields ─────────────────────────────────────── */}
      <div className="space-y-3 rounded-md border border-border p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
            <Type size={12} />
            SEO Fields
          </div>
          <Button
            className="h-7 gap-1.5 px-2 text-xs"
            disabled={generating}
            onClick={handleGenerate}
            size="sm"
            variant="outline"
          >
            {generating ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Sparkles size={12} />
            )}
            {generating ? "Generating…" : "Auto-generate"}
          </Button>
        </div>

        <div className="space-y-1">
          <Label className="text-xs" htmlFor="seo-title">
            SEO Title
          </Label>
          <Input
            id="seo-title"
            className="h-8 text-sm"
            placeholder="Override page title for search engines…"
            value={seoTitle}
            onChange={(e) => setRootProp("seoTitle", e.target.value)}
          />
          <CharCounter label="Title" value={seoTitle || displayTitle} min={50} max={60} />
        </div>

        <div className="space-y-1">
          <Label className="text-xs" htmlFor="seo-description">
            Meta Description
          </Label>
          <Textarea
            id="seo-description"
            className="resize-none text-sm"
            placeholder="Brief page summary for search results…"
            rows={3}
            value={seoDescription}
            onChange={(e) => setRootProp("seoDescription", e.target.value)}
          />
          <CharCounter
            label="Description"
            value={seoDescription || displayDescription}
            min={150}
            max={160}
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs" htmlFor="og-image">
            Social Share Image (URL)
          </Label>
          <Input
            id="og-image"
            className="h-8 text-sm"
            placeholder="https://…"
            value={ogImage}
            onChange={(e) => setRootProp("ogImage", e.target.value)}
          />
        </div>
      </div>

      {/* ── Previews ─────────────────────────────────────────────────── */}
      <GooglePreview
        title={displayTitle}
        description={displayDescription}
        slug={slug}
      />

      <SocialPreview
        title={displayTitle}
        description={displayDescription}
        ogImage={ogImage}
      />

      {/* ── Checklist ────────────────────────────────────────────────── */}
      <SeoChecklist checks={checks} />

      <div className="text-xs text-muted-foreground">
        {content.length} block{content.length !== 1 ? "s" : ""} on page
      </div>
    </div>
  );
}

export const seoToolsPlugin: Plugin = {
  name: "seo-tools",
  label: "SEO Tools",
  icon: <Globe size={18} />,
  render: () => <SeoToolsPanel />,
};

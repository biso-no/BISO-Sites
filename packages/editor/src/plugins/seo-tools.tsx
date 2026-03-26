"use client";

import type { Plugin } from "@puckeditor/core";
import { usePuck } from "@puckeditor/core";
import {
  Search,
  Share2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Globe,
  Type,
  Image as ImageIcon,
  Link2,
  Heading1,
} from "lucide-react";
import { useMemo } from "react";

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

function SeoToolsPanel() {
  const { appState } = usePuck();

  const rootProps = (appState.data.root?.props ?? {}) as Record<
    string,
    unknown
  >;

  const title = ((rootProps.seoTitle ?? rootProps.title ?? "") as string).trim();
  const description = (
    (rootProps.seoDescription ?? rootProps.description ?? "") as string
  ).trim();
  const slug = ((rootProps.slug ?? rootProps.path ?? "") as string).trim();
  const ogImage = ((rootProps.ogImage ?? "") as string).trim();

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
    [content]
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
    [content]
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
          title.length === 0
            ? "fail"
            : title.length >= 50 && title.length <= 60
              ? "pass"
              : title.length >= 30 && title.length <= 70
                ? "warn"
                : "fail",
        message:
          title.length === 0
            ? "No title set. Add a title for search engines."
            : title.length >= 50 && title.length <= 60
              ? `${title.length} characters. Ideal length.`
              : `${title.length} characters. Aim for 50-60 characters.`,
      },
      {
        label: "Meta description length",
        status:
          description.length === 0
            ? "fail"
            : description.length >= 150 && description.length <= 160
              ? "pass"
              : description.length >= 120 && description.length <= 170
                ? "warn"
                : "fail",
        message:
          description.length === 0
            ? "No description set. Add a meta description."
            : description.length >= 150 && description.length <= 160
              ? `${description.length} characters. Ideal length.`
              : `${description.length} characters. Aim for 150-160 characters.`,
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
    [title, description, hasHeading, hasImages, slug, slugIsClean]
  );

  return (
    <div className="space-y-6 p-4">
      <div>
        <div className="text-lg font-semibold text-foreground">SEO Tools</div>
        <div className="text-sm text-muted-foreground">
          Optimize your page for search engines and social sharing.
        </div>
      </div>

      {/* Character Counters */}
      <div className="space-y-1.5 rounded-md border border-border p-3">
        <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
          <Type size={12} />
          Character Counts
        </div>
        <CharCounter label="Title" value={title} min={50} max={60} />
        <CharCounter
          label="Description"
          value={description}
          min={150}
          max={160}
        />
      </div>

      <GooglePreview title={title} description={description} slug={slug} />

      <SocialPreview
        title={title}
        description={description}
        ogImage={ogImage}
      />

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

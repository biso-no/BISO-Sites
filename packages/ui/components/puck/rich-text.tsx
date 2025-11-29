"use client";

import { cn } from "../../lib/utils";

export type RichTextProps = {
  content: string;
  variant?: "default" | "compact" | "legal";
  columns?: 1 | 2;
};

/**
 * RichText block for static content pages like Privacy Policy, Terms, etc.
 * Supports markdown-like formatting in the content string.
 */
export function RichText({
  content,
  variant = "default",
  columns = 1,
}: RichTextProps) {
  const variantClasses = {
    default: "prose-lg",
    compact: "prose-sm",
    legal: "prose-sm leading-relaxed",
  };

  return (
    <div
      className={cn(
        "prose prose-slate dark:prose-invert mx-auto max-w-none",
        variantClasses[variant],
        // Prose customizations for brand colors
        "prose-headings:font-semibold prose-headings:tracking-tight",
        "prose-h2:mt-12 prose-h2:border-border prose-h2:border-b prose-h2:pb-4 prose-h2:text-2xl",
        "prose-h3:mt-8 prose-h3:text-xl",
        "prose-h4:mt-6 prose-h4:text-lg",
        "prose-p:text-muted-foreground",
        "prose-a:text-primary prose-a:no-underline hover:prose-a:underline",
        "prose-strong:text-foreground",
        "prose-li:text-muted-foreground",
        "prose-ol:my-4 prose-ul:my-4",
        // Two column layout for larger screens
        columns === 2 && "lg:columns-2 lg:gap-12"
      )}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: Rich text rendering requires innerHTML, content is escaped in parseContent
      dangerouslySetInnerHTML={{ __html: parseContent(content) }}
    />
  );
}

/**
 * Simple markdown-like parser for common formatting
 * Handles: headings, paragraphs, lists, bold, italic, links
 */
function parseContent(content: string): string {
  if (!content) {
    return "";
  }

  let html = content
    // Escape HTML first
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    // Then apply markdown transformations
    // Headings
    .replace(/^#### (.+)$/gm, "<h4>$1</h4>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    // Bold and italic
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    // Line breaks for double newlines (paragraphs)
    .replace(/\n\n/g, "</p><p>")
    // Unordered lists
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    // Ordered lists
    .replace(/^\d+\. (.+)$/gm, "<li>$1</li>");

  // Wrap consecutive <li> elements in <ul> or <ol>
  html = html.replace(/(<li>.*?<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`);

  // Wrap in paragraph tags if not already wrapped
  if (
    !(html.startsWith("<h") || html.startsWith("<ul") || html.startsWith("<ol"))
  ) {
    html = `<p>${html}</p>`;
  }

  return html;
}

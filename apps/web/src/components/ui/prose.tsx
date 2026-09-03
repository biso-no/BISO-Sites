import { cn } from "@repo/ui/lib/utils";
import type { ReactNode } from "react";

/**
 * Long-form content at a readable measure.
 *
 * Phase 0 found **51 prose blocks at `max-w-4xl`** — about 100 characters per
 * line, well over the brief's 80-character floor. This caps the measure and
 * applies the design system's type roles to authored markup, so hardcoded pages
 * and block-editor output (`/[...slug]`) read identically.
 *
 * The width comes from `--measure`, which is tuned by measurement rather than
 * arithmetic: `ch` is the advance of "0" and far wider than average prose, so
 * 54ch renders ~72–75 characters, not 54. See 01-design-spec.md §1.5.
 */
export function Prose({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "max-w-(--measure) text-ink",
        // Body
        "[&_p]:type-body [&_li]:type-body [&_p]:mb-5",
        // Headings use the display roles, so authored content matches chrome
        "[&_h2]:type-display-sm [&_h2]:mt-10 [&_h2]:mb-4",
        "[&_h3]:type-heading-card [&_h3]:mt-8 [&_h3]:mb-3",
        // A single long word at display size is wider than a 320px column.
        "[&_h2]:break-words [&_h3]:break-words",
        // Lists
        "[&_ol]:mb-5 [&_ol]:list-decimal [&_ol]:ps-5 [&_ul]:mb-5 [&_ul]:list-disc [&_ul]:ps-5",
        "[&_li]:mb-2",
        // Links carry the action colour and are underlined — never colour alone
        "[&_a]:text-ink-accent [&_a]:underline [&_a]:underline-offset-4",
        "[&_a:hover]:no-underline",
        // Quotes and rules
        "[&_blockquote]:my-6 [&_blockquote]:border-edge [&_blockquote]:border-s-2 [&_blockquote]:ps-5 [&_blockquote]:text-ink-muted",
        "[&_hr]:my-10 [&_hr]:border-edge",
        "[&_strong]:font-semibold",
        // Wide content scrolls inside itself rather than widening the page
        "[&_pre]:overflow-x-auto [&_table]:block [&_table]:overflow-x-auto",
        className
      )}
    >
      {children}
    </div>
  );
}

import { PlateContentRenderer } from "@repo/ui/components/plate-content-renderer";

/**
 * Body colours stay on the typography plugin's defaults — they are tuned for
 * long-form contrast in both themes. What is overridden here is rhythm
 * (heading spacing), measure, and the brand accents on links, quotes, markers.
 */
const PROSE = [
  "prose-lg",
  // Heading margins are rhythm between blocks, not a gap above the article —
  // strip it off the first block so the story starts level with the dateline.
  "[&>*:first-child]:mt-0",
  "prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-foreground",
  "prose-h2:mt-14 prose-h2:mb-4 prose-h2:text-2xl sm:prose-h2:text-3xl",
  "prose-h3:mt-10 prose-h3:mb-3 prose-h3:text-xl",
  "prose-p:leading-[1.75]",
  "prose-a:font-medium prose-a:text-brand prose-a:underline prose-a:decoration-brand/40 prose-a:underline-offset-4 hover:prose-a:decoration-brand",
  "prose-strong:text-foreground",
  "prose-blockquote:border-brand prose-blockquote:font-medium prose-blockquote:text-foreground prose-blockquote:not-italic",
  "prose-li:marker:text-brand",
  "prose-img:rounded-2xl prose-img:shadow-lg",
  "prose-hr:border-border",
].join(" ");

export function ArticleBody({ value }: { value: string }) {
  return (
    <div className="max-w-[68ch]">
      <PlateContentRenderer className={PROSE} value={value} />
    </div>
  );
}

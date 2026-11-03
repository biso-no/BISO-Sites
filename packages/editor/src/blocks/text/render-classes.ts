/**
 * The public look of a rich text body, shared by the site's render and the
 * canvas editing field so both look the same. Margins, not a flex gap, so the
 * canvas's one-`<ul>`-per-item markup spaces like a single list. One literal,
 * so Tailwind sees every class.
 */
export const RICH_CLASS =
  "pg-rich max-w-(--measure) text-ink [&>*+*]:mt-4 [&>ul+ul]:mt-2 [&>ol+ol]:mt-2 [&_:is(h2,h3)]:break-words [&_:is(h2,h3)]:hyphens-auto [&_:is(p,li,blockquote)]:[overflow-wrap:anywhere] [&_a]:text-ink-accent [&_a]:underline [&_a]:underline-offset-4 [&_ul]:list-disc [&_ol]:list-decimal [&_:is(ul,ol)]:space-y-2 [&_:is(ul,ol)]:pl-5 [&_li]:marker:text-ink-accent [&_li>:is(ul,ol)]:mt-2 [&_blockquote]:border-l-2 [&_blockquote]:border-ink-accent [&_blockquote]:pl-4 [&_hr]:border-current [&_hr]:opacity-20";

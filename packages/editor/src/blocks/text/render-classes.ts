/**
 * The public look of a rich text body, shared by the site's render and the
 * canvas editing field so both look the same. Margins, not a flex gap, so the
 * canvas's one-`<ul>`-per-item markup spaces like a single list. The box
 * spans the block; `.pg-rich` in packages/ui/styles/globals.css keeps the
 * text at the reading measure and lets a table use the full width. A table
 * has no wrapper: it is a block that scrolls sideways itself when its
 * columns still do not fit, and its cells wrap long words as body copy does.
 * One literal, so Tailwind sees every class.
 */
export const RICH_CLASS =
  "pg-rich text-ink [&>*+*]:mt-4 [&>ul+ul]:mt-2 [&>ol+ol]:mt-2 [&_:is(h2,h3)]:break-words [&_:is(h2,h3)]:hyphens-auto [&_:is(p,li,blockquote)]:[overflow-wrap:anywhere] [&_a]:text-ink-accent [&_a]:underline [&_a]:underline-offset-4 [&_ul]:list-disc [&_ol]:list-decimal [&_:is(ul,ol)]:space-y-2 [&_:is(ul,ol)]:pl-5 [&_li]:marker:text-ink-accent [&_li>:is(ul,ol)]:mt-2 [&_blockquote]:border-l-2 [&_blockquote]:border-ink-accent [&_blockquote]:pl-4 [&_hr]:border-current [&_hr]:opacity-20 [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto [&_table]:border-collapse [&_:is(th,td)]:border [&_:is(th,td)]:border-edge [&_:is(th,td)]:px-3 [&_:is(th,td)]:py-2 [&_:is(th,td)]:text-left [&_:is(th,td)]:align-top [&_:is(th,td)]:[overflow-wrap:anywhere] [&_th]:font-bold [&_thead_th]:bg-surface-sunken";

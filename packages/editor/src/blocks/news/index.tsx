import { registerBlock } from "@/blocks/registry";
import { emptyBlock } from "@/editor/operations";
import { NewsRender } from "./render";
import { NewsInspector } from "./inspector";

function NewsThumb() {
  const s = "var(--ink-3)";
  return (
    <svg viewBox="0 0 38 30">
      <rect x="3" y="4" width="32" height="22" rx="2" stroke={s} strokeWidth=".5" fill="none" opacity=".5"/>
      <rect x="5" y="7" width="20" height="3" fill={s} opacity=".5"/>
      <rect x="5" y="12" width="28" height="1.5" fill={s} opacity=".3"/>
      <rect x="5" y="15" width="24" height="1.5" fill={s} opacity=".3"/>
      <rect x="5" y="18" width="26" height="1.5" fill={s} opacity=".3"/>
    </svg>
  );
}

registerBlock({
  type: "news",
  label: "News feed",
  description: "Latest posts from the department",
  category: "Pull from BISO",
  aiHint: "A live news feed from the department.",
  aiProps: ["heading", "source"],
  empty: () => emptyBlock("news") as never,
  Render: NewsRender as never,
  Inspector: NewsInspector as never,
  PaletteThumb: NewsThumb,
});

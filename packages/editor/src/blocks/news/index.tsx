import { registerBlock } from "@/blocks/registry";
import { emptyBlock } from "@/editor/operations";
import { NewsInspector } from "./inspector";
import { NewsRender } from "./render";

function NewsThumb() {
  const s = "var(--ink-3)";
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 38 30">
      <rect
        fill="none"
        height="22"
        opacity=".5"
        rx="2"
        stroke={s}
        strokeWidth=".5"
        width="32"
        x="3"
        y="4"
      />
      <rect fill={s} height="3" opacity=".5" width="20" x="5" y="7" />
      <rect fill={s} height="1.5" opacity=".3" width="28" x="5" y="12" />
      <rect fill={s} height="1.5" opacity=".3" width="24" x="5" y="15" />
      <rect fill={s} height="1.5" opacity=".3" width="26" x="5" y="18" />
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

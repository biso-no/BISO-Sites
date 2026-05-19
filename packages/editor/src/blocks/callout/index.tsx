import { registerBlock } from "@/blocks/registry";
import { emptyBlock } from "@/editor/operations";
import { CalloutRender } from "./render";
import { CalloutInspector } from "./inspector";

function CalloutThumb() {
  const s = "var(--ink-3)";
  return (
    <svg viewBox="0 0 38 30">
      <rect x="3" y="9" width="32" height="12" rx="1.5" fill="none" stroke={s} strokeWidth=".5" strokeDasharray="2 1.5"/>
      <circle cx="8" cy="15" r="2" fill="var(--gold)"/>
      <rect x="13" y="14" width="14" height="1.5" fill={s}/>
    </svg>
  );
}

registerBlock({
  type: "callout",
  label: "Callout",
  description: "An info box with an icon",
  category: "Tell a story",
  aiHint: "A highlighted info or warning box.",
  aiProps: ["title", "body"],
  empty: () => emptyBlock("callout") as never,
  Render: CalloutRender as never,
  Inspector: CalloutInspector as never,
  PaletteThumb: CalloutThumb,
});

import { registerBlock } from "@/blocks/registry";
import { emptyBlock } from "@/editor/operations";
import { CtaBandInspector } from "./inspector";
import { CtaBandRender } from "./render";

function CtaBandThumb() {
  const s = "var(--ink-3)";
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 38 30">
      <line stroke={s} strokeWidth="1" x1="5" x2="22" y1="12" y2="12" />
      <line stroke={s} strokeWidth=".5" x1="5" x2="18" y1="18" y2="18" />
      <rect
        fill="none"
        height="7"
        rx="3.5"
        stroke={s}
        width="9"
        x="25"
        y="13"
      />
    </svg>
  );
}

registerBlock({
  type: "ctaBand",
  label: "Call to action",
  description: "A headline with up to two buttons",
  category: "Engage",
  group: "actions",
  aiHint:
    "A call-to-action band: eyebrow, headline, short text and up to two buttons.",
  aiProps: ["eyebrow", "title", "text", "buttons"],
  empty: () => emptyBlock("ctaBand") as never,
  Render: CtaBandRender as never,
  Inspector: CtaBandInspector as never,
  PaletteThumb: CtaBandThumb,
});

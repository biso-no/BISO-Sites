import { registerBlock } from "@/blocks/registry";
import { emptyBlock } from "@/editor/operations";
import { ButtonsInspector } from "./inspector";
import { ButtonsRender } from "./render";

function ButtonsThumb() {
  const s = "var(--ink-3)";
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 38 30">
      <rect fill="none" height="8" rx="4" stroke={s} width="13" x="5" y="11" />
      <rect fill="none" height="8" rx="4" stroke={s} width="13" x="20" y="11" />
    </svg>
  );
}

registerBlock({
  type: "buttons",
  label: "Buttons",
  description: "A row of up to three links",
  category: "Engage",
  aiHint: "A row of up to three link buttons, primary or secondary.",
  aiProps: ["items", "align"],
  empty: () => emptyBlock("buttons") as never,
  Render: ButtonsRender as never,
  Inspector: ButtonsInspector as never,
  PaletteThumb: ButtonsThumb,
  v2: true,
});

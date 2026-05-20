import { registerBlock } from "@/blocks/registry";
import { emptyBlock } from "@/editor/operations";
import { JobsInspector } from "./inspector";
import { JobsRender } from "./render";

function JobsThumb() {
  const s = "var(--ink-3)";
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 38 30">
      <rect
        fill="none"
        height="6"
        opacity=".7"
        rx="2"
        stroke={s}
        strokeWidth=".5"
        width="32"
        x="3"
        y="7"
      />
      <rect
        fill="none"
        height="6"
        opacity=".5"
        rx="2"
        stroke={s}
        strokeWidth=".5"
        width="32"
        x="3"
        y="15"
      />
      <rect fill={s} height="2" opacity=".5" width="12" x="5" y="9" />
      <rect fill={s} height="2" opacity=".4" width="10" x="5" y="17" />
    </svg>
  );
}

registerBlock({
  type: "jobs",
  label: "Open roles",
  description: "Your unit's job board",
  category: "Pull from BISO",
  aiHint:
    "A live list of open volunteer roles from the department's job board.",
  aiProps: ["heading", "source"],
  empty: () => emptyBlock("jobs") as never,
  Render: JobsRender as never,
  Inspector: JobsInspector as never,
  PaletteThumb: JobsThumb,
});

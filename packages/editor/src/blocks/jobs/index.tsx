import { registerBlock } from "@/blocks/registry";
import { emptyBlock } from "@/editor/operations";
import { JobsRender } from "./render";
import { JobsInspector } from "./inspector";

function JobsThumb() {
  const s = "var(--ink-3)";
  return (
    <svg viewBox="0 0 38 30">
      <rect x="3" y="7" width="32" height="6" rx="2" stroke={s} strokeWidth=".5" fill="none" opacity=".7"/>
      <rect x="3" y="15" width="32" height="6" rx="2" stroke={s} strokeWidth=".5" fill="none" opacity=".5"/>
      <rect x="5" y="9" width="12" height="2" fill={s} opacity=".5"/>
      <rect x="5" y="17" width="10" height="2" fill={s} opacity=".4"/>
    </svg>
  );
}

registerBlock({
  type: "jobs",
  label: "Open roles",
  description: "Your unit's job board",
  category: "Pull from BISO",
  aiHint: "A live list of open volunteer roles from the department's job board.",
  aiProps: ["heading", "source"],
  empty: () => emptyBlock("jobs") as never,
  Render: JobsRender as never,
  Inspector: JobsInspector as never,
  PaletteThumb: JobsThumb,
});

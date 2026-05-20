import { registerBlock } from "@/blocks/registry";
import { emptyBlock } from "@/editor/operations";
import { FilterBarInspector } from "./inspector";
import { FilterBarRender } from "./render";
import { FilterBarThumb } from "./thumb";

registerBlock({
  type: "filterBar",
  label: "Filter bar",
  description: "Search/filter for feeds",
  category: "Layout",
  aiHint:
    "A search bar that filters the news, jobs, or units feed on the same page.",
  aiProps: ["target"],
  empty: () => emptyBlock("filterBar") as never,
  Render: FilterBarRender as never,
  Inspector: FilterBarInspector as never,
  PaletteThumb: FilterBarThumb,
});

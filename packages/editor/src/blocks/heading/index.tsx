import { registerBlock } from "@/blocks/registry";
import { emptyBlock } from "@/editor/operations";
import { HeadingInspector } from "./inspector";
import { HeadingRender } from "./render";
import { HeadingThumb } from "./thumb";

registerBlock({
  type: "heading",
  label: "Heading",
  description: "A section title with an optional link",
  category: "Tell a story",
  aiHint: "A section heading with an eyebrow, intro and optional link.",
  aiProps: ["eyebrow", "title", "intro"],
  empty: () => emptyBlock("heading") as never,
  Render: HeadingRender as never,
  Inspector: HeadingInspector as never,
  PaletteThumb: HeadingThumb,
  v2: true,
});

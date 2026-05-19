import { registerBlock } from "@/blocks/registry";
import { emptyBlock } from "@/editor/operations";
import { ImageRender } from "./render";
import { ImageInspector } from "./inspector";

function ImageThumb() {
  const s = "var(--ink-3)";
  return (
    <svg viewBox="0 0 38 30">
      <rect x="3" y="5" width="32" height="20" rx="1.5" fill={s} opacity=".15"/>
      <circle cx="11" cy="13" r="2" fill={s} opacity=".5"/>
      <path d="M3 23l8-8 6 6 5-4 13 8H3z" fill={s} opacity=".25"/>
    </svg>
  );
}

registerBlock({
  type: "image",
  label: "Image",
  description: "A single photo with caption",
  category: "Media",
  aiHint: "A full-width image with an optional caption.",
  aiProps: ["caption", "aspect"],
  empty: () => emptyBlock("image") as never,
  Render: ImageRender as never,
  Inspector: ImageInspector as never,
  PaletteThumb: ImageThumb,
});

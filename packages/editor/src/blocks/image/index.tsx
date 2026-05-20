import { registerBlock } from "@/blocks/registry";
import { emptyBlock } from "@/editor/operations";
import { ImageInspector } from "./inspector";
import { ImageRender } from "./render";

function ImageThumb() {
  const s = "var(--ink-3)";
  return (
    <svg viewBox="0 0 38 30">
      <rect
        fill={s}
        height="20"
        opacity=".15"
        rx="1.5"
        width="32"
        x="3"
        y="5"
      />
      <circle cx="11" cy="13" fill={s} opacity=".5" r="2" />
      <path d="M3 23l8-8 6 6 5-4 13 8H3z" fill={s} opacity=".25" />
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

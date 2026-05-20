import { registerBlock } from "@/blocks/registry";
import { emptyBlock } from "@/editor/operations";
import { GalleryInspector } from "./inspector";
import { GalleryRender } from "./render";

function GalleryThumb() {
  const s = "var(--ink-3)";
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 38 30">
      <rect
        fill="none"
        height="22"
        opacity=".7"
        rx="2"
        stroke={s}
        strokeWidth=".5"
        width="14"
        x="3"
        y="4"
      />
      <rect
        fill="none"
        height="10"
        opacity=".7"
        rx="2"
        stroke={s}
        strokeWidth=".5"
        width="16"
        x="19"
        y="4"
      />
      <rect
        fill="none"
        height="10"
        opacity=".7"
        rx="2"
        stroke={s}
        strokeWidth=".5"
        width="16"
        x="19"
        y="16"
      />
    </svg>
  );
}

registerBlock({
  type: "gallery",
  label: "Gallery",
  description: "A grid of photos",
  category: "Media",
  aiHint: "A photo gallery grid.",
  aiProps: ["images"],
  empty: () => emptyBlock("gallery") as never,
  Render: GalleryRender as never,
  Inspector: GalleryInspector as never,
  PaletteThumb: GalleryThumb,
});

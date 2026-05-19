import { registerBlock } from "@/blocks/registry";
import { emptyBlock } from "@/editor/operations";
import { GalleryRender } from "./render";
import { GalleryInspector } from "./inspector";

function GalleryThumb() {
  const s = "var(--ink-3)";
  return (
    <svg viewBox="0 0 38 30">
      <rect x="3" y="4" width="14" height="22" rx="2" stroke={s} strokeWidth=".5" fill="none" opacity=".7"/>
      <rect x="19" y="4" width="16" height="10" rx="2" stroke={s} strokeWidth=".5" fill="none" opacity=".7"/>
      <rect x="19" y="16" width="16" height="10" rx="2" stroke={s} strokeWidth=".5" fill="none" opacity=".7"/>
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

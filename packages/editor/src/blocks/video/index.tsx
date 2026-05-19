import { registerBlock } from "@/blocks/registry";
import { emptyBlock } from "@/editor/operations";
import { VideoRender } from "./render";
import { VideoInspector } from "./inspector";

function VideoThumb() {
  const s = "var(--ink-3)";
  return (
    <svg viewBox="0 0 38 30">
      <rect x="3" y="5" width="32" height="20" rx="3" stroke={s} strokeWidth=".5" fill="none" opacity=".7"/>
      <polygon points="14,10 14,20 26,15" fill={s} opacity=".4"/>
    </svg>
  );
}

registerBlock({
  type: "video",
  label: "Video",
  description: "Embed YouTube, Vimeo, or upload",
  category: "Media",
  aiHint: "A video embed (YouTube, Vimeo, or native upload).",
  aiProps: ["url", "caption"],
  empty: () => emptyBlock("video") as never,
  Render: VideoRender as never,
  Inspector: VideoInspector as never,
  PaletteThumb: VideoThumb,
});

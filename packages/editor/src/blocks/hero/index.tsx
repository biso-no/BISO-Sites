import { registerBlock } from "@/blocks/registry";
import { emptyBlock } from "@/editor/operations";
import { HeroRender } from "./render";
import { HeroInspector } from "./inspector";
import { HeroThumb } from "./thumb";

registerBlock({
  type: "hero",
  label: "Hero",
  description: "The big intro at the top",
  category: "Top of page",
  variants: [
    { id: "split",    label: "Split",    kind: "split" },
    { id: "centered", label: "Centered", kind: "centered" },
    { id: "full",     label: "Full",     kind: "full" },
  ],
  aiHint: "A large introductory block with a headline, subtitle, CTA button, and decorative art.",
  aiProps: ["eyebrow", "title", "subtitle", "ctaLabel", "ctaUrl"],
  schema: [
    { key: "eyebrow",  label: "Eyebrow",  type: "text" },
    { key: "title",    label: "Title",    type: "text" },
    { key: "subtitle", label: "Subtitle", type: "textarea" },
    { key: "ctaLabel", label: "CTA text", type: "text" },
    { key: "ctaUrl",   label: "CTA url",  type: "url" },
  ],
  empty: () => emptyBlock("hero") as ReturnType<typeof emptyBlock> & { type: "hero" },
  Render: HeroRender as never,
  Inspector: HeroInspector as never,
  PaletteThumb: HeroThumb,
});

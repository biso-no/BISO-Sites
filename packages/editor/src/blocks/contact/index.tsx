import { registerBlock } from "@/blocks/registry";
import { emptyBlock } from "@/editor/operations";
import { ContactRender } from "./render";
import { ContactInspector } from "./inspector";

function ContactThumb() {
  const s = "var(--ink-3)";
  return (
    <svg viewBox="0 0 38 30">
      <rect x="3" y="3" width="32" height="24" rx="1.5" fill={s} opacity=".85"/>
      <rect x="6" y="8" width="14" height="2" fill="var(--paper)"/>
      <rect x="6" y="14" width="8" height="1.5" fill="var(--paper)" opacity=".7"/>
      <rect x="6" y="18" width="10" height="1.5" fill="var(--paper)" opacity=".7"/>
    </svg>
  );
}

registerBlock({
  type: "contact",
  label: "Contact",
  description: "Email, address, socials",
  category: "Engage",
  variants: [
    { id: "single",    label: "Single",    kind: "single" },
    { id: "directory", label: "Directory", kind: "directory" },
  ],
  aiHint: "A contact section with email, Instagram, address, and opening hours.",
  aiProps: ["heading", "email", "instagram", "address", "hours"],
  empty: () => emptyBlock("contact") as never,
  Render: ContactRender as never,
  Inspector: ContactInspector as never,
  PaletteThumb: ContactThumb,
});

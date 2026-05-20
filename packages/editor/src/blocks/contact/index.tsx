import { registerBlock } from "@/blocks/registry";
import { emptyBlock } from "@/editor/operations";
import { ContactInspector } from "./inspector";
import { ContactRender } from "./render";

function ContactThumb() {
  const s = "var(--ink-3)";
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 38 30">
      <rect
        fill={s}
        height="24"
        opacity=".85"
        rx="1.5"
        width="32"
        x="3"
        y="3"
      />
      <rect fill="var(--paper)" height="2" width="14" x="6" y="8" />
      <rect
        fill="var(--paper)"
        height="1.5"
        opacity=".7"
        width="8"
        x="6"
        y="14"
      />
      <rect
        fill="var(--paper)"
        height="1.5"
        opacity=".7"
        width="10"
        x="6"
        y="18"
      />
    </svg>
  );
}

registerBlock({
  type: "contact",
  label: "Contact",
  description: "Email, address, socials",
  category: "Engage",
  variants: [
    { id: "single", label: "Single", kind: "single" },
    { id: "directory", label: "Directory", kind: "directory" },
  ],
  aiHint:
    "A contact section with email, Instagram, address, and opening hours.",
  aiProps: ["heading", "email", "instagram", "address", "hours"],
  empty: () => emptyBlock("contact") as never,
  Render: ContactRender as never,
  Inspector: ContactInspector as never,
  PaletteThumb: ContactThumb,
});

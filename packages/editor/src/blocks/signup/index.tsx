import { registerBlock } from "@/blocks/registry";
import { emptyBlock } from "@/editor/operations";
import { SignupInspector } from "./inspector";
import { SignupRender } from "./render";

function SignupThumb() {
  const s = "var(--ink-3)";
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 38 30">
      <rect
        fill="none"
        height="12"
        opacity=".6"
        rx="6"
        stroke={s}
        strokeWidth=".5"
        width="32"
        x="3"
        y="9"
      />
      <rect fill={s} height="4" opacity=".3" rx="2" width="14" x="6" y="13" />
      <rect fill={s} height="10" opacity=".4" rx="5" width="8" x="26" y="10" />
    </svg>
  );
}

registerBlock({
  type: "signup",
  label: "Signup form",
  description: "Collect emails or interest",
  category: "Engage",
  aiHint: "An email signup form with a heading and placeholder text.",
  aiProps: ["heading", "placeholder"],
  empty: () => emptyBlock("signup") as never,
  Render: SignupRender as never,
  Inspector: SignupInspector as never,
  PaletteThumb: SignupThumb,
});

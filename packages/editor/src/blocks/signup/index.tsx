import { registerBlock } from "@/blocks/registry";
import { emptyBlock } from "@/editor/operations";
import { SignupRender } from "./render";
import { SignupInspector } from "./inspector";

function SignupThumb() {
  const s = "var(--ink-3)";
  return (
    <svg viewBox="0 0 38 30">
      <rect x="3" y="9" width="32" height="12" rx="6" stroke={s} strokeWidth=".5" fill="none" opacity=".6"/>
      <rect x="6" y="13" width="14" height="4" rx="2" fill={s} opacity=".3"/>
      <rect x="26" y="10" width="8" height="10" rx="5" fill={s} opacity=".4"/>
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

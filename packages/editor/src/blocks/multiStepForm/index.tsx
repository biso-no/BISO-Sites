import { registerBlock } from "@/blocks/registry";
import { emptyBlock } from "@/editor/operations";
import { MultiStepFormInspector } from "./inspector";
import { MultiStepFormRender } from "./render";
import { MultiStepFormThumb } from "./thumb";

registerBlock({
  type: "multiStepForm",
  label: "Multi-step form",
  description: "Step-by-step form builder",
  category: "Engage",
  group: "actions",
  aiHint:
    "A multi-step form. Steps hold fields (text, email, textarea, select, radio, checkbox with options). submitMode 'database' saves to the admin inbox; 'email' needs a recipientEmail ending in @biso.no.",
  aiProps: [
    "heading",
    "steps",
    "submitMode",
    "topic",
    "recipientEmail",
    "accessTeamId",
  ],
  empty: () => emptyBlock("multiStepForm") as never,
  Render: MultiStepFormRender as never,
  Inspector: MultiStepFormInspector as never,
  PaletteThumb: MultiStepFormThumb,
  v2: true,
});

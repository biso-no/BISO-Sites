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
  aiHint:
    "A configurable multi-step form that submits to an Appwrite collection.",
  aiProps: ["heading", "steps", "submitTarget"],
  empty: () => emptyBlock("multiStepForm") as never,
  Render: MultiStepFormRender as never,
  Inspector: MultiStepFormInspector as never,
  PaletteThumb: MultiStepFormThumb,
});

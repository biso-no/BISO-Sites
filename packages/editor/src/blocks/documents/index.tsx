import { registerBlock } from "@/blocks/registry";
import { emptyBlock } from "@/editor/operations";
import { DocumentsInspector } from "./inspector";
import { DocumentsRender } from "./render";
import { DocumentsThumb } from "./thumb";

registerBlock({
  type: "documents",
  label: "Documents",
  description: "File download list",
  category: "Data",
  aiHint: "A list of downloadable files with titles.",
  aiProps: ["heading"],
  empty: () => emptyBlock("documents") as never,
  Render: DocumentsRender as never,
  Inspector: DocumentsInspector as never,
  PaletteThumb: DocumentsThumb,
});

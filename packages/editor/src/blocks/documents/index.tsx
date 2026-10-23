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
  group: "actions",
  aiHint:
    "A list of downloadable files: a title, file type and size, and a download link.",
  aiProps: ["heading", "items"],
  empty: () => emptyBlock("documents") as never,
  Render: DocumentsRender as never,
  Inspector: DocumentsInspector as never,
  PaletteThumb: DocumentsThumb,
  v2: true,
});

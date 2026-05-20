import { registerBlock } from "@/blocks/registry";
import { emptyBlock } from "@/editor/operations";
import { DepartmentGridRender } from "./render";
import { DepartmentGridInspector } from "./inspector";
import { DepartmentGridThumb } from "./thumb";

registerBlock({
  type: "departmentGrid",
  label: "Departments",
  description: "Dept cards from Appwrite",
  category: "Data",
  variants: [
    { id: "grid", label: "Grid", kind: "grid" },
    { id: "list", label: "List", kind: "list" },
  ],
  aiHint: "A grid of department cards fetched live from Appwrite.",
  aiProps: ["heading"],
  empty: () => emptyBlock("departmentGrid") as never,
  Render: DepartmentGridRender as never,
  Inspector: DepartmentGridInspector as never,
  PaletteThumb: DepartmentGridThumb,
});

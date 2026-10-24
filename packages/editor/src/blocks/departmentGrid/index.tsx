import { registerBlock } from "@/blocks/registry";
import { emptyBlock } from "@/editor/operations";
import { DepartmentGridInspector } from "./inspector";
import { DepartmentGridRender } from "./render";
import { DepartmentGridThumb } from "./thumb";

registerBlock({
  type: "departmentGrid",
  label: "Units",
  description: "Unit cards, for a campus or all",
  category: "Pull from BISO",
  group: "live",
  aiHint:
    "Cards for BISO's units. scope is campus (the page's campus) or all; optional category (society, academic_association, project, staff_function, national, other); limit is 3, 6, 9 or 12.",
  aiProps: ["heading", "scope", "category", "limit"],
  empty: () => emptyBlock("departmentGrid") as never,
  Render: DepartmentGridRender as never,
  Inspector: DepartmentGridInspector as never,
  PaletteThumb: DepartmentGridThumb,
});

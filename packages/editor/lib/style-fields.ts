import { Fields } from "@measured/puck";

/**
 * Reusable field groups for comprehensive component styling
 */

export const spacingFields: Fields = {
  marginTop: {
    type: "text",
    label: "Margin Top",
  },
  marginRight: {
    type: "text",
    label: "Margin Right",
  },
  marginBottom: {
    type: "text",
    label: "Margin Bottom",
  },
  marginLeft: {
    type: "text",
    label: "Margin Left",
  },
  paddingTop: {
    type: "text",
    label: "Padding Top",
  },
  paddingRight: {
    type: "text",
    label: "Padding Right",
  },
  paddingBottom: {
    type: "text",
    label: "Padding Bottom",
  },
  paddingLeft: {
    type: "text",
    label: "Padding Left",
  },
};

export const colorFields: Fields = {
  backgroundColor: {
    type: "text",
    label: "Background Color",
  },
  textColor: {
    type: "text",
    label: "Text Color",
  },
  borderColor: {
    type: "text",
    label: "Border Color",
  },
};

export const borderFields: Fields = {
  borderWidth: {
    type: "select",
    label: "Border Width",
    options: [
      { label: "None", value: "0" },
      { label: "1px", value: "1" },
      { label: "2px", value: "2" },
      { label: "4px", value: "4" },
      { label: "8px", value: "8" },
    ],
  },
  borderRadius: {
    type: "select",
    label: "Border Radius",
    options: [
      { label: "None", value: "0" },
      { label: "Small", value: "sm" },
      { label: "Medium", value: "md" },
      { label: "Large", value: "lg" },
      { label: "XL", value: "xl" },
      { label: "2XL", value: "2xl" },
      { label: "Full", value: "full" },
    ],
  },
  borderStyle: {
    type: "select",
    label: "Border Style",
    options: [
      { label: "Solid", value: "solid" },
      { label: "Dashed", value: "dashed" },
      { label: "Dotted", value: "dotted" },
      { label: "Double", value: "double" },
      { label: "None", value: "none" },
    ],
  },
};

export const shadowFields: Fields = {
  shadow: {
    type: "select",
    label: "Shadow",
    options: [
      { label: "None", value: "none" },
      { label: "Small", value: "sm" },
      { label: "Medium", value: "md" },
      { label: "Large", value: "lg" },
      { label: "XL", value: "xl" },
      { label: "2XL", value: "2xl" },
      { label: "Inner", value: "inner" },
    ],
  },
};

export const typographyFields: Fields = {
  fontSize: {
    type: "select",
    label: "Font Size",
    options: [
      { label: "XS", value: "xs" },
      { label: "SM", value: "sm" },
      { label: "Base", value: "base" },
      { label: "LG", value: "lg" },
      { label: "XL", value: "xl" },
      { label: "2XL", value: "2xl" },
      { label: "3XL", value: "3xl" },
      { label: "4XL", value: "4xl" },
    ],
  },
  fontWeight: {
    type: "select",
    label: "Font Weight",
    options: [
      { label: "Normal", value: "normal" },
      { label: "Medium", value: "medium" },
      { label: "Semibold", value: "semibold" },
      { label: "Bold", value: "bold" },
      { label: "Extrabold", value: "extrabold" },
    ],
  },
  textAlign: {
    type: "radio",
    label: "Text Align",
    options: [
      { label: "Left", value: "left" },
      { label: "Center", value: "center" },
      { label: "Right", value: "right" },
      { label: "Justify", value: "justify" },
    ],
  },
  lineHeight: {
    type: "select",
    label: "Line Height",
    options: [
      { label: "Tight", value: "tight" },
      { label: "Snug", value: "snug" },
      { label: "Normal", value: "normal" },
      { label: "Relaxed", value: "relaxed" },
      { label: "Loose", value: "loose" },
    ],
  },
};

export const layoutFields: Fields = {
  display: {
    type: "select",
    label: "Display",
    options: [
      { label: "Block", value: "block" },
      { label: "Flex", value: "flex" },
      { label: "Grid", value: "grid" },
      { label: "Inline Block", value: "inline-block" },
      { label: "Inline Flex", value: "inline-flex" },
      { label: "Hidden", value: "hidden" },
    ],
  },
  width: {
    type: "text",
    label: "Width",
  },
  height: {
    type: "text",
    label: "Height",
  },
  maxWidth: {
    type: "select",
    label: "Max Width",
    options: [
      { label: "None", value: "none" },
      { label: "SM (640px)", value: "sm" },
      { label: "MD (768px)", value: "md" },
      { label: "LG (1024px)", value: "lg" },
      { label: "XL (1280px)", value: "xl" },
      { label: "2XL (1536px)", value: "2xl" },
      { label: "Full", value: "full" },
    ],
  },
};

export const flexFields: Fields = {
  flexDirection: {
    type: "radio",
    label: "Direction",
    options: [
      { label: "Row", value: "row" },
      { label: "Column", value: "col" },
    ],
  },
  justifyContent: {
    type: "select",
    label: "Justify",
    options: [
      { label: "Start", value: "start" },
      { label: "Center", value: "center" },
      { label: "End", value: "end" },
      { label: "Between", value: "between" },
      { label: "Around", value: "around" },
      { label: "Evenly", value: "evenly" },
    ],
  },
  alignItems: {
    type: "select",
    label: "Align",
    options: [
      { label: "Start", value: "start" },
      { label: "Center", value: "center" },
      { label: "End", value: "end" },
      { label: "Stretch", value: "stretch" },
      { label: "Baseline", value: "baseline" },
    ],
  },
  gap: {
    type: "select",
    label: "Gap",
    options: [
      { label: "None", value: "0" },
      { label: "1", value: "1" },
      { label: "2", value: "2" },
      { label: "3", value: "3" },
      { label: "4", value: "4" },
      { label: "6", value: "6" },
      { label: "8", value: "8" },
      { label: "12", value: "12" },
      { label: "16", value: "16" },
    ],
  },
};

export const gridFields: Fields = {
  gridCols: {
    type: "select",
    label: "Columns",
    options: [
      { label: "1", value: "1" },
      { label: "2", value: "2" },
      { label: "3", value: "3" },
      { label: "4", value: "4" },
      { label: "6", value: "6" },
      { label: "12", value: "12" },
    ],
  },
  gridRows: {
    type: "select",
    label: "Rows",
    options: [
      { label: "Auto", value: "auto" },
      { label: "1", value: "1" },
      { label: "2", value: "2" },
      { label: "3", value: "3" },
      { label: "4", value: "4" },
      { label: "6", value: "6" },
    ],
  },
  gap: {
    type: "select",
    label: "Gap",
    options: [
      { label: "None", value: "0" },
      { label: "1", value: "1" },
      { label: "2", value: "2" },
      { label: "3", value: "3" },
      { label: "4", value: "4" },
      { label: "6", value: "6" },
      { label: "8", value: "8" },
      { label: "12", value: "12" },
    ],
  },
};

/**
 * Helper to create a style section in component fields
 */
export function createStyleFields(options: {
  spacing?: boolean;
  colors?: boolean;
  border?: boolean;
  shadow?: boolean;
  typography?: boolean;
  layout?: boolean;
  flex?: boolean;
  grid?: boolean;
} = {}): Fields {
  const fields: Fields = {};

  if (options.spacing) {
    Object.assign(fields, spacingFields);
  }
  if (options.colors) {
    Object.assign(fields, colorFields);
  }
  if (options.border) {
    Object.assign(fields, borderFields);
  }
  if (options.shadow) {
    Object.assign(fields, shadowFields);
  }
  if (options.typography) {
    Object.assign(fields, typographyFields);
  }
  if (options.layout) {
    Object.assign(fields, layoutFields);
  }
  if (options.flex) {
    Object.assign(fields, flexFields);
  }
  if (options.grid) {
    Object.assign(fields, gridFields);
  }

  return fields;
}


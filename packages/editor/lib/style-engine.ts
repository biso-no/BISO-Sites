import { cn } from "./utils";

/**
 * Style Engine - Converts field values to Tailwind classes or inline styles
 */

interface StyleValues {
  // Spacing
  marginTop?: string;
  marginRight?: string;
  marginBottom?: string;
  marginLeft?: string;
  paddingTop?: string;
  paddingRight?: string;
  paddingBottom?: string;
  paddingLeft?: string;

  // Colors
  backgroundColor?: string;
  textColor?: string;
  borderColor?: string;

  // Border
  borderWidth?: string;
  borderRadius?: string;
  borderStyle?: string;

  // Shadow
  shadow?: string;

  // Typography
  fontSize?: string;
  fontWeight?: string;
  textAlign?: string;
  lineHeight?: string;

  // Layout
  display?: string;
  width?: string;
  height?: string;
  maxWidth?: string;

  // Flex
  flexDirection?: string;
  justifyContent?: string;
  alignItems?: string;
  gap?: string;

  // Grid
  gridCols?: string;
  gridRows?: string;

  // Custom
  className?: string;
}

/**
 * Generate Tailwind classes from style values
 */
export function generateClasses(values: StyleValues): string {
  const classes: string[] = [];

  // Spacing - Margin
  if (values.marginTop) classes.push(`mt-[${values.marginTop}]`);
  if (values.marginRight) classes.push(`mr-[${values.marginRight}]`);
  if (values.marginBottom) classes.push(`mb-[${values.marginBottom}]`);
  if (values.marginLeft) classes.push(`ml-[${values.marginLeft}]`);

  // Spacing - Padding
  if (values.paddingTop) classes.push(`pt-[${values.paddingTop}]`);
  if (values.paddingRight) classes.push(`pr-[${values.paddingRight}]`);
  if (values.paddingBottom) classes.push(`pb-[${values.paddingBottom}]`);
  if (values.paddingLeft) classes.push(`pl-[${values.paddingLeft}]`);

  // Colors
  if (values.backgroundColor) {
    // Check if it's a Tailwind color or custom
    if (values.backgroundColor.startsWith("#") || values.backgroundColor.startsWith("rgb")) {
      classes.push(`bg-[${values.backgroundColor}]`);
    } else {
      classes.push(`bg-${values.backgroundColor}`);
    }
  }
  if (values.textColor) {
    if (values.textColor.startsWith("#") || values.textColor.startsWith("rgb")) {
      classes.push(`text-[${values.textColor}]`);
    } else {
      classes.push(`text-${values.textColor}`);
    }
  }
  if (values.borderColor) {
    if (values.borderColor.startsWith("#") || values.borderColor.startsWith("rgb")) {
      classes.push(`border-[${values.borderColor}]`);
    } else {
      classes.push(`border-${values.borderColor}`);
    }
  }

  // Border
  if (values.borderWidth) {
    if (values.borderWidth === "0") {
      classes.push("border-0");
    } else {
      classes.push(`border-${values.borderWidth}`);
    }
  }
  if (values.borderRadius) {
    classes.push(`rounded-${values.borderRadius}`);
  }
  if (values.borderStyle) {
    classes.push(`border-${values.borderStyle}`);
  }

  // Shadow
  if (values.shadow && values.shadow !== "none") {
    classes.push(`shadow-${values.shadow}`);
  }

  // Typography
  if (values.fontSize) classes.push(`text-${values.fontSize}`);
  if (values.fontWeight) classes.push(`font-${values.fontWeight}`);
  if (values.textAlign) classes.push(`text-${values.textAlign}`);
  if (values.lineHeight) classes.push(`leading-${values.lineHeight}`);

  // Layout
  if (values.display) {
    if (values.display === "hidden") {
      classes.push("hidden");
    } else {
      classes.push(values.display);
    }
  }
  if (values.width) classes.push(`w-[${values.width}]`);
  if (values.height) classes.push(`h-[${values.height}]`);
  if (values.maxWidth) classes.push(`max-w-${values.maxWidth}`);

  // Flex
  if (values.flexDirection) classes.push(`flex-${values.flexDirection}`);
  if (values.justifyContent) classes.push(`justify-${values.justifyContent}`);
  if (values.alignItems) classes.push(`items-${values.alignItems}`);
  if (values.gap) classes.push(`gap-${values.gap}`);

  // Grid
  if (values.gridCols) classes.push(`grid-cols-${values.gridCols}`);
  if (values.gridRows && values.gridRows !== "auto") classes.push(`grid-rows-${values.gridRows}`);

  // Custom className
  if (values.className) classes.push(values.className);

  return cn(...classes);
}

/**
 * Generate inline styles for values that can't be expressed as Tailwind classes
 */
export function generateInlineStyles(values: StyleValues): React.CSSProperties {
  const styles: React.CSSProperties = {};

  // Add any styles that need to be inline here
  // This is useful for dynamic values that Tailwind can't handle

  return styles;
}

/**
 * Apply styles to a component
 */
export function applyStyles(values: StyleValues): {
  className: string;
  style: React.CSSProperties;
} {
  return {
    className: generateClasses(values),
    style: generateInlineStyles(values),
  };
}


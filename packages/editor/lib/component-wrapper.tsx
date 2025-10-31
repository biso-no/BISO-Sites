import { ComponentConfig, Fields } from "@measured/puck";
import { EnhancedComponentConfig } from "../types";
import { createStyleFields } from "./style-fields";
import { applyStyles } from "./style-engine";

/**
 * Component Wrapper Utility
 * Automatically wraps UI components with Puck configuration and styling
 */

interface WrapperOptions<TProps extends Record<string, any> = any> {
  category?: string;
  icon?: React.ReactNode;
  previewImage?: string;
  enableStyling?: {
    spacing?: boolean;
    colors?: boolean;
    border?: boolean;
    shadow?: boolean;
    typography?: boolean;
    layout?: boolean;
    flex?: boolean;
    grid?: boolean;
  };
  customFields?: Fields<TProps>;
  defaultProps?: Partial<TProps>;
}

/**
 * Creates a Puck component configuration with automatic styling support
 */
export function createPuckComponent<TProps extends Record<string, any>>(
  Component: React.ComponentType<TProps>,
  componentFields: Fields<TProps>,
  options: WrapperOptions<TProps> = {}
): EnhancedComponentConfig<TProps> {
  const {
    category,
    icon,
    previewImage,
    enableStyling = {},
    customFields = {},
    defaultProps,
  } = options;

  // Merge component fields with style fields
  const styleFields = createStyleFields(enableStyling);
  const allFields: Fields<TProps> = {
    ...componentFields,
    ...styleFields,
    ...customFields,
  } as Fields<TProps>;

  return {
    fields: allFields,
    defaultProps: defaultProps,
    category,
    icon,
    previewImage,
    render: (props: any) => {
      // Extract style-related props
      const {
        marginTop,
        marginRight,
        marginBottom,
        marginLeft,
        paddingTop,
        paddingRight,
        paddingBottom,
        paddingLeft,
        backgroundColor,
        textColor,
        borderColor,
        borderWidth,
        borderRadius,
        borderStyle,
        shadow,
        fontSize,
        fontWeight,
        textAlign,
        lineHeight,
        display,
        width,
        height,
        maxWidth,
        flexDirection,
        justifyContent,
        alignItems,
        gap,
        gridCols,
        gridRows,
        className: customClassName,
        ...componentProps
      } = props;

      // Generate styles
      const { className, style } = applyStyles({
        marginTop,
        marginRight,
        marginBottom,
        marginLeft,
        paddingTop,
        paddingRight,
        paddingBottom,
        paddingLeft,
        backgroundColor,
        textColor,
        borderColor,
        borderWidth,
        borderRadius,
        borderStyle,
        shadow,
        fontSize,
        fontWeight,
        textAlign,
        lineHeight,
        display,
        width,
        height,
        maxWidth,
        flexDirection,
        justifyContent,
        alignItems,
        gap,
        gridCols,
        gridRows,
        className: customClassName,
      });

      // Render component with applied styles
      return (
        <div className={className} style={style}>
          <Component {...(componentProps as TProps)} />
        </div>
      );
    },
  };
}

/**
 * Quick wrapper for simple components that just need text content
 */
export function createTextComponent<TProps extends { children: React.ReactNode; className?: string } = { children: React.ReactNode; className?: string }>(
  Component: React.ComponentType<TProps>,
  options: WrapperOptions<TProps> & { label?: string } = {}
): EnhancedComponentConfig<TProps> {
  return createPuckComponent(
    Component,
    {
      children: {
        type: "textarea",
        label: options.label || "Content",
      },
    } as Fields<TProps>,
    options
  );
}

/**
 * Wrapper for components with variants (like shadcn components)
 */
export function createVariantComponent<TProps extends { variant?: string }>(
  Component: React.ComponentType<TProps>,
  componentFields: Fields<TProps>,
  variants: Array<{ label: string; value: string }>,
  options: WrapperOptions<TProps> = {}
): EnhancedComponentConfig<TProps> {
  const fieldsWithVariant: Fields<TProps> = {
    variant: {
      type: "select",
      label: "Variant",
      options: variants,
    },
    ...componentFields,
  } as Fields<TProps>;

  return createPuckComponent(Component, fieldsWithVariant, options);
}

/**
 * Helper to extract and apply only component-specific props
 */
export function extractComponentProps<T>(
  props: any,
  componentPropKeys: string[]
): T {
  const componentProps: any = {};
  componentPropKeys.forEach((key) => {
    if (key in props) {
      componentProps[key] = props[key];
    }
  });
  return componentProps as T;
}


import { Button as UIButton } from "@repo/ui/components/ui/button";
import { EnhancedComponentConfig } from "../../types";
import { applyStyles } from "../../lib/style-engine";

interface ButtonProps {
  text: string;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | "glass" | "glass-dark" | "gradient" | "glow" | "golden-gradient" | "animated";
  size?: "default" | "sm" | "lg" | "xl" | "icon";
  href?: string;
  openInNewTab?: boolean;
  
  // Styling
  marginTop?: string;
  marginRight?: string;
  marginBottom?: string;
  marginLeft?: string;
  paddingTop?: string;
  paddingRight?: string;
  paddingBottom?: string;
  paddingLeft?: string;
  backgroundColor?: string;
  textColor?: string;
  borderColor?: string;
  borderWidth?: string;
  borderRadius?: string;
  borderStyle?: string;
  shadow?: string;
  fontSize?: string;
  fontWeight?: string;
  width?: string;
  className?: string;
}

export const PuckButton: EnhancedComponentConfig<ButtonProps> = {
  category: "UI Elements",
  fields: {
    text: {
      type: "text",
      label: "Button Text",
    },
    variant: {
      type: "select",
      label: "Variant",
      options: [
        { label: "Default", value: "default" },
        { label: "Destructive", value: "destructive" },
        { label: "Outline", value: "outline" },
        { label: "Secondary", value: "secondary" },
        { label: "Ghost", value: "ghost" },
        { label: "Link", value: "link" },
        { label: "Glass", value: "glass" },
        { label: "Glass Dark", value: "glass-dark" },
        { label: "Gradient", value: "gradient" },
        { label: "Glow", value: "glow" },
        { label: "Golden Gradient", value: "golden-gradient" },
        { label: "Animated", value: "animated" },
      ],
    },
    size: {
      type: "select",
      label: "Size",
      options: [
        { label: "Default", value: "default" },
        { label: "Small", value: "sm" },
        { label: "Large", value: "lg" },
        { label: "Extra Large", value: "xl" },
        { label: "Icon", value: "icon" },
      ],
    },
    href: {
      type: "text",
      label: "Link URL",
    },
    openInNewTab: {
      type: "radio",
      label: "Open in New Tab",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },
    // Spacing
    marginTop: { type: "text", label: "Margin Top" },
    marginRight: { type: "text", label: "Margin Right" },
    marginBottom: { type: "text", label: "Margin Bottom" },
    marginLeft: { type: "text", label: "Margin Left" },
    // Colors
    backgroundColor: { type: "text", label: "Background Color" },
    textColor: { type: "text", label: "Text Color" },
    // Border
    borderWidth: {
      type: "select",
      label: "Border Width",
      options: [
        { label: "None", value: "0" },
        { label: "1px", value: "1" },
        { label: "2px", value: "2" },
        { label: "4px", value: "4" },
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
        { label: "Full", value: "full" },
      ],
    },
    // Shadow
    shadow: {
      type: "select",
      label: "Shadow",
      options: [
        { label: "None", value: "none" },
        { label: "Small", value: "sm" },
        { label: "Medium", value: "md" },
        { label: "Large", value: "lg" },
        { label: "XL", value: "xl" },
      ],
    },
    // Typography
    fontSize: {
      type: "select",
      label: "Font Size",
      options: [
        { label: "Small", value: "sm" },
        { label: "Base", value: "base" },
        { label: "Large", value: "lg" },
        { label: "XL", value: "xl" },
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
      ],
    },
    width: { type: "text", label: "Width" },
    className: { type: "text", label: "Custom Classes" },
  },
  defaultProps: {
    text: "Click me",
    variant: "default",
    size: "default",
    openInNewTab: false,
  },
  render: (props) => {
    const {
      text,
      variant,
      size,
      href,
      openInNewTab,
      marginTop,
      marginRight,
      marginBottom,
      marginLeft,
      backgroundColor,
      textColor,
      borderWidth,
      borderRadius,
      shadow,
      fontSize,
      fontWeight,
      width,
      className: customClassName,
    } = props;

    const { className, style } = applyStyles({
      marginTop,
      marginRight,
      marginBottom,
      marginLeft,
      backgroundColor,
      textColor,
      borderWidth,
      borderRadius,
      shadow,
      fontSize,
      fontWeight,
      width,
      className: customClassName,
    });

    const buttonContent = (
      <UIButton
        variant={variant}
        size={size}
        className={className}
        style={style}
        asChild={!!href}
      >
        {href ? (
          <a
            href={href}
            target={openInNewTab ? "_blank" : undefined}
            rel={openInNewTab ? "noopener noreferrer" : undefined}
          >
            {text}
          </a>
        ) : (
          text
        )}
      </UIButton>
    );

    return buttonContent;
  },
};


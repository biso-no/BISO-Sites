import { Badge as UIBadge } from "@repo/ui/components/ui/badge";
import { EnhancedComponentConfig } from "../../types";
import { applyStyles } from "../../lib/style-engine";

interface BadgeProps {
  text: string;
  variant?: "default" | "secondary" | "destructive" | "outline" | "glass-dark" | "gradient" | "gold" | "purple" | "green";

  // Styling
  marginTop?: string;
  marginRight?: string;
  marginBottom?: string;
  marginLeft?: string;
  backgroundColor?: string;
  textColor?: string;
  borderRadius?: string;
  fontSize?: string;
  fontWeight?: string;
  className?: string;
}

export const PuckBadge: EnhancedComponentConfig<BadgeProps> = {
  category: "UI Elements",
  fields: {
    text: {
      type: "text",
      label: "Badge Text",
    },
    variant: {
      type: "select",
      label: "Variant",
      options: [
        { label: "Default", value: "default" },
        { label: "Secondary", value: "secondary" },
        { label: "Destructive", value: "destructive" },
        { label: "Outline", value: "outline" },
        { label: "Glass Dark", value: "glass-dark" },
        { label: "Gradient", value: "gradient" },
        { label: "Gold", value: "gold" },
        { label: "Purple", value: "purple" },
        { label: "Green", value: "green" },
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
    // Typography
    fontSize: {
      type: "select",
      label: "Font Size",
      options: [
        { label: "XS", value: "xs" },
        { label: "SM", value: "sm" },
        { label: "Base", value: "base" },
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
    className: { type: "text", label: "Custom Classes" },
  },
  defaultProps: {
    text: "Badge",
    variant: "default",
  },
  render: (props: BadgeProps) => {
    const {
      text,
      variant,
      marginTop,
      marginRight,
      marginBottom,
      marginLeft,
      backgroundColor,
      textColor,
      fontSize,
      fontWeight,
      className: customClassName,
    } = props;

    const { className, style } = applyStyles({
      marginTop,
      marginRight,
      marginBottom,
      marginLeft,
      backgroundColor,
      textColor,
      fontSize,
      fontWeight,
      className: customClassName,
    });

    return (
      <div className={className} style={style}>
        <UIBadge variant={variant}>{text}</UIBadge>
      </div>
    );
  },
};


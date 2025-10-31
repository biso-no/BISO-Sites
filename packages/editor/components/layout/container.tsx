import { EnhancedComponentConfig } from "../../types";
import { applyStyles } from "../../lib/style-engine";

interface ContainerProps {
  children: any;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
  centerContent?: boolean;
  
  // Styling
  paddingTop?: string;
  paddingBottom?: string;
  paddingLeft?: string;
  paddingRight?: string;
  marginTop?: string;
  marginBottom?: string;
  backgroundColor?: string;
  textColor?: string;
  borderWidth?: string;
  borderRadius?: string;
  shadow?: string;
  className?: string;
}

export const PuckContainer: EnhancedComponentConfig<ContainerProps> = {
  category: "Layout",
  fields: {
    maxWidth: {
      type: "select",
      label: "Max Width",
      options: [
        { label: "SM (640px)", value: "sm" },
        { label: "MD (768px)", value: "md" },
        { label: "LG (1024px)", value: "lg" },
        { label: "XL (1280px)", value: "xl" },
        { label: "2XL (1536px)", value: "2xl" },
        { label: "Full", value: "full" },
      ],
    },
    centerContent: {
      type: "radio",
      label: "Center Content",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },
    // Spacing
    paddingTop: { type: "text", label: "Padding Top" },
    paddingBottom: { type: "text", label: "Padding Bottom" },
    paddingLeft: { type: "text", label: "Padding Left" },
    paddingRight: { type: "text", label: "Padding Right" },
    marginTop: { type: "text", label: "Margin Top" },
    marginBottom: { type: "text", label: "Margin Bottom" },
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
      ],
    },
    className: { type: "text", label: "Custom Classes" },
  },
  defaultProps: {
    maxWidth: "lg",
    centerContent: false,
    paddingLeft: "16px",
    paddingRight: "16px",
  },
  render: (props) => {
    const {
      children,
      maxWidth,
      centerContent,
      paddingTop,
      paddingBottom,
      paddingLeft,
      paddingRight,
      marginTop,
      marginBottom,
      backgroundColor,
      textColor,
      borderWidth,
      borderRadius,
      shadow,
      className: customClassName,
    } = props;

    const { className, style } = applyStyles({
      paddingTop,
      paddingBottom,
      paddingLeft,
      paddingRight,
      marginTop,
      marginBottom,
      backgroundColor,
      textColor,
      borderWidth,
      borderRadius,
      shadow,
      maxWidth,
      className: customClassName,
    });

    return (
      <div className={`container mx-auto ${centerContent ? "flex items-center justify-center" : ""} ${className}`} style={style}>
        {children}
      </div>
    );
  },
};


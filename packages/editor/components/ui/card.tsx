import {
  Card as UICard,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@repo/ui/components/ui/card";
import { EnhancedComponentConfig } from "../../types";
import { applyStyles } from "../../lib/style-engine";

interface CardProps {
  variant?: "default" | "glass" | "glass-dark" | "gradient" | "gradient-border" | "animated" | "golden";
  title?: string;
  description?: string;
  content: string;
  footerContent?: string;
  showHeader?: boolean;
  showFooter?: boolean;

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
  borderWidth?: string;
  borderRadius?: string;
  shadow?: string;
  width?: string;
  maxWidth?: string;
  className?: string;
}

export const PuckCard: EnhancedComponentConfig<CardProps> = {
  category: "UI Elements",
  fields: {
    variant: {
      type: "select",
      label: "Variant",
      options: [
        { label: "Default", value: "default" },
        { label: "Glass", value: "glass" },
        { label: "Glass Dark", value: "glass-dark" },
        { label: "Gradient", value: "gradient" },
        { label: "Gradient Border", value: "gradient-border" },
        { label: "Animated", value: "animated" },
        { label: "Golden", value: "golden" },
      ],
    },
    showHeader: {
      type: "radio",
      label: "Show Header",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },
    title: {
      type: "text",
      label: "Title",
    },
    description: {
      type: "textarea",
      label: "Description",
    },
    content: {
      type: "textarea",
      label: "Content",
    },
    showFooter: {
      type: "radio",
      label: "Show Footer",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },
    footerContent: {
      type: "text",
      label: "Footer Content",
    },
    // Spacing
    marginTop: { type: "text", label: "Margin Top" },
    marginRight: { type: "text", label: "Margin Right" },
    marginBottom: { type: "text", label: "Margin Bottom" },
    marginLeft: { type: "text", label: "Margin Left" },
    paddingTop: { type: "text", label: "Padding Top" },
    paddingRight: { type: "text", label: "Padding Right" },
    paddingBottom: { type: "text", label: "Padding Bottom" },
    paddingLeft: { type: "text", label: "Padding Left" },
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
        { label: "2XL", value: "2xl" },
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
    width: { type: "text", label: "Width" },
    maxWidth: {
      type: "select",
      label: "Max Width",
      options: [
        { label: "None", value: "none" },
        { label: "SM", value: "sm" },
        { label: "MD", value: "md" },
        { label: "LG", value: "lg" },
        { label: "XL", value: "xl" },
        { label: "Full", value: "full" },
      ],
    },
    className: { type: "text", label: "Custom Classes" },
  },
  defaultProps: {
    variant: "default",
    showHeader: true,
    showFooter: false,
    title: "Card Title",
    description: "Card description goes here",
    content: "Card content goes here. You can add any text or information.",
  },
  render: (props) => {
    const {
      variant,
      title,
      description,
      content,
      footerContent,
      showHeader,
      showFooter,
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
      borderWidth,
      borderRadius,
      shadow,
      width,
      maxWidth,
      className: customClassName,
    } = props;

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
      borderWidth,
      borderRadius,
      shadow,
      width,
      maxWidth,
      className: customClassName,
    });

    return (
      <div className={className} style={style}>
        <UICard variant={variant}>
          {showHeader && (title || description) && (
            <CardHeader>
              {title && <CardTitle>{title}</CardTitle>}
              {description && <CardDescription>{description}</CardDescription>}
            </CardHeader>
          )}
          <CardContent>
            <p>{content}</p>
          </CardContent>
          {showFooter && footerContent && (
            <CardFooter>
              <p>{footerContent}</p>
            </CardFooter>
          )}
        </UICard>
      </div>
    );
  },
};


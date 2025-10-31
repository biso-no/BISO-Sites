import { Alert as UIAlert, AlertTitle, AlertDescription } from "@repo/ui/components/ui/alert";
import { EnhancedComponentConfig } from "../../types";
import { applyStyles } from "../../lib/style-engine";

interface AlertProps {
  variant?: "default" | "destructive";
  title?: string;
  description: string;
  showTitle?: boolean;

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
  width?: string;
  className?: string;
}

export const PuckAlert: EnhancedComponentConfig<AlertProps> = {
  category: "UI Elements",
  fields: {
    variant: {
      type: "select",
      label: "Variant",
      options: [
        { label: "Default", value: "default" },
        { label: "Destructive", value: "destructive" },
      ],
    },
    showTitle: {
      type: "radio",
      label: "Show Title",
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
      ],
    },
    width: { type: "text", label: "Width" },
    className: { type: "text", label: "Custom Classes" },
  },
  defaultProps: {
    variant: "default",
    showTitle: true,
    title: "Heads up!",
    description: "You can add components to your app using the cli.",
  },
  render: (props: AlertProps) => {
    const {
      variant,
      title,
      description,
      showTitle,
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
      width,
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
      width,
      className: customClassName,
    });

    return (
      <div className={className} style={style}>
        <UIAlert variant={variant}>
          {showTitle && title && <AlertTitle>{title}</AlertTitle>}
          <AlertDescription>{description}</AlertDescription>
        </UIAlert>
      </div>
    );
  },
};


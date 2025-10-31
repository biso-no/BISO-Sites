import { EnhancedComponentConfig } from "../../types";
import { applyStyles } from "../../lib/style-engine";

interface CTAProps {
  title: string;
  description?: string;
  primaryButtonText: string;
  primaryButtonLink: string;
  showSecondaryButton?: boolean;
  secondaryButtonText?: string;
  secondaryButtonLink?: string;
  layout?: "vertical" | "horizontal";
  
  // Styling
  paddingTop?: string;
  paddingBottom?: string;
  paddingLeft?: string;
  paddingRight?: string;
  backgroundColor?: string;
  textColor?: string;
  borderRadius?: string;
  textAlign?: "left" | "center" | "right";
  className?: string;
}

export const PuckCTA: EnhancedComponentConfig<CTAProps> = {
  category: "Content Blocks",
  fields: {
    title: {
      type: "textarea",
      label: "Title",
    },
    description: {
      type: "textarea",
      label: "Description",
    },
    primaryButtonText: {
      type: "text",
      label: "Primary Button Text",
    },
    primaryButtonLink: {
      type: "text",
      label: "Primary Button Link",
    },
    showSecondaryButton: {
      type: "radio",
      label: "Show Secondary Button",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },
    secondaryButtonText: {
      type: "text",
      label: "Secondary Button Text",
    },
    secondaryButtonLink: {
      type: "text",
      label: "Secondary Button Link",
    },
    layout: {
      type: "radio",
      label: "Layout",
      options: [
        { label: "Vertical", value: "vertical" },
        { label: "Horizontal", value: "horizontal" },
      ],
    },
    textAlign: {
      type: "radio",
      label: "Text Alignment",
      options: [
        { label: "Left", value: "left" },
        { label: "Center", value: "center" },
        { label: "Right", value: "right" },
      ],
    },
    // Spacing
    paddingTop: { type: "text", label: "Padding Top" },
    paddingBottom: { type: "text", label: "Padding Bottom" },
    paddingLeft: { type: "text", label: "Padding Left" },
    paddingRight: { type: "text", label: "Padding Right" },
    // Colors
    backgroundColor: { type: "text", label: "Background Color" },
    textColor: { type: "text", label: "Text Color" },
    // Border
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
    className: { type: "text", label: "Custom Classes" },
  },
  defaultProps: {
    title: "Ready to get started?",
    description: "Join thousands of users who are already using our platform.",
    primaryButtonText: "Get Started",
    primaryButtonLink: "#",
    showSecondaryButton: true,
    secondaryButtonText: "Learn More",
    secondaryButtonLink: "#",
    layout: "vertical",
    textAlign: "center",
    paddingTop: "48px",
    paddingBottom: "48px",
    paddingLeft: "24px",
    paddingRight: "24px",
  },
  render: (props) => {
    const {
      title,
      description,
      primaryButtonText,
      primaryButtonLink,
      showSecondaryButton,
      secondaryButtonText,
      secondaryButtonLink,
      layout,
      textAlign,
      paddingTop,
      paddingBottom,
      paddingLeft,
      paddingRight,
      backgroundColor,
      textColor,
      borderRadius,
      className: customClassName,
    } = props;

    const { className, style } = applyStyles({
      paddingTop,
      paddingBottom,
      paddingLeft,
      paddingRight,
      backgroundColor,
      textColor,
      borderRadius,
      textAlign,
      className: customClassName,
    });

    return (
      <div className={`${className}`} style={style}>
        <div className={`${layout === "vertical" ? "space-y-6" : "flex items-center justify-between gap-6"}`}>
          <div className={layout === "horizontal" ? "flex-1" : ""}>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">{title}</h2>
            {description && (
              <p className="text-lg opacity-80">{description}</p>
            )}
          </div>
          <div className={`flex gap-4 ${textAlign === "center" ? "justify-center" : textAlign === "right" ? "justify-end" : ""}`}>
            <a
              href={primaryButtonLink}
              className="inline-block bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity"
            >
              {primaryButtonText}
            </a>
            {showSecondaryButton && secondaryButtonText && (
              <a
                href={secondaryButtonLink}
                className="inline-block border-2 border-current px-6 py-3 rounded-lg font-semibold hover:opacity-80 transition-opacity"
              >
                {secondaryButtonText}
              </a>
            )}
          </div>
        </div>
      </div>
    );
  },
};


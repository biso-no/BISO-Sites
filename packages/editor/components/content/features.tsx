import { EnhancedComponentConfig } from "../../types";
import { applyStyles } from "../../lib/style-engine";

interface FeaturesProps {
  title?: string;
  description?: string;
  showTitle?: boolean;
  features: Array<{
    title: string;
    description: string;
    icon?: string;
  }>;
  columns?: "2" | "3" | "4";
  
  // Styling
  paddingTop?: string;
  paddingBottom?: string;
  paddingLeft?: string;
  paddingRight?: string;
  backgroundColor?: string;
  textColor?: string;
  gap?: string;
  textAlign?: "left" | "center";
  className?: string;
}

export const PuckFeatures: EnhancedComponentConfig<FeaturesProps> = {
  category: "Content Blocks",
  fields: {
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
    features: {
      type: "array",
      label: "Features",
      arrayFields: {
        title: {
          type: "text",
          label: "Feature Title",
        },
        description: {
          type: "textarea",
          label: "Feature Description",
        },
        icon: {
          type: "text",
          label: "Icon (emoji or URL)",
        },
      },
      defaultItemProps: {
        title: "Amazing Feature",
        description: "This feature will help you achieve great results.",
        icon: "✨",
      },
    },
    columns: {
      type: "select",
      label: "Columns",
      options: [
        { label: "2", value: "2" },
        { label: "3", value: "3" },
        { label: "4", value: "4" },
      ],
    },
    textAlign: {
      type: "radio",
      label: "Text Alignment",
      options: [
        { label: "Left", value: "left" },
        { label: "Center", value: "center" },
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
    gap: {
      type: "select",
      label: "Gap Between Features",
      options: [
        { label: "2", value: "2" },
        { label: "4", value: "4" },
        { label: "6", value: "6" },
        { label: "8", value: "8" },
      ],
    },
    className: { type: "text", label: "Custom Classes" },
  },
  defaultProps: {
    showTitle: true,
    title: "Our Features",
    description: "Everything you need to build amazing products.",
    features: [
      {
        title: "Fast Performance",
        description: "Blazing fast speed to keep your users happy.",
        icon: "⚡",
      },
      {
        title: "Easy to Use",
        description: "Intuitive interface that anyone can master.",
        icon: "🎯",
      },
      {
        title: "Secure",
        description: "Enterprise-grade security to protect your data.",
        icon: "🔒",
      },
    ],
    columns: "3",
    textAlign: "center",
    paddingTop: "64px",
    paddingBottom: "64px",
    gap: "6",
  },
  render: (props) => {
    const {
      title,
      description,
      showTitle,
      features = [],
      columns,
      textAlign,
      paddingTop,
      paddingBottom,
      paddingLeft,
      paddingRight,
      backgroundColor,
      textColor,
      gap,
      className: customClassName,
    } = props;

    const { className, style } = applyStyles({
      paddingTop,
      paddingBottom,
      paddingLeft,
      paddingRight,
      backgroundColor,
      textColor,
      className: customClassName,
    });

    return (
      <div className={className} style={style}>
        {showTitle && (title || description) && (
          <div className={`max-w-3xl ${textAlign === "center" ? "mx-auto text-center" : ""} mb-12`}>
            {title && (
              <h2 className="text-3xl md:text-4xl font-bold mb-4">{title}</h2>
            )}
            {description && (
              <p className="text-lg opacity-80">{description}</p>
            )}
          </div>
        )}
        <div className={`grid grid-cols-1 md:grid-cols-${columns} gap-${gap}`}>
          {features.map((feature, index) => (
            <div
              key={index}
              className={`p-6 ${textAlign === "center" ? "text-center" : ""}`}
            >
              {feature.icon && (
                <div className={`text-4xl mb-4 ${textAlign === "center" ? "flex justify-center" : ""}`}>
                  {feature.icon.startsWith("http") ? (
                    <img
                      src={feature.icon}
                      alt={feature.title}
                      className="w-12 h-12 object-contain"
                    />
                  ) : (
                    <span>{feature.icon}</span>
                  )}
                </div>
              )}
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="opacity-80">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    );
  },
};


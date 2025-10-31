import { EnhancedComponentConfig } from "../../types";
import { applyStyles } from "../../lib/style-engine";

interface SectionProps {
  children: any;
  fullWidth?: boolean;
  backgroundImage?: string;
  backgroundSize?: "cover" | "contain" | "auto";
  backgroundPosition?: "center" | "top" | "bottom" | "left" | "right";
  overlay?: boolean;
  overlayOpacity?: string;
  
  // Styling
  paddingTop?: string;
  paddingBottom?: string;
  paddingLeft?: string;
  paddingRight?: string;
  marginTop?: string;
  marginBottom?: string;
  backgroundColor?: string;
  textColor?: string;
  minHeight?: string;
  className?: string;
}

export const PuckSection: EnhancedComponentConfig<SectionProps> = {
  category: "Layout",
  fields: {
    fullWidth: {
      type: "radio",
      label: "Full Width",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },
    backgroundImage: {
      type: "text",
      label: "Background Image URL",
    },
    backgroundSize: {
      type: "select",
      label: "Background Size",
      options: [
        { label: "Cover", value: "cover" },
        { label: "Contain", value: "contain" },
        { label: "Auto", value: "auto" },
      ],
    },
    backgroundPosition: {
      type: "select",
      label: "Background Position",
      options: [
        { label: "Center", value: "center" },
        { label: "Top", value: "top" },
        { label: "Bottom", value: "bottom" },
        { label: "Left", value: "left" },
        { label: "Right", value: "right" },
      ],
    },
    overlay: {
      type: "radio",
      label: "Dark Overlay",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },
    overlayOpacity: {
      type: "select",
      label: "Overlay Opacity",
      options: [
        { label: "10%", value: "0.1" },
        { label: "20%", value: "0.2" },
        { label: "30%", value: "0.3" },
        { label: "40%", value: "0.4" },
        { label: "50%", value: "0.5" },
        { label: "60%", value: "0.6" },
        { label: "70%", value: "0.7" },
      ],
    },
    // Spacing
    paddingTop: { type: "text", label: "Padding Top (e.g., 64px, 4rem)" },
    paddingBottom: { type: "text", label: "Padding Bottom" },
    paddingLeft: { type: "text", label: "Padding Left" },
    paddingRight: { type: "text", label: "Padding Right" },
    marginTop: { type: "text", label: "Margin Top" },
    marginBottom: { type: "text", label: "Margin Bottom" },
    // Colors
    backgroundColor: { type: "text", label: "Background Color" },
    textColor: { type: "text", label: "Text Color" },
    // Layout
    minHeight: { type: "text", label: "Min Height (e.g., 400px, 50vh)" },
    className: { type: "text", label: "Custom Classes" },
  },
  defaultProps: {
    fullWidth: false,
    overlay: false,
    overlayOpacity: "0.5",
    backgroundSize: "cover",
    backgroundPosition: "center",
    paddingTop: "64px",
    paddingBottom: "64px",
  },
  render: (props) => {
    const {
      children,
      fullWidth,
      backgroundImage,
      backgroundSize,
      backgroundPosition,
      overlay,
      overlayOpacity,
      paddingTop,
      paddingBottom,
      paddingLeft,
      paddingRight,
      marginTop,
      marginBottom,
      backgroundColor,
      textColor,
      minHeight,
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
      className: customClassName,
    });

    const sectionStyle: React.CSSProperties = {
      ...style,
      backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
      backgroundSize,
      backgroundPosition,
      minHeight,
      position: "relative",
    };

    return (
      <section className={`w-full ${className}`} style={sectionStyle}>
        {overlay && backgroundImage && (
          <div
            className="absolute inset-0 bg-black pointer-events-none"
            style={{ opacity: overlayOpacity }}
          />
        )}
        <div className={`relative z-10 ${fullWidth ? "w-full" : "container mx-auto px-4"}`}>
          {children}
        </div>
      </section>
    );
  },
};


import { EnhancedComponentConfig } from "../../types";
import { applyStyles } from "../../lib/style-engine";

interface HeroProps {
  title: string;
  subtitle?: string;
  description?: string;
  showCTA?: boolean;
  ctaText?: string;
  ctaLink?: string;
  backgroundImage?: string;
  backgroundSize?: "cover" | "contain" | "auto";
  backgroundPosition?: "center" | "top" | "bottom";
  overlay?: boolean;
  overlayOpacity?: string;
  textAlign?: "left" | "center" | "right";
  
  // Styling
  paddingTop?: string;
  paddingBottom?: string;
  backgroundColor?: string;
  textColor?: string;
  minHeight?: string;
  className?: string;
}

export const PuckHero: EnhancedComponentConfig<HeroProps> = {
  category: "Content Blocks",
  fields: {
    title: {
      type: "textarea",
      label: "Title",
    },
    subtitle: {
      type: "text",
      label: "Subtitle",
    },
    description: {
      type: "textarea",
      label: "Description",
    },
    showCTA: {
      type: "radio",
      label: "Show CTA Button",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },
    ctaText: {
      type: "text",
      label: "CTA Button Text",
    },
    ctaLink: {
      type: "text",
      label: "CTA Button Link",
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
        { label: "20%", value: "0.2" },
        { label: "30%", value: "0.3" },
        { label: "40%", value: "0.4" },
        { label: "50%", value: "0.5" },
        { label: "60%", value: "0.6" },
        { label: "70%", value: "0.7" },
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
    paddingTop: { type: "text", label: "Padding Top (e.g., 120px)" },
    paddingBottom: { type: "text", label: "Padding Bottom" },
    // Colors
    backgroundColor: { type: "text", label: "Background Color" },
    textColor: { type: "text", label: "Text Color" },
    // Layout
    minHeight: { type: "text", label: "Min Height (e.g., 600px, 100vh)" },
    className: { type: "text", label: "Custom Classes" },
  },
  defaultProps: {
    title: "Welcome to Our Platform",
    subtitle: "Build Something Amazing",
    description: "Create beautiful pages with our powerful page builder",
    showCTA: true,
    ctaText: "Get Started",
    ctaLink: "#",
    backgroundSize: "cover",
    backgroundPosition: "center",
    overlay: true,
    overlayOpacity: "0.5",
    textAlign: "center",
    paddingTop: "120px",
    paddingBottom: "120px",
    minHeight: "600px",
  },
  render: (props) => {
    const {
      title,
      subtitle,
      description,
      showCTA,
      ctaText,
      ctaLink,
      backgroundImage,
      backgroundSize,
      backgroundPosition,
      overlay,
      overlayOpacity,
      textAlign,
      paddingTop,
      paddingBottom,
      backgroundColor,
      textColor,
      minHeight,
      className: customClassName,
    } = props;

    const { className, style } = applyStyles({
      paddingTop,
      paddingBottom,
      backgroundColor,
      textColor,
      textAlign,
      className: customClassName,
    });

    const heroStyle: React.CSSProperties = {
      ...style,
      backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
      backgroundSize,
      backgroundPosition,
      minHeight,
      position: "relative",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    };

    return (
      <section className={`w-full ${className}`} style={heroStyle}>
        {overlay && backgroundImage && (
          <div
            className="absolute inset-0 bg-black pointer-events-none"
            style={{ opacity: overlayOpacity }}
          />
        )}
        <div className="container mx-auto px-4 relative z-10">
          <div className={`max-w-4xl ${textAlign === "center" ? "mx-auto" : ""}`}>
            {subtitle && (
              <p className="text-lg md:text-xl font-medium mb-4 opacity-90">
                {subtitle}
              </p>
            )}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
              {title}
            </h1>
            {description && (
              <p className="text-lg md:text-xl mb-8 opacity-80">
                {description}
              </p>
            )}
            {showCTA && ctaText && (
              <a
                href={ctaLink}
                className="inline-block bg-primary text-primary-foreground px-8 py-4 rounded-lg text-lg font-semibold hover:opacity-90 transition-opacity"
              >
                {ctaText}
              </a>
            )}
          </div>
        </div>
      </section>
    );
  },
};


import { Input as UIInput } from "@repo/ui/components/ui/input";
import { EnhancedComponentConfig } from "../../types";
import { applyStyles } from "../../lib/style-engine";

interface InputProps {
  type?: "text" | "email" | "password" | "number" | "tel" | "url";
  placeholder?: string;
  label?: string;
  showLabel?: boolean;
  required?: boolean;
  disabled?: boolean;

  // Styling
  marginTop?: string;
  marginRight?: string;
  marginBottom?: string;
  marginLeft?: string;
  width?: string;
  maxWidth?: string;
  backgroundColor?: string;
  textColor?: string;
  borderWidth?: string;
  borderRadius?: string;
  fontSize?: string;
  className?: string;
}

export const PuckInput: EnhancedComponentConfig<InputProps> = {
  category: "Form Elements",
  fields: {
    type: {
      type: "select",
      label: "Input Type",
      options: [
        { label: "Text", value: "text" },
        { label: "Email", value: "email" },
        { label: "Password", value: "password" },
        { label: "Number", value: "number" },
        { label: "Tel", value: "tel" },
        { label: "URL", value: "url" },
      ],
    },
    showLabel: {
      type: "radio",
      label: "Show Label",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },
    label: {
      type: "text",
      label: "Label",
    },
    placeholder: {
      type: "text",
      label: "Placeholder",
    },
    required: {
      type: "radio",
      label: "Required",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },
    disabled: {
      type: "radio",
      label: "Disabled",
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
    // Layout
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
    // Typography
    fontSize: {
      type: "select",
      label: "Font Size",
      options: [
        { label: "SM", value: "sm" },
        { label: "Base", value: "base" },
        { label: "LG", value: "lg" },
      ],
    },
    className: { type: "text", label: "Custom Classes" },
  },
  defaultProps: {
    type: "text",
    showLabel: false,
    placeholder: "Enter text...",
    required: false,
    disabled: false,
  },
  render: (props) => {
    const {
      type,
      placeholder,
      label,
      showLabel,
      required,
      disabled,
      marginTop,
      marginRight,
      marginBottom,
      marginLeft,
      width,
      maxWidth,
      backgroundColor,
      textColor,
      borderWidth,
      borderRadius,
      fontSize,
      className: customClassName,
    } = props;

    const { className, style } = applyStyles({
      marginTop,
      marginRight,
      marginBottom,
      marginLeft,
      width,
      maxWidth,
      backgroundColor,
      textColor,
      borderWidth,
      borderRadius,
      fontSize,
      className: customClassName,
    });

    return (
      <div className={className} style={style}>
        {showLabel && label && (
          <label className="block text-sm font-medium mb-2">
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        <UIInput
          type={type}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
        />
      </div>
    );
  },
};


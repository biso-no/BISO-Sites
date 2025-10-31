import { EnhancedComponentConfig } from "../../types";
import { applyStyles } from "../../lib/style-engine";

interface ColumnsProps {
  children: any;
  columns?: "1" | "2" | "3" | "4" | "6";
  gap?: "0" | "1" | "2" | "3" | "4" | "6" | "8" | "12";
  responsive?: boolean;
  verticalAlign?: "start" | "center" | "end" | "stretch";
  
  // Styling
  paddingTop?: string;
  paddingBottom?: string;
  paddingLeft?: string;
  paddingRight?: string;
  marginTop?: string;
  marginBottom?: string;
  backgroundColor?: string;
  borderRadius?: string;
  className?: string;
}

export const PuckColumns: EnhancedComponentConfig<ColumnsProps> = {
  category: "Layout",
  fields: {
    columns: {
      type: "select",
      label: "Number of Columns",
      options: [
        { label: "1", value: "1" },
        { label: "2", value: "2" },
        { label: "3", value: "3" },
        { label: "4", value: "4" },
        { label: "6", value: "6" },
      ],
    },
    gap: {
      type: "select",
      label: "Gap Between Columns",
      options: [
        { label: "None", value: "0" },
        { label: "1", value: "1" },
        { label: "2", value: "2" },
        { label: "3", value: "3" },
        { label: "4", value: "4" },
        { label: "6", value: "6" },
        { label: "8", value: "8" },
        { label: "12", value: "12" },
      ],
    },
    responsive: {
      type: "radio",
      label: "Responsive (Stack on Mobile)",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },
    verticalAlign: {
      type: "select",
      label: "Vertical Alignment",
      options: [
        { label: "Start", value: "start" },
        { label: "Center", value: "center" },
        { label: "End", value: "end" },
        { label: "Stretch", value: "stretch" },
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
    // Border
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
    className: { type: "text", label: "Custom Classes" },
  },
  defaultProps: {
    columns: "2",
    gap: "4",
    responsive: true,
    verticalAlign: "start",
  },
  render: (props) => {
    const {
      children,
      columns,
      gap,
      responsive,
      verticalAlign,
      paddingTop,
      paddingBottom,
      paddingLeft,
      paddingRight,
      marginTop,
      marginBottom,
      backgroundColor,
      borderRadius,
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
      borderRadius,
      gap,
      gridCols: columns,
      className: customClassName,
    });

    const responsiveClass = responsive ? `grid-cols-1 md:grid-cols-${columns}` : `grid-cols-${columns}`;
    const alignClass = `items-${verticalAlign}`;

    return (
      <div className={`grid ${responsiveClass} ${alignClass} ${className}`} style={style}>
        {children}
      </div>
    );
  },
};


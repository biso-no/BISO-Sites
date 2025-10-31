import { EnhancedComponentConfig } from "../../types";
import { applyStyles } from "../../lib/style-engine";

interface GridProps {
  children: any;
  columns?: "1" | "2" | "3" | "4" | "6" | "12";
  rows?: "auto" | "1" | "2" | "3" | "4" | "6";
  gap?: "0" | "1" | "2" | "3" | "4" | "6" | "8" | "12";
  alignItems?: "start" | "center" | "end" | "stretch";
  justifyItems?: "start" | "center" | "end" | "stretch";
  autoFlow?: "row" | "col" | "dense";
  
  // Styling
  paddingTop?: string;
  paddingBottom?: string;
  paddingLeft?: string;
  paddingRight?: string;
  marginTop?: string;
  marginBottom?: string;
  backgroundColor?: string;
  borderRadius?: string;
  minHeight?: string;
  className?: string;
}

export const PuckGrid: EnhancedComponentConfig<GridProps> = {
  category: "Layout",
  fields: {
    columns: {
      type: "select",
      label: "Columns",
      options: [
        { label: "1", value: "1" },
        { label: "2", value: "2" },
        { label: "3", value: "3" },
        { label: "4", value: "4" },
        { label: "6", value: "6" },
        { label: "12", value: "12" },
      ],
    },
    rows: {
      type: "select",
      label: "Rows",
      options: [
        { label: "Auto", value: "auto" },
        { label: "1", value: "1" },
        { label: "2", value: "2" },
        { label: "3", value: "3" },
        { label: "4", value: "4" },
        { label: "6", value: "6" },
      ],
    },
    gap: {
      type: "select",
      label: "Gap",
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
    alignItems: {
      type: "select",
      label: "Align Items",
      options: [
        { label: "Start", value: "start" },
        { label: "Center", value: "center" },
        { label: "End", value: "end" },
        { label: "Stretch", value: "stretch" },
      ],
    },
    justifyItems: {
      type: "select",
      label: "Justify Items",
      options: [
        { label: "Start", value: "start" },
        { label: "Center", value: "center" },
        { label: "End", value: "end" },
        { label: "Stretch", value: "stretch" },
      ],
    },
    autoFlow: {
      type: "select",
      label: "Auto Flow",
      options: [
        { label: "Row", value: "row" },
        { label: "Column", value: "col" },
        { label: "Dense", value: "dense" },
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
    minHeight: { type: "text", label: "Min Height" },
    className: { type: "text", label: "Custom Classes" },
  },
  defaultProps: {
    columns: "3",
    rows: "auto",
    gap: "4",
    alignItems: "stretch",
    justifyItems: "stretch",
    autoFlow: "row",
  },
  render: (props) => {
    const {
      children,
      columns,
      rows,
      gap,
      alignItems,
      justifyItems,
      autoFlow,
      paddingTop,
      paddingBottom,
      paddingLeft,
      paddingRight,
      marginTop,
      marginBottom,
      backgroundColor,
      borderRadius,
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
      borderRadius,
      gap,
      gridCols: columns,
      gridRows: rows,
      className: customClassName,
    });

    const gridStyle: React.CSSProperties = {
      ...style,
      minHeight,
    };

    return (
      <div
        className={`grid items-${alignItems} justify-items-${justifyItems} grid-flow-${autoFlow} ${className}`}
        style={gridStyle}
      >
        {children}
      </div>
    );
  },
};


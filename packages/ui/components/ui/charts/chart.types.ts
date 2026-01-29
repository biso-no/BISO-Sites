"use client"

import type { ChartConfig } from "../chart"

/**
 * Base props for all chart card components
 */
export interface BaseChartCardProps {
  /** Chart title displayed in card header */
  title: string
  /** Optional description displayed below title */
  description?: string
  /** Additional CSS classes for the card */
  className?: string
  /** Chart height in pixels, defaults to 300 */
  height?: number
  /** Whether to show the card footer with trend info */
  showFooter?: boolean
  /** Footer trend text (e.g., "Trending up by 5.2%") */
  footerTrend?: string
  /** Footer description text */
  footerDescription?: string
}

/**
 * Props for bar chart components
 */
export interface BarChartCardProps<T extends Record<string, unknown>> extends BaseChartCardProps {
  /** Chart data array */
  data: T[]
  /** Chart configuration for colors and labels */
  config: ChartConfig
  /** Key(s) for the bar data values - can be a single key or array for multiple bars */
  dataKeys: string | string[]
  /** Key for the X-axis category labels */
  xAxisKey: string
  /** Custom X-axis tick formatter */
  xAxisFormatter?: (value: string) => string
  /** Bar corner radius, defaults to 4 */
  barRadius?: number
}

/**
 * Props for line chart components
 */
export interface LineChartCardProps<T extends Record<string, unknown>> extends BaseChartCardProps {
  /** Chart data array */
  data: T[]
  /** Chart configuration for colors and labels */
  config: ChartConfig
  /** Key(s) for the line data values - can be a single key or array for multiple lines */
  dataKeys: string | string[]
  /** Key for the X-axis category labels */
  xAxisKey: string
  /** Custom X-axis tick formatter */
  xAxisFormatter?: (value: string) => string
  /** Line type: "monotone" | "linear" | "natural" | "step" */
  lineType?: "monotone" | "linear" | "natural" | "step"
  /** Whether to show dots on the line */
  showDots?: boolean
}

/**
 * Props for pie chart components
 */
export interface PieChartCardProps<T extends Record<string, unknown>> extends BaseChartCardProps {
  /** Chart data array */
  data: T[]
  /** Chart configuration for colors and labels */
  config: ChartConfig
  /** Key for the pie segment values */
  dataKey: string
  /** Key for the pie segment names/labels */
  nameKey: string
  /** Inner radius for donut style (0 for full pie) */
  innerRadius?: number
  /** Outer radius of the pie */
  outerRadius?: number
  /** Whether to show labels on pie segments */
  showLabels?: boolean
  /** Custom label renderer */
  labelRenderer?: (props: { name: string; value: number; percent: number }) => string
}

/**
 * Props for radial/gauge chart components
 */
export interface RadialChartCardProps extends BaseChartCardProps {
  /** Current value to display */
  value: number
  /** Maximum possible value (for percentage calculation) */
  maxValue: number
  /** Label shown below the value */
  label: string
  /** Chart configuration for colors */
  config: ChartConfig
  /** Config key for the color to use */
  colorKey: string
  /** Start angle in degrees */
  startAngle?: number
  /** End angle in degrees */
  endAngle?: number
}

/**
 * Props for interactive charts with series toggles
 */
export interface InteractiveChartProps<T extends Record<string, unknown>> extends BaseChartCardProps {
  /** Chart data array */
  data: T[]
  /** Chart configuration for colors and labels */
  config: ChartConfig
  /** Series keys that can be toggled */
  seriesKeys: string[]
  /** Key for the X-axis (typically date) */
  xAxisKey: string
  /** Custom X-axis tick formatter */
  xAxisFormatter?: (value: string) => string
  /** Custom tooltip label formatter */
  tooltipLabelFormatter?: (value: string) => string
  /** Default selected series key */
  defaultSeries?: string
}

export type { ChartConfig }

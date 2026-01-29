"use client"

import { TrendingUp } from "lucide-react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "../chart"
import type { BarChartCardProps } from "./chart.types"
import { cn } from "@repo/ui/lib/utils"

/**
 * A reusable bar chart card component built on shadcn/ui charts.
 * Supports single or multiple bar series with beautiful styling.
 *
 * @example
 * ```tsx
 * <BarChartCard
 *   title="Page Views"
 *   description="Views per page this month"
 *   data={pageViewsData}
 *   config={{
 *     views: { label: "Views", color: "var(--chart-1)" }
 *   }}
 *   dataKeys="views"
 *   xAxisKey="name"
 * />
 * ```
 */
export function BarChartCard<T extends Record<string, unknown>>({
  title,
  description,
  className,
  height = 300,
  showFooter = false,
  footerTrend,
  footerDescription,
  data,
  config,
  dataKeys,
  xAxisKey,
  xAxisFormatter,
  barRadius = 4,
}: BarChartCardProps<T>) {
  const keys = Array.isArray(dataKeys) ? dataKeys : [dataKeys]
  const showLegend = keys.length > 1

  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="flex-1">
        <ChartContainer config={config} className="w-full" style={{ height }}>
          <BarChart accessibilityLayer data={data} margin={{ left: 12, right: 12 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey={xAxisKey}
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tickFormatter={xAxisFormatter}
            />
            <YAxis tickLine={false} axisLine={false} tickMargin={8} />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator={showLegend ? "dashed" : "dot"} />}
            />
            {showLegend && (
              <ChartLegend content={<ChartLegendContent />} />
            )}
            {keys.map((key) => (
              <Bar
                key={key}
                dataKey={key}
                fill={`var(--color-${key})`}
                radius={barRadius}
              />
            ))}
          </BarChart>
        </ChartContainer>
      </CardContent>
      {showFooter && (footerTrend || footerDescription) && (
        <CardFooter className="flex-col items-start gap-2 text-sm">
          {footerTrend && (
            <div className="flex gap-2 leading-none font-medium">
              {footerTrend} <TrendingUp className="h-4 w-4" />
            </div>
          )}
          {footerDescription && (
            <div className="text-muted-foreground leading-none">
              {footerDescription}
            </div>
          )}
        </CardFooter>
      )}
    </Card>
  )
}

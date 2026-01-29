"use client"

import { TrendingUp } from "lucide-react"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"

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
import type { LineChartCardProps } from "./chart.types"
import { cn } from "@repo/ui/lib/utils"

/**
 * A reusable line chart card component built on shadcn/ui charts.
 * Supports single or multiple line series with beautiful styling.
 *
 * @example
 * ```tsx
 * <LineChartCard
 *   title="User Growth"
 *   description="Monthly active users"
 *   data={userGrowthData}
 *   config={{
 *     users: { label: "Users", color: "var(--chart-1)" }
 *   }}
 *   dataKeys="users"
 *   xAxisKey="date"
 * />
 * ```
 */
export function LineChartCard<T extends Record<string, unknown>>({
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
  lineType = "monotone",
  showDots = false,
}: LineChartCardProps<T>) {
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
          <LineChart accessibilityLayer data={data} margin={{ left: 12, right: 12 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey={xAxisKey}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={xAxisFormatter}
            />
            <YAxis tickLine={false} axisLine={false} tickMargin={8} />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent />}
            />
            {showLegend && (
              <ChartLegend content={<ChartLegendContent />} />
            )}
            {keys.map((key) => (
              <Line
                key={key}
                dataKey={key}
                type={lineType}
                stroke={`var(--color-${key})`}
                strokeWidth={2}
                dot={showDots}
              />
            ))}
          </LineChart>
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

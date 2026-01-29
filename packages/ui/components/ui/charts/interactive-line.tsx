"use client"

import * as React from "react"
import { CartesianGrid, Line, LineChart, XAxis } from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "../chart"
import type { InteractiveChartProps } from "./chart.types"
import { cn } from "@repo/ui/lib/utils"

/**
 * An interactive line chart with toggleable series displayed in header tabs.
 * Shows totals for each series and highlights the active selection.
 *
 * @example
 * ```tsx
 * <InteractiveLineChart
 *   title="Visitor Analytics"
 *   description="Daily visitors by device"
 *   data={visitorData}
 *   config={{
 *     desktop: { label: "Desktop", color: "var(--chart-1)" },
 *     mobile: { label: "Mobile", color: "var(--chart-2)" }
 *   }}
 *   seriesKeys={["desktop", "mobile"]}
 *   xAxisKey="date"
 * />
 * ```
 */
export function InteractiveLineChart<T extends Record<string, unknown>>({
  title,
  description,
  className,
  height = 250,
  data,
  config,
  seriesKeys,
  xAxisKey,
  xAxisFormatter,
  tooltipLabelFormatter,
  defaultSeries,
}: InteractiveChartProps<T>) {
  const [activeChart, setActiveChart] = React.useState<string>(
    defaultSeries ?? seriesKeys[0]
  )

  const totals = React.useMemo(() => {
    return seriesKeys.reduce((acc, key) => {
      acc[key] = data.reduce((sum, item) => {
        const value = item[key]
        return sum + (typeof value === "number" ? value : 0)
      }, 0)
      return acc
    }, {} as Record<string, number>)
  }, [data, seriesKeys])

  const defaultXAxisFormatter = (value: string) => {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })
  }

  const defaultTooltipFormatter = (value: string) => {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  return (
    <Card className={cn("py-4 sm:py-0", className)}>
      <CardHeader className="flex flex-col items-stretch border-b !p-0 sm:flex-row">
        <div className="flex flex-1 flex-col justify-center gap-1 px-6 pb-3 sm:pb-0">
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        <div className="flex">
          {seriesKeys.map((key) => {
            const chartConfig = config[key]
            return (
              <button
                key={key}
                data-active={activeChart === key}
                className="data-[active=true]:bg-muted/50 flex flex-1 flex-col justify-center gap-1 border-t px-6 py-4 text-left even:border-l sm:border-t-0 sm:border-l sm:px-8 sm:py-6"
                onClick={() => setActiveChart(key)}
              >
                <span className="text-muted-foreground text-xs">
                  {chartConfig?.label ?? key}
                </span>
                <span className="text-lg leading-none font-bold sm:text-3xl">
                  {totals[key].toLocaleString()}
                </span>
              </button>
            )
          })}
        </div>
      </CardHeader>
      <CardContent className="px-2 sm:p-6">
        <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
          <LineChart
            accessibilityLayer
            data={data}
            margin={{ left: 12, right: 12 }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey={xAxisKey}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={xAxisFormatter ?? defaultXAxisFormatter}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  className="w-[150px]"
                  labelFormatter={tooltipLabelFormatter ?? defaultTooltipFormatter}
                />
              }
            />
            <Line
              dataKey={activeChart}
              type="monotone"
              stroke={`var(--color-${activeChart})`}
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

"use client"

import { TrendingUp } from "lucide-react"
import {
  Label,
  PolarGrid,
  PolarRadiusAxis,
  RadialBar,
  RadialBarChart,
} from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../card"
import { ChartContainer } from "../chart"
import type { RadialChartCardProps } from "./chart.types"
import { cn } from "@repo/ui/lib/utils"

/**
 * A radial/gauge chart card for displaying progress or single values.
 * Perfect for showing completion percentages or KPIs.
 *
 * @example
 * ```tsx
 * <RadialChartCard
 *   title="Storage Used"
 *   description="Current month usage"
 *   value={75}
 *   maxValue={100}
 *   label="GB"
 *   config={{ storage: { label: "Storage", color: "var(--chart-1)" } }}
 *   colorKey="storage"
 * />
 * ```
 */
export function RadialChartCard({
  title,
  description,
  className,
  height = 250,
  showFooter = false,
  footerTrend,
  footerDescription,
  value,
  maxValue,
  label,
  config,
  colorKey,
  startAngle = 0,
  endAngle,
}: RadialChartCardProps) {
  // Calculate the end angle based on the value/maxValue ratio
  const calculatedEndAngle = endAngle ?? Math.round((value / maxValue) * 360)

  const chartData = [
    { name: colorKey, value, fill: `var(--color-${colorKey})` },
  ]

  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader className="items-center pb-0">
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <ChartContainer
          config={config}
          className="mx-auto aspect-square"
          style={{ maxHeight: height }}
        >
          <RadialBarChart
            data={chartData}
            startAngle={startAngle}
            endAngle={calculatedEndAngle}
            innerRadius={80}
            outerRadius={110}
          >
            <PolarGrid
              gridType="circle"
              radialLines={false}
              stroke="none"
              className="first:fill-muted last:fill-background"
              polarRadius={[86, 74]}
            />
            <RadialBar dataKey="value" background cornerRadius={10} />
            <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
              <Label
                content={({ viewBox }) => {
                  if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                    return (
                      <text
                        x={viewBox.cx}
                        y={viewBox.cy}
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        <tspan
                          x={viewBox.cx}
                          y={viewBox.cy}
                          className="fill-foreground text-4xl font-bold"
                        >
                          {value.toLocaleString()}
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy ?? 0) + 24}
                          className="fill-muted-foreground"
                        >
                          {label}
                        </tspan>
                      </text>
                    )
                  }
                }}
              />
            </PolarRadiusAxis>
          </RadialBarChart>
        </ChartContainer>
      </CardContent>
      {showFooter && (footerTrend || footerDescription) && (
        <CardFooter className="flex-col gap-2 text-sm">
          {footerTrend && (
            <div className="flex items-center gap-2 leading-none font-medium">
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

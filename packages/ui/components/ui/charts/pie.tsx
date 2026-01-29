"use client"

import { TrendingUp } from "lucide-react"
import { Cell, Pie, PieChart } from "recharts"

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
} from "../chart"
import type { PieChartCardProps } from "./chart.types"
import { cn } from "@repo/ui/lib/utils"

/**
 * A reusable pie chart card component built on shadcn/ui charts.
 * Supports labels, custom colors, and donut style.
 *
 * @example
 * ```tsx
 * <PieChartCard
 *   title="User Distribution"
 *   description="Users by segment"
 *   data={[
 *     { name: "Admin", value: 20 },
 *     { name: "User", value: 80 }
 *   ]}
 *   config={{
 *     admin: { label: "Admin", color: "var(--chart-1)" },
 *     user: { label: "User", color: "var(--chart-2)" }
 *   }}
 *   dataKey="value"
 *   nameKey="name"
 * />
 * ```
 */
export function PieChartCard<T extends Record<string, unknown>>({
  title,
  description,
  className,
  height = 300,
  showFooter = false,
  footerTrend,
  footerDescription,
  data,
  config,
  dataKey,
  nameKey,
  innerRadius = 0,
  outerRadius = 100,
  showLabels = true,
  labelRenderer,
}: PieChartCardProps<T>) {
  // Get colors from config for each data item
  const getColor = (item: T, index: number) => {
    const name = String(item[nameKey]).toLowerCase().replace(/\s+/g, "-")
    const configItem = config[name]
    if (configItem && "color" in configItem && configItem.color) {
      return configItem.color
    }
    // Fallback to CSS variables
    return `var(--chart-${(index % 5) + 1})`
  }

  const defaultLabelRenderer = ({ name, percent }: { name: string; percent: number }) => 
    `${name} ${(percent * 100).toFixed(0)}%`

  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader className="items-center pb-0">
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <ChartContainer 
          config={config} 
          className="mx-auto aspect-square w-full"
          style={{ maxHeight: height }}
        >
          <PieChart>
            <ChartTooltip
              content={<ChartTooltipContent nameKey={nameKey} hideLabel />}
            />
            <Pie
              data={data}
              dataKey={dataKey}
              nameKey={nameKey}
              cx="50%"
              cy="50%"
              innerRadius={innerRadius}
              outerRadius={outerRadius}
              labelLine={false}
              label={showLabels ? (props) => {
                const renderer = labelRenderer ?? defaultLabelRenderer
                return (
                  <text
                    x={props.x}
                    y={props.y}
                    textAnchor={props.textAnchor}
                    dominantBaseline={props.dominantBaseline}
                    fill="hsl(var(--foreground))"
                    fontSize={12}
                  >
                    {renderer({
                      name: props.name ?? "",
                      value: props.value as number,
                      percent: props.percent ?? 0,
                    })}
                  </text>
                )
              } : false}
            >
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={getColor(entry, index)}
                />
              ))}
            </Pie>
          </PieChart>
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

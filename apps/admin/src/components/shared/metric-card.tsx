"use client";

import { Card, CardContent } from "@repo/ui/components/ui/card";
import { cn } from "@repo/ui/lib/utils";
import type { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";

type MetricCardProps = {
  title: string;
  value: number;
  icon: LucideIcon;
  iconColor?: string;
  iconBgColor?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
  animate?: boolean;
};

export function MetricCard({
  title,
  value,
  icon: Icon,
  iconColor = "text-primary",
  iconBgColor = "bg-primary/10",
  trend,
  className,
  animate = true,
}: MetricCardProps) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (!animate) {
      setDisplayValue(value);
      return;
    }

    const duration = 1000; // 1 second
    const steps = 60;
    const increment = value / steps;
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      if (currentStep >= steps) {
        setDisplayValue(value);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(increment * currentStep));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [value, animate]);

  return (
    <Card
      className={cn(
        "hover:-translate-y-1 relative transform overflow-hidden transition-all duration-300 hover:shadow-xl",
        "border-border/50 bg-card/60 backdrop-blur-sm",
        "before:absolute before:inset-0 before:bg-linear-to-br before:from-primary/5 before:to-transparent before:opacity-0 before:transition-opacity hover:before:opacity-100",
        className
      )}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1 space-y-1">
            <p className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
              {title}
            </p>
            <div className="flex items-baseline gap-2">
              <p className="font-bold text-3xl tracking-tight">
                {displayValue.toLocaleString()}
              </p>
              {trend && (
                <span
                  className={cn(
                    "font-medium text-sm",
                    trend.isPositive ? "text-green-600" : "text-red-600"
                  )}
                >
                  {trend.isPositive ? "+" : ""}
                  {trend.value}%
                </span>
              )}
            </div>
          </div>
          <div
            className={cn(
              "rounded-xl p-3 transition-all duration-300 group-hover:scale-110",
              iconBgColor
            )}
          >
            <Icon className={cn("h-6 w-6", iconColor)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

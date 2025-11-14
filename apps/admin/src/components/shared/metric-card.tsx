"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@repo/ui/components/ui/card';
import { LucideIcon } from 'lucide-react';
import { cn } from '@repo/ui/lib/utils';

interface MetricCardProps {
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
}

export function MetricCard({
  title,
  value,
  icon: Icon,
  iconColor = "text-primary",
  iconBgColor = "bg-primary/10",
  trend,
  className,
  animate = true
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
        "relative overflow-hidden transition-all duration-300 transform hover:-translate-y-1 hover:shadow-xl",
        "border-border/50 bg-card/60 backdrop-blur-sm",
        "before:absolute before:inset-0 before:bg-gradient-to-br before:from-primary/5 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity",
        className
      )}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1 flex-1">
            <p className="text-sm font-medium text-muted-foreground tracking-wide uppercase">
              {title}
            </p>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-bold tracking-tight">
                {displayValue.toLocaleString()}
              </p>
              {trend && (
                <span
                  className={cn(
                    "text-sm font-medium",
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
              "p-3 rounded-xl transition-all duration-300 group-hover:scale-110",
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


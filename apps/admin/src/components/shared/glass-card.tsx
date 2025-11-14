"use client";

import { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/ui/components/ui/card';
import { cn } from '@repo/ui/lib/utils';

interface GlassCardProps {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  variant?: 'default' | 'premium' | 'subtle';
  hover?: boolean;
}

export function GlassCard({
  title,
  description,
  children,
  className,
  contentClassName,
  variant = 'default',
  hover = false
}: GlassCardProps) {
  const variantStyles = {
    default: "bg-card/60 backdrop-blur-sm border-border/50",
    premium: "bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-md border-primary/20 shadow-lg",
    subtle: "bg-card/40 backdrop-blur-sm border-border/30"
  };

  const hoverStyles = hover
    ? "transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5 hover:border-primary/40"
    : "";

  return (
    <Card
      className={cn(
        variantStyles[variant],
        hoverStyles,
        "relative overflow-hidden",
        className
      )}
    >
      {/* Gradient overlay effect */}
      {variant === 'premium' && (
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />
      )}

      {(title || description) && (
        <CardHeader className="relative z-10">
          {title && <CardTitle className="text-xl font-semibold">{title}</CardTitle>}
          {description && <CardDescription className="text-sm text-muted-foreground">{description}</CardDescription>}
        </CardHeader>
      )}
      
      <CardContent className={cn("relative z-10", contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
}


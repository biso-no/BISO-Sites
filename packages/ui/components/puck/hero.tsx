"use client";

import React, { useEffect } from "react";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import Link from "next/link";
import Image from "next/image";

export interface HeroButton {
  label: string;
  href: string;
  variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "glass" | "glass-dark" | "gradient" | "glow";
}

export interface HeroProps {
  type?: "center" | "left" | "split";
  height?: "full" | "large" | "medium" | "small";
  backgroundImage?: string;
  backgroundColor?: string;
  overlay?: boolean;
  badge?: string;
  title: string;
  subtitle?: string;
  buttons?: HeroButton[];
  align?: "left" | "center";
  image?: string; // For split layout
}

export function Hero({
  type = "center",
  height = "medium",
  backgroundImage,
  overlay = true,
  badge,
  title,
  subtitle,
  buttons = [],
  align = "center",
  image,
}: HeroProps) {
  const heightClasses = {
    full: "min-h-screen", // Full viewport height
    large: "min-h-[60vh]",
    medium: "min-h-[50vh]",
    small: "min-h-[30vh]",
  };

  const alignClasses = {
    left: "text-left items-start",
    center: "text-center items-center",
  };

  // If type is split, we force alignment to left for text part usually
  const effectiveAlign = type === "split" ? "left" : align;

  // Ensure overlay is treated as boolean (Puck might pass strings)
  const showOverlay = overlay === true || String(overlay) === "true";

  useEffect(() => {
    console.log("Image", image)
  }, [image])

  return (
    <div
      className={cn(
        "relative flex flex-col justify-center overflow-hidden w-full",
        heightClasses[height]
      )}
    >
      {/* Background Image */}
      {backgroundImage && (
        <div className="absolute inset-0 z-0">
          <Image
            src={backgroundImage}
            alt="Hero background"
            fill
            className="object-cover"
            priority
          />
          {showOverlay && (
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
          )}
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div
          className={cn(
            "flex flex-col gap-6 max-w-4xl mx-auto",
            alignClasses[effectiveAlign],
            type === "split" && "lg:grid lg:grid-cols-2 lg:gap-12 lg:items-center lg:max-w-7xl"
          )}
        >
          {/* Text Content */}
          <div className={cn("flex flex-col gap-6", type === "split" && "lg:text-left")}>
            {badge && (
              <span className="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium bg-primary/10 text-primary-foreground backdrop-blur-md border border-white/20 self-start">
                {badge}
              </span>
            )}
            
            <h1 className={cn(
              "text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight",
              backgroundImage ? "text-white" : "text-foreground"
            )}>
              {title}
            </h1>
            
            {subtitle && (
              <p className={cn(
                "text-lg md:text-xl max-w-2xl",
                backgroundImage ? "text-gray-200" : "text-muted-foreground"
              )}>
                {subtitle}
              </p>
            )}

            {buttons.length > 0 && (
              <div className={cn("flex flex-wrap gap-4 mt-4", effectiveAlign === "center" && "justify-center")}>
                {buttons.map((btn, i) => (
                  <Button
                    key={i}
                    variant={btn.variant || "default"}
                    size="lg"
                    asChild
                  >
                    <Link href={btn.href}>{btn.label}</Link>
                  </Button>
                ))}
              </div>
            )}
          </div>

          {/* Split Layout Image or Bottom Image */}
          {image && (
            <div className={cn(
              "relative w-full rounded-xl overflow-hidden shadow-2xl",
              type === "split" ? "aspect-video mt-8 lg:mt-0" : "aspect-video mt-12 max-w-5xl mx-auto"
            )}>
              <Image
                src={image}
                alt={title}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px"
                unoptimized
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import React from "react";
import { cn } from "../../lib/utils";
import { ImageWithFallback } from "../image";

export interface LogoItem {
  image: string;
  alt: string;
  href?: string;
}

export interface LogoGridProps {
  items: LogoItem[];
  columns?: 3 | 4 | 5 | 6;
  variant?: "simple" | "bordered" | "card";
  grayscale?: boolean;
}

export function LogoGrid({
  items = [],
  columns = 4,
  variant = "bordered",
  grayscale = true,
}: LogoGridProps) {
  const gridCols = {
    3: "grid-cols-2 sm:grid-cols-3",
    4: "grid-cols-2 sm:grid-cols-4",
    5: "grid-cols-2 sm:grid-cols-3 md:grid-cols-5",
    6: "grid-cols-2 sm:grid-cols-3 md:grid-cols-6",
  };

  return (
    <div className="w-full py-8">
      <div className={cn("grid gap-6 items-center", gridCols[columns])}>
        {items.map((item, index) => {
          const Content = (
            <div
              className={cn(
                "relative flex items-center justify-center p-6 transition-all duration-300",
                variant === "bordered" &&
                  "border border-border rounded-xl bg-white hover:border-primary/20 hover:shadow-md",
                variant === "card" &&
                  "bg-white rounded-xl shadow-sm hover:shadow-md p-8",
                grayscale &&
                  "grayscale hover:grayscale-0 opacity-70 hover:opacity-100"
              )}
            >
              <div className="relative w-full h-12 sm:h-16">
                <ImageWithFallback
                  src={item.image}
                  alt={item.alt}
                  fill
                  className="object-contain"
                />
              </div>
            </div>
          );

          if (item.href) {
            return (
              <Link
                key={index}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="block h-full"
              >
                {Content}
              </Link>
            );
          }

          return (
            <div key={index} className="h-full">
              {Content}
            </div>
          );
        })}
      </div>
    </div>
  );
}

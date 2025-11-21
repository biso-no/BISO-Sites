"use client";

import Link from "next/link";
import { cn } from "../../lib/utils";
import { ImageWithFallback } from "../image";

export type LogoItem = {
  image: string;
  alt: string;
  href?: string;
};

export type LogoGridProps = {
  items: LogoItem[];
  columns?: 3 | 4 | 5 | 6;
  variant?: "simple" | "bordered" | "card";
  grayscale?: boolean;
};

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
      <div className={cn("grid items-center gap-6", gridCols[columns])}>
        {items.map((item, index) => {
          const Content = (
            <div
              className={cn(
                "relative flex items-center justify-center p-6 transition-all duration-300",
                variant === "bordered" &&
                  "rounded-xl border border-border bg-white hover:border-primary/20 hover:shadow-md",
                variant === "card" &&
                  "rounded-xl bg-white p-8 shadow-sm hover:shadow-md",
                grayscale &&
                  "opacity-70 grayscale hover:opacity-100 hover:grayscale-0"
              )}
            >
              <div className="relative h-12 w-full sm:h-16">
                <ImageWithFallback
                  alt={item.alt}
                  className="object-contain"
                  fill
                  src={item.image}
                />
              </div>
            </div>
          );

          if (item.href) {
            return (
              <Link
                className="block h-full"
                href={item.href}
                key={index}
                rel="noopener noreferrer"
                target="_blank"
              >
                {Content}
              </Link>
            );
          }

          return (
            <div className="h-full" key={index}>
              {Content}
            </div>
          );
        })}
      </div>
    </div>
  );
}

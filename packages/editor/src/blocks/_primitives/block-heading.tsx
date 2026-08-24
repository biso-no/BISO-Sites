"use client";

import { cn } from "@repo/ui/lib/utils";
import { createElement, type HTMLAttributes } from "react";

type HeadingAttributes = HTMLAttributes<HTMLHeadingElement> & {
  "data-edit"?: string;
};

interface BlockHeadingProps {
  align?: "left" | "center";
  className?: string;
  eyebrow?: string;
  intro?: string;
  level?: 1 | 2 | 3;
  title?: string;
  titleProps?: HeadingAttributes;
}

const TITLE_SIZE: Record<1 | 2 | 3, string> = {
  1: "text-4xl sm:text-5xl lg:text-6xl",
  2: "text-2xl sm:text-3xl lg:text-4xl",
  3: "text-xl sm:text-2xl",
};

export const BlockHeading = ({
  align = "left",
  className,
  eyebrow,
  intro,
  level = 2,
  title,
  titleProps,
}: BlockHeadingProps) => {
  if (!(eyebrow || title || intro)) {
    return null;
  }

  return (
    <div
      className={cn(
        "mb-8 lg:mb-12",
        align === "center" && "mx-auto max-w-2xl text-center",
        className
      )}
    >
      {eyebrow ? (
        <div className="mb-4 inline-block rounded-full bg-muted px-4 py-2 font-medium text-foreground text-sm">
          {eyebrow}
        </div>
      ) : null}
      {title
        ? createElement(
            `h${level}`,
            {
              ...titleProps,
              className: cn(
                "text-balance font-display font-semibold text-foreground",
                TITLE_SIZE[level],
                titleProps?.className
              ),
            },
            title
          )
        : null}
      {intro ? (
        <p className="mt-4 text-base text-muted-foreground leading-relaxed sm:text-lg">
          {intro}
        </p>
      ) : null}
    </div>
  );
};

"use client";

import Link from "next/link";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Card } from "../ui/card";

export type CTAButton = {
  label: string;
  href: string;
  variant?: "default" | "outline" | "secondary" | "ghost" | "white";
};

export type CTAProps = {
  title: string;
  description?: string;
  buttons?: CTAButton[];
  variant?: "default" | "card" | "split" | "brand" | "dark";
  align?: "center" | "left";
};

export function CTA({
  title,
  description,
  buttons = [],
  variant = "default",
  align = "center",
}: CTAProps) {
  const alignClasses = {
    center: "text-center items-center",
    left: "text-left items-start",
  };

  const content = (
    <div
      className={cn(
        "mx-auto flex max-w-3xl flex-col gap-6",
        alignClasses[align]
      )}
    >
      <h2 className="font-bold text-3xl tracking-tight sm:text-4xl">{title}</h2>
      {description && (
        <p
          className={cn(
            "text-lg",
            variant === "brand" || variant === "dark"
              ? "text-primary-foreground/90"
              : "text-muted-foreground"
          )}
        >
          {description}
        </p>
      )}
      {buttons.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-4">
          {buttons.map((btn, i) => (
            <Button
              asChild
              key={i}
              size="lg"
              variant={
                (btn.variant as any) ||
                (variant === "brand" || variant === "dark"
                  ? "secondary"
                  : "default")
              }
            >
              <Link href={btn.href}>{btn.label}</Link>
            </Button>
          ))}
        </div>
      )}
    </div>
  );

  if (variant === "card") {
    return (
      <div className="w-full py-12">
        <Card className="border-none bg-gray-50 p-8 shadow-sm md:p-12">
          {content}
        </Card>
      </div>
    );
  }

  if (variant === "brand") {
    return (
      <div className="my-12 w-full rounded-3xl bg-primary px-8 py-16 text-primary-foreground">
        {content}
      </div>
    );
  }

  if (variant === "dark") {
    return (
      <div className="w-full bg-[#001731] py-16 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">{content}</div>
      </div>
    );
  }

  return <div className="w-full bg-background py-16">{content}</div>;
}

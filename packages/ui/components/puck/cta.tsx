"use client";

import Link from "next/link";
import React from "react";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Card } from "../ui/card";

export interface CTAButton {
  label: string;
  href: string;
  variant?: "default" | "outline" | "secondary" | "ghost" | "white";
}

export interface CTAProps {
  title: string;
  description?: string;
  buttons?: CTAButton[];
  variant?: "default" | "card" | "split" | "brand" | "dark";
  align?: "center" | "left";
}

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
        "flex flex-col gap-6 max-w-3xl mx-auto",
        alignClasses[align]
      )}
    >
      <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
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
        <div className="flex flex-wrap gap-4 mt-2">
          {buttons.map((btn, i) => (
            <Button
              key={i}
              variant={
                (btn.variant as any) ||
                (variant === "brand" || variant === "dark"
                  ? "secondary"
                  : "default")
              }
              size="lg"
              asChild
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
      <div className="py-12 w-full">
        <Card className="p-8 md:p-12 bg-gray-50 border-none shadow-sm">
          {content}
        </Card>
      </div>
    );
  }

  if (variant === "brand") {
    return (
      <div className="py-16 w-full bg-primary text-primary-foreground rounded-3xl my-12 px-8">
        {content}
      </div>
    );
  }

  if (variant === "dark") {
    return (
      <div className="py-16 w-full bg-[#001731] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">{content}</div>
      </div>
    );
  }

  return <div className="py-16 w-full bg-background">{content}</div>;
}

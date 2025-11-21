import { cn } from "@repo/ui/lib/utils";
import type * as React from "react";

const Card = ({
  className,
  variant = "default",
  ref,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  variant?:
    | "default"
    | "glass"
    | "glass-dark"
    | "gradient"
    | "gradient-border"
    | "animated"
    | "golden";
} & { ref?: React.RefObject<HTMLDivElement | null> }) => (
  <div
    className={cn(
      "rounded-lg border bg-card text-card-foreground",
      variant === "glass" && "glass border-0",
      variant === "glass-dark" && "glass-dark border-0",
      variant === "gradient" &&
        "border-0 bg-linear-to-br from-blue-strong to-primary-80 text-white",
      variant === "gradient-border" && "gradient-border",
      variant === "animated" &&
        "relative overflow-hidden transition-colors duration-200",
      variant === "golden" &&
        "border-gold-default/20 bg-linear-to-br from-gold-subtle to-gold-muted text-primary-100",
      className
    )}
    ref={ref}
    {...props}
  />
);
Card.displayName = "Card";

const CardHeader = ({
  className,
  ref,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  ref?: React.RefObject<HTMLDivElement | null>;
}) => (
  <div
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    ref={ref}
    {...props}
  />
);
CardHeader.displayName = "CardHeader";

const CardTitle = ({
  className,
  ref,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement> & {
  ref?: React.RefObject<HTMLParagraphElement | null>;
}) => (
  <h3
    className={cn(
      "font-semibold text-2xl leading-none tracking-tight",
      className
    )}
    ref={ref}
    {...props}
  />
);
CardTitle.displayName = "CardTitle";

const CardDescription = ({
  className,
  ref,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement> & {
  ref?: React.RefObject<HTMLParagraphElement | null>;
}) => (
  <p
    className={cn("text-muted-foreground text-sm", className)}
    ref={ref}
    {...props}
  />
);
CardDescription.displayName = "CardDescription";

const CardContent = ({
  className,
  ref,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  ref?: React.RefObject<HTMLDivElement | null>;
}) => <div className={cn("p-6 pt-0", className)} ref={ref} {...props} />;
CardContent.displayName = "CardContent";

const CardFooter = ({
  className,
  ref,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  ref?: React.RefObject<HTMLDivElement | null>;
}) => (
  <div
    className={cn("flex items-center p-6 pt-0", className)}
    ref={ref}
    {...props}
  />
);
CardFooter.displayName = "CardFooter";

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
};

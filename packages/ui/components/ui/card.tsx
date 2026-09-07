import { cn } from "@repo/ui/lib/utils";
import type * as React from "react";

/**
 * RD-030 removed six variants — `glass`, `glass-dark`, `gradient`,
 * `gradient-border`, `animated` and `golden`.
 *
 * **Every one of them named a colour that is registered nowhere**
 * (`blue-strong`, `primary-80`, `gold-default`, `gold-subtle`, `gold-muted`,
 * `primary-100`) or a utility class that does not exist (`glass`,
 * `glass-dark`, `gradient-border`), so Tailwind emitted nothing for them and
 * they rendered as a plain card with the border removed. None of the six had a
 * single call site in `apps/web`, `apps/admin` or any package. See
 * `00-current-state.md` §3.4.
 */
const Card = ({
  className,
  ref,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  ref?: React.RefObject<HTMLDivElement | null>;
}) => (
  <div
    className={cn("rounded-lg border bg-card text-card-foreground", className)}
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

/**
 * RD-031 added `as`. The title was always an `<h3>`, so a card placed directly
 * under a page's `<h1>` skipped a level — axe reported `heading-order` on
 * `/projects/[slug]`. The default is unchanged, so every existing caller
 * (`apps/admin` included) renders exactly what it did before; a caller that
 * knows its own depth can now say so.
 */
const CardTitle = ({
  as: Tag = "h3",
  className,
  ref,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement> & {
  as?: "h2" | "h3" | "h4";
  ref?: React.RefObject<HTMLHeadingElement | null>;
}) => (
  <Tag
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

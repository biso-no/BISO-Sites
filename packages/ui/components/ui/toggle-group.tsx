"use client";

import { Item, Root } from "@radix-ui/react-toggle-group";
import { toggleVariants } from "@repo/ui/components/ui/toggle";
import { cn } from "@repo/ui/lib/utils";
import type { VariantProps } from "class-variance-authority";
import {
  type ComponentPropsWithoutRef,
  createContext,
  type ElementRef,
  type RefObject,
  useContext,
} from "react";

const ToggleGroupContext = createContext<VariantProps<typeof toggleVariants>>({
  size: "default",
  variant: "default",
});

const ToggleGroup = ({
  className,
  variant,
  size,
  children,
  ref,
  ...props
}: ComponentPropsWithoutRef<typeof Root> &
  VariantProps<typeof toggleVariants> & {
    ref?: RefObject<ElementRef<typeof Root> | null>;
  }) => (
  <Root
    className={cn("flex items-center justify-center gap-1", className)}
    ref={ref}
    {...props}
  >
    <ToggleGroupContext.Provider value={{ variant, size }}>
      {children}
    </ToggleGroupContext.Provider>
  </Root>
);

ToggleGroup.displayName = Root.displayName;

const ToggleGroupItem = ({
  className,
  children,
  variant,
  size,
  ref,
  ...props
}: ComponentPropsWithoutRef<typeof Item> &
  VariantProps<typeof toggleVariants> & {
    ref?: RefObject<ElementRef<typeof Item> | null>;
  }) => {
  const context = useContext(ToggleGroupContext);

  return (
    <Item
      className={cn(
        toggleVariants({
          variant: context.variant || variant,
          size: context.size || size,
        }),
        className
      )}
      ref={ref}
      {...props}
    >
      {children}
    </Item>
  );
};

ToggleGroupItem.displayName = Item.displayName;

export { ToggleGroup, ToggleGroupItem };

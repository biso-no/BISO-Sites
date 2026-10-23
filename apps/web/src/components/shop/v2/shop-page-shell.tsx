import { cn } from "@repo/ui/lib/utils";
import type { ReactNode } from "react";
import type { ContainerWidth } from "@/components/ui/container";
import type { Crumb } from "@/components/ui/page-header";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";

/**
 * The header-and-frame the three commerce pages share once the redesign is on.
 *
 * Cart, checkout and order are the routes RD-022 is explicitly forbidden to
 * change the logic of — they carry real money and are covered by
 * `cart-reservations.test.ts` and `orders.test.ts`. So the redesign reaches
 * them through their chrome: this replaces `ShopHeroShell` (a 42vh navy band
 * with a grid overlay, two blurred glows and a centred title) with the same
 * `PageHeader` every other page uses, and the ad-hoc `max-w-*` container with
 * `Section`. Not one handler, reducer or server action inside them is touched.
 *
 * `className` exists for exactly one caller: the order page wraps its screen
 * view in `print:hidden` so that printing yields `<OrderReceipt>` alone. That
 * class has to survive onto the outermost element or the receipt prints behind
 * a full copy of the page.
 */
export interface ShopPageShellProps {
  breadcrumbs: Crumb[];
  children: ReactNode;
  className?: string;
  eyebrow?: string;
  lede?: string;
  meta?: ReactNode;
  title: string;
  width?: ContainerWidth;
}

export function ShopPageShell({
  breadcrumbs,
  children,
  className,
  eyebrow,
  lede,
  meta,
  title,
  width = "default",
}: ShopPageShellProps) {
  return (
    <div className={cn(className)}>
      <PageHeader
        breadcrumbs={breadcrumbs}
        eyebrow={eyebrow}
        lede={lede}
        meta={meta}
        title={title}
      />
      <Section tone="paper" width={width}>
        {children}
      </Section>
    </div>
  );
}

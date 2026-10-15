"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";

interface CtaCardProps {
  cta: string;
  description: string;
  external?: boolean;
  href: string;
  icon: LucideIcon;
  title: string;
}

/** Title, blurb and one button, as used for SPU, "your case", alumni, SAIH. */
export function CtaCard({
  cta,
  description,
  external,
  href,
  icon: Icon,
  title,
}: CtaCardProps) {
  return (
    <Card className="flex h-full flex-col items-start gap-6 p-8 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-brand-gradient-from to-brand-gradient-to shadow-md">
          <Icon className="h-6 w-6 text-white" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground text-lg">{title}</h3>
          <p className="mt-1 text-muted-foreground">{description}</p>
        </div>
      </div>
      <Button
        asChild
        className="shrink-0 bg-linear-to-r from-brand-gradient-from to-brand-gradient-to text-white shadow-md hover:opacity-90"
        size="lg"
      >
        {external ? (
          <a href={href} rel="noreferrer" target="_blank">
            {cta}
          </a>
        ) : (
          <Link href={href}>{cta}</Link>
        )}
      </Button>
    </Card>
  );
}

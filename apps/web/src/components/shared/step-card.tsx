import type { ReactNode } from "react";

interface StepCardProps {
  badge?: ReactNode;
  children: ReactNode;
  step: number;
  title: string;
}

/**
 * Shared numbered-step section used by multi-step purchase flows (checkout,
 * membership join) so they read as one consistent wizard pattern.
 */
export function StepCard({ step, title, badge, children }: StepCardProps) {
  return (
    <section className="rounded-3xl border border-border/60 bg-card p-6 shadow-sm sm:p-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand font-semibold text-sm text-white">
            {step}
          </span>
          <h2 className="font-semibold text-foreground text-lg">{title}</h2>
        </div>
        {badge}
      </div>
      {children}
    </section>
  );
}

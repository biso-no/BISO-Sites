import type { ReactNode } from "react";

interface StepCardProps {
  badge?: ReactNode;
  children: ReactNode;
  step: number;
  title: string;
}

/**
 * One numbered step of the membership join wizard, in the same shape as the
 * checkout's steps (`CheckoutStep`), so the two purchase flows read as one
 * pattern: a raised, bordered panel, the step number in the action colour and
 * the title as a section heading. The number is decoration beside the heading
 * — the headings' order already says which step comes first.
 */
export function StepCard({ step, title, badge, children }: StepCardProps) {
  return (
    <section className="rounded-biso-md border border-edge bg-surface-raised p-6 sm:p-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="type-data flex size-8 shrink-0 items-center justify-center rounded-biso-pill bg-action text-action-ink"
          >
            {step}
          </span>
          <h2 className="type-heading-section text-ink">{title}</h2>
        </div>
        {badge}
      </div>
      {children}
    </section>
  );
}

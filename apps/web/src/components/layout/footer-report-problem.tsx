"use client";

import { useReportProblem } from "@/components/report-problem";

/**
 * Opens the feedback form from the footer. A client island because the footer
 * is a Server Component and this needs `onClick`.
 */
export function FooterReportProblem() {
  const { label, open } = useReportProblem();
  return (
    <button
      className="type-body-sm text-ink-muted underline-offset-4 transition-colors hover:text-ink hover:underline focus-visible:rounded-biso-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
      onClick={open}
      type="button"
    >
      {label}
    </button>
  );
}

import type { ReactNode } from "react";

/** What the system does after the steps: a panel with a blue rule on its left. */
export function WhatHappensNext({ children }: { children: ReactNode }) {
  return (
    <div className="my-6 border-action border-l-[3px] bg-panel px-4 py-3 text-sm [&>:last-child]:mb-0 [&>p]:my-1.5">
      <p className="mt-0 mb-1.5 font-bold">What happens next</p>
      {children}
    </div>
  );
}

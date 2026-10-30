import type { ReactNode } from "react";

/**
 * What the system does after the steps: a panel with a blue rule on its left.
 * Its title is the author's own heading, so it gets an anchor and a place in
 * "On this page":
 *
 *   <WhatHappensNext>
 *
 *   ## What happens next
 *
 *   …
 *   </WhatHappensNext>
 */
export function WhatHappensNext({ children }: { children: ReactNode }) {
  return (
    <div
      className="my-6 border-action border-l-[3px] bg-panel px-4 py-3 text-sm [&>:last-child]:mb-0 [&>p]:my-1.5"
      data-panel="what-happens-next"
    >
      {children}
    </div>
  );
}

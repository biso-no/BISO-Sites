import type { ReactNode } from "react";

/**
 * What to have ready before the steps: a plain bordered box. Its title is the
 * author's own heading, so it gets an anchor and a place in "On this page":
 *
 *   <BeforeYouStart>
 *
 *   ## Before you start
 *
 *   - …
 *   </BeforeYouStart>
 */
export function BeforeYouStart({ children }: { children: ReactNode }) {
  return (
    <div
      className="my-6 border border-edge px-4 py-3 text-sm [&>:last-child]:mb-0 [&>ul]:mt-1.5"
      data-panel="before-you-start"
    >
      {children}
    </div>
  );
}

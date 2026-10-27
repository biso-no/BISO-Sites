import type { ReactNode } from "react";

/** What to have ready before the steps: a plain bordered box. */
export function BeforeYouStart({ children }: { children: ReactNode }) {
  return (
    <div className="my-6 border border-edge px-4 py-3 text-sm [&>:last-child]:mb-0 [&>ul]:mt-1.5">
      <p className="mt-0 mb-0 font-bold">Before you start</p>
      {children}
    </div>
  );
}

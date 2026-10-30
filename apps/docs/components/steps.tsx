import { stepSlug } from "lib/step-ids";
import type { ReactNode } from "react";

interface StepsProps {
  children: ReactNode;
}

export function Steps({ children }: StepsProps) {
  return <div className="my-6 space-y-6 [counter-reset:step]">{children}</div>;
}

interface StepProps {
  children: ReactNode;
  /**
   * The heading's id. In MDX, `remarkStepIds` sets it, unique on the page.
   * Without one, the id comes from the title.
   */
  id?: string;
  title?: string;
}

/** A numbered step: the number sits in a 26px navy circle (sky on navy in dark mode). */
export function Step({ children, id, title }: StepProps) {
  return (
    <div className="relative pl-10 [counter-increment:step] before:absolute before:top-0 before:left-0 before:flex before:size-[26px] before:items-center before:justify-center before:rounded-full before:bg-deep before:font-bold before:text-[13px] before:text-paper before:content-[counter(step)] dark:before:bg-sky dark:before:text-deep">
      {title && (
        <h3
          className="mb-2 scroll-m-28 font-semibold text-lg"
          id={id ?? stepSlug(title)}
        >
          {title}
        </h3>
      )}
      <div className="text-sm [&>p:first-child]:mt-0 [&>p:last-child]:mb-0 [&>p]:my-2">
        {children}
      </div>
    </div>
  );
}

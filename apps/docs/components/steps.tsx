import type { ReactNode } from "react";

type StepsProps = {
  children: ReactNode;
};

export function Steps({ children }: StepsProps) {
  return <div className="my-6 space-y-6 [counter-reset:step]">{children}</div>;
}

type StepProps = {
  children: ReactNode;
  title?: string;
};

export function Step({ children, title }: StepProps) {
  return (
    <div className="relative pl-10 [counter-increment:step] before:absolute before:top-0 before:left-0 before:flex before:h-8 before:w-8 before:items-center before:justify-center before:rounded-full before:bg-blue-100 before:font-bold before:text-blue-600 before:text-sm before:content-[counter(step)] dark:before:bg-blue-900 dark:before:text-blue-400">
      {title && <h3 className="mb-2 font-semibold text-lg">{title}</h3>}
      <div className="text-sm [&>p:first-child]:mt-0 [&>p:last-child]:mb-0 [&>p]:my-2">
        {children}
      </div>
    </div>
  );
}

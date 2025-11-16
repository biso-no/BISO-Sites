import { ReactNode } from 'react';

interface StepsProps {
  children: ReactNode;
}

export function Steps({ children }: StepsProps) {
  return (
    <div className="my-6 space-y-6 [counter-reset:step]">
      {children}
    </div>
  );
}

interface StepProps {
  children: ReactNode;
  title?: string;
}

export function Step({ children, title }: StepProps) {
  return (
    <div className="relative pl-10 [counter-increment:step] before:content-[counter(step)] before:absolute before:left-0 before:top-0 before:flex before:h-8 before:w-8 before:items-center before:justify-center before:rounded-full before:bg-blue-100 before:text-sm before:font-bold before:text-blue-600 dark:before:bg-blue-900 dark:before:text-blue-400">
      {title && (
        <h3 className="mb-2 text-lg font-semibold">{title}</h3>
      )}
      <div className="text-sm [&>p]:my-2 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0">
        {children}
      </div>
    </div>
  );
}


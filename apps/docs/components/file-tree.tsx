import { cn } from "@repo/ui/lib/utils";
import type { ReactNode } from "react";

interface FileTreeProps {
  children: ReactNode;
}

export function FileTree({ children }: FileTreeProps) {
  return (
    <div className="my-6 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="font-mono text-sm">{children}</div>
    </div>
  );
}

interface FileTreeItemProps {
  name: string;
  icon?: "📁" | "📄" | "⚙️" | "📦";
  depth?: number;
  children?: ReactNode;
}

export function FileTreeItem({
  name,
  icon = "📄",
  depth = 0,
  children,
}: FileTreeItemProps) {
  return (
    <div>
      <div
        className="flex items-center py-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded px-2"
        style={{ paddingLeft: `${depth * 1.5 + 0.5}rem` }}
      >
        <span className="mr-2">{icon}</span>
        <span
          className={cn(
            depth === 0 && "font-semibold",
            "text-gray-900 dark:text-gray-100"
          )}
        >
          {name}
        </span>
      </div>
      {children && <div>{children}</div>}
    </div>
  );
}

import { ReactNode } from 'react';
import { cn } from '@repo/ui/lib/utils';

type CalloutType = 'info' | 'warning' | 'danger' | 'success' | 'note';

interface CalloutProps {
  type?: CalloutType;
  title?: string;
  children: ReactNode;
}

const calloutStyles: Record<CalloutType, { container: string; icon: string; iconBg: string }> = {
  info: {
    container: 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950',
    icon: 'text-blue-600 dark:text-blue-400',
    iconBg: 'bg-blue-100 dark:bg-blue-900',
  },
  warning: {
    container: 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950',
    icon: 'text-yellow-600 dark:text-yellow-400',
    iconBg: 'bg-yellow-100 dark:bg-yellow-900',
  },
  danger: {
    container: 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950',
    icon: 'text-red-600 dark:text-red-400',
    iconBg: 'bg-red-100 dark:bg-red-900',
  },
  success: {
    container: 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950',
    icon: 'text-green-600 dark:text-green-400',
    iconBg: 'bg-green-100 dark:bg-green-900',
  },
  note: {
    container: 'border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900',
    icon: 'text-gray-600 dark:text-gray-400',
    iconBg: 'bg-gray-100 dark:bg-gray-800',
  },
};

const calloutIcons: Record<CalloutType, string> = {
  info: 'ℹ️',
  warning: '⚠️',
  danger: '🚫',
  success: '✅',
  note: '📝',
};

export function Callout({ type = 'info', title, children }: CalloutProps) {
  const styles = calloutStyles[type];
  
  return (
    <div className={cn('my-6 rounded-lg border-l-4 p-4', styles.container)}>
      <div className="flex items-start gap-3">
        <div className={cn('shrink-0 rounded-full w-6 h-6 flex items-center justify-center text-sm', styles.iconBg)}>
          <span className={styles.icon}>{calloutIcons[type]}</span>
        </div>
        <div className="flex-1 min-w-0">
          {title && (
            <div className={cn('font-semibold mb-1', styles.icon)}>
              {title}
            </div>
          )}
          <div className="text-sm [&>p]:my-0 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}


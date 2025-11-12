import { useCallback, useRef } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

export function useUrlUpdate(debounceMs = 300) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const timeoutRef = useRef<NodeJS.Timeout>();

  const updateUrl = useCallback((updates: Record<string, string | undefined>) => {
    // Clear any pending updates
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      let hasChanges = false;

      // Apply all updates in a batch
      Object.entries(updates).forEach(([key, value]) => {
        const currentValue = params.get(key);
        if (value === undefined || value === '') {
          if (currentValue !== null) {
            params.delete(key);
            hasChanges = true;
          }
        } else if (currentValue !== value) {
          params.set(key, value);
          hasChanges = true;
        }
      });

      // Only update URL if there are actual changes
      if (hasChanges) {
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
      }
    }, debounceMs);
  }, [router, pathname, searchParams, debounceMs]);

  return updateUrl;
} 
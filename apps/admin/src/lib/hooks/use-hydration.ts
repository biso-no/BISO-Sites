import { useEffect, useState } from 'react';

/**
 * Hook to track client-side hydration status.
 * Useful for preventing hydration mismatches when components
 * need to render differently on server vs client.
 * 
 * @returns boolean indicating if the component has hydrated on the client
 */
export function useHydration() {
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  return isHydrated;
}

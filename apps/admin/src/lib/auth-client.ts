/**
 * Client-side authentication utilities
 */

/**
 * Create an anonymous session programmatically
 * This is useful for client-side components that need to ensure authentication
 */
export async function createAnonymousSession(): Promise<{ success: boolean; userId?: string }> {
  try {
    const response = await fetch('/api/auth/anonymous', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to create anonymous session:', error);
    return { success: false };
  }
}

/**
 * Check if user has a valid session by making a test request
 */
export async function hasValidSession(): Promise<boolean> {
  try {
    // This would typically be a call to your auth check endpoint
    // For now, we'll just check if the cookie exists
    return document.cookie.includes('a_session_biso');
  } catch (error) {
    console.error('Failed to check session:', error);
    return false;
  }
}

import { createJWT } from "@/lib/actions/user";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3003";

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: unknown;
  headers?: Record<string, string>;
};

type FormDataRequestOptions = {
  method?: "POST" | "PUT" | "PATCH";
  body: FormData;
  headers?: Record<string, string>;
};

/**
 * Authenticated API client for direct calls to the API service.
 * Uses JWT-based authentication via Authorization header.
 *
 * This works for:
 * - Web app (browser) - JWT obtained via server action
 * - Mobile apps - JWT obtained via Appwrite SDK
 */
class ApiClient {
  private jwtCache: { token: string; expiresAt: number } | null = null;
  private jwtPromise: Promise<string | null> | null = null;

  /**
   * Get a valid JWT, using cache when possible.
   * Appwrite JWTs are valid for 15 minutes.
   */
  private async getJwt(): Promise<string | null> {
    const now = Date.now();
    const bufferMs = 60 * 1000; // Refresh 1 minute before expiry

    if (this.jwtCache && this.jwtCache.expiresAt > now + bufferMs) {
      return this.jwtCache.token;
    }

    // Prevent concurrent JWT requests
    if (this.jwtPromise) {
      return this.jwtPromise;
    }

    this.jwtPromise = createJWT();

    try {
      const jwt = await this.jwtPromise;
      if (jwt) {
        // Appwrite JWTs are valid for 15 minutes
        this.jwtCache = {
          token: jwt,
          expiresAt: now + 14 * 60 * 1000, // 14 minutes to be safe
        };
      }
      return jwt;
    } finally {
      this.jwtPromise = null;
    }
  }

  /**
   * Make an authenticated JSON request to the API
   */
  async fetch<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const jwt = await this.getJwt();

    if (!jwt) {
      throw new Error("Not authenticated");
    }

    const { method = "GET", body, headers = {} } = options;

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `API error: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Make an authenticated FormData request to the API (for file uploads)
   */
  async fetchFormData<T>(
    endpoint: string,
    options: FormDataRequestOptions
  ): Promise<T> {
    const jwt = await this.getJwt();

    if (!jwt) {
      throw new Error("Not authenticated");
    }

    const { method = "POST", body, headers = {} } = options;

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method,
      headers: {
        Authorization: `Bearer ${jwt}`,
        ...headers,
      },
      body,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `API error: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Clear the JWT cache (call on logout)
   */
  clearCache(): void {
    this.jwtCache = null;
  }
}

export const apiClient = new ApiClient();

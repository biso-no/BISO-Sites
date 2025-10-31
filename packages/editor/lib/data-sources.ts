import { DataSource, AppwriteDataSource, ApiDataSource, StaticDataSource } from "../types";

/**
 * Data Source System
 * Abstraction layer for fetching data from various sources
 */

interface FetchOptions {
  cache?: boolean;
  cacheDuration?: number;
}

// Simple cache implementation
const dataCache = new Map<string, { data: any; timestamp: number }>();
const DEFAULT_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch data from Appwrite collection
 */
async function fetchFromAppwrite(
  config: AppwriteDataSource,
  options: FetchOptions = {}
): Promise<any[]> {
  const cacheKey = `appwrite-${config.databaseId}-${config.collectionId}-${JSON.stringify(config.queries || [])}`;
  
  // Check cache
  if (options.cache !== false) {
    const cached = dataCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < (options.cacheDuration || DEFAULT_CACHE_DURATION)) {
      return cached.data;
    }
  }

  try {
    // Import Appwrite client dynamically to avoid bundling issues
    // In a real implementation, this would use the actual Appwrite SDK
    // For now, return placeholder
    console.warn("Appwrite integration not yet implemented");
    
    // TODO: Implement actual Appwrite fetching
    // const { databases } = await import("@/lib/appwrite");
    // const response = await databases.listDocuments(
    //   config.databaseId,
    //   config.collectionId,
    //   config.queries
    // );
    
    const data: any[] = [];
    
    // Cache the result
    if (options.cache !== false) {
      dataCache.set(cacheKey, { data, timestamp: Date.now() });
    }
    
    return data;
  } catch (error) {
    console.error("Error fetching from Appwrite:", error);
    return [];
  }
}

/**
 * Fetch data from external API
 */
async function fetchFromApi(
  config: ApiDataSource,
  options: FetchOptions = {}
): Promise<any[]> {
  const cacheKey = `api-${config.url}-${config.method || "GET"}`;
  
  // Check cache
  if (options.cache !== false) {
    const cached = dataCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < (options.cacheDuration || DEFAULT_CACHE_DURATION)) {
      return cached.data;
    }
  }

  try {
    const response = await fetch(config.url, {
      method: config.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...config.headers,
      },
      body: config.body ? JSON.stringify(config.body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Ensure data is an array
    const arrayData = Array.isArray(data) ? data : [data];
    
    // Cache the result
    if (options.cache !== false) {
      dataCache.set(cacheKey, { data: arrayData, timestamp: Date.now() });
    }
    
    return arrayData;
  } catch (error) {
    console.error("Error fetching from API:", error);
    return [];
  }
}

/**
 * Get static data
 */
function getStaticData(config: StaticDataSource): Promise<any[]> {
  return Promise.resolve(config.data);
}

/**
 * Main data fetcher function
 */
export async function fetchData(
  source: DataSource,
  options: FetchOptions = {}
): Promise<any[]> {
  switch (source.type) {
    case "appwrite":
      return fetchFromAppwrite(source.config as AppwriteDataSource, options);
    case "api":
      return fetchFromApi(source.config as ApiDataSource, options);
    case "static":
      return getStaticData(source.config as StaticDataSource);
    default:
      console.error("Unknown data source type:", (source as any).type);
      return [];
  }
}

/**
 * Clear data cache
 */
export function clearDataCache(pattern?: string): void {
  if (!pattern) {
    dataCache.clear();
    return;
  }
  
  const keysToDelete: string[] = [];
  dataCache.forEach((_, key) => {
    if (key.includes(pattern)) {
      keysToDelete.push(key);
    }
  });
  
  keysToDelete.forEach((key) => dataCache.delete(key));
}

/**
 * Transform data using a mapping configuration
 */
export function transformData(
  data: any[],
  mapping?: Record<string, string>,
  transform?: (item: any) => any
): any[] {
  let transformed = data;
  
  // Apply mapping if provided
  if (mapping) {
    transformed = data.map((item) => {
      const mapped: any = {};
      Object.entries(mapping).forEach(([targetKey, sourceKey]) => {
        mapped[targetKey] = item[sourceKey];
      });
      return mapped;
    });
  }
  
  // Apply custom transform if provided
  if (transform) {
    transformed = transformed.map(transform);
  }
  
  return transformed;
}

/**
 * Helper to create data source configurations
 */
export const createDataSource = {
  appwrite: (
    databaseId: string,
    collectionId: string,
    queries?: string[]
  ): DataSource => ({
    type: "appwrite",
    config: { databaseId, collectionId, queries },
  }),
  
  api: (url: string, options?: Omit<ApiDataSource, "url">): DataSource => ({
    type: "api",
    config: { url, ...options },
  }),
  
  static: (data: any[]): DataSource => ({
    type: "static",
    config: { data },
  }),
};


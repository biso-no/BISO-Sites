import type { ImageData, DataSourceConfig } from "../types";

/**
 * Check if an ImageData object has valid data
 */
export function hasImageData(image?: ImageData): boolean {
  if (!image) return false;
  return !!(image.url || image.fileId);
}

/**
 * Get the URL from ImageData (prioritizes url, falls back to fileId)
 */
export function getImageUrl(image?: ImageData): string | undefined {
  if (!image) return undefined;
  return image.url;
}

/**
 * Create an ImageData object from upload response
 */
export function createImageData(
  fileId: string,
  url: string,
  alt?: string
): ImageData {
  return {
    type: "upload",
    fileId,
    url,
    alt,
  };
}

/**
 * Check if data source is in database mode
 */
export function isDatabaseMode(config?: DataSourceConfig): boolean {
  return config?.type === "database";
}

/**
 * Check if data source is in manual mode
 */
export function isManualMode(config?: DataSourceConfig | string): boolean {
  if (typeof config === "string") {
    return config === "manual";
  }
  return !config || config.type === "manual";
}

/**
 * Map database fields to component props based on field mapping
 */
export function mapDatabaseFields<T = any>(
  dbRecord: Record<string, any>,
  fieldMapping?: Record<string, string>
): Partial<T> {
  if (!fieldMapping) return dbRecord as Partial<T>;

  const mapped: Record<string, any> = {};

  Object.entries(fieldMapping).forEach(([componentField, dbField]) => {
    if (dbField in dbRecord) {
      mapped[componentField] = dbRecord[dbField];
    }
  });

  return mapped as Partial<T>;
}

/**
 * Generate unique ID for array items
 */
export function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Format database count/sum results as stat items
 */
export function formatAsStats(
  value: number,
  label: string,
  icon?: string
): { id: string; number: string; label: string; icon?: string } {
  return {
    id: generateId(),
    number: value.toString(),
    label,
    icon,
  };
}

/**
 * Debounce function for query preview
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}


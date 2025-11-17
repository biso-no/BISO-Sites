import type { PageBuilderDocument } from "@repo/editor/types";

/**
 * Extracts the structure signature of a content array
 * Returns an array of component types in order
 */
function getContentStructure(content: PageBuilderDocument["content"]): string[] {
  if (!Array.isArray(content)) return [];
  
  return content.map((item) => {
    if (!item || typeof item !== "object") return "unknown";
    return item.type || "unknown";
  });
}

/**
 * Recursively compares the structure of two page documents
 * Only checks component types and order, ignoring props/content
 */
export function areDocumentsInSync(
  docA: PageBuilderDocument | null | undefined,
  docB: PageBuilderDocument | null | undefined
): boolean {
  // Both null/undefined = in sync
  if (!docA && !docB) return true;
  
  // One null/undefined, other not = out of sync
  if (!docA || !docB) return false;
  
  // Compare content array structures
  const structureA = getContentStructure(docA.content);
  const structureB = getContentStructure(docB.content);
  
  // Different lengths = out of sync
  if (structureA.length !== structureB.length) return false;
  
  // Compare each component type
  for (let i = 0; i < structureA.length; i++) {
    if (structureA[i] !== structureB[i]) return false;
  }
  
  return true;
}

/**
 * Checks if all provided documents have the same structure
 */
export function areAllDocumentsInSync(
  documents: Array<PageBuilderDocument | null | undefined>
): boolean {
  if (documents.length <= 1) return true;
  
  const [first, ...rest] = documents;
  
  return rest.every((doc) => areDocumentsInSync(first, doc));
}

/**
 * Gets sync status for a set of locale documents
 * Returns true if all documents have matching structures
 */
export function getLocaleSyncStatus(
  documents: Map<string, PageBuilderDocument | null | undefined>
): boolean {
  const docArray = Array.from(documents.values());
  return areAllDocumentsInSync(docArray);
}


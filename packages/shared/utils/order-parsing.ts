export function parseOrderItems(itemsJson?: string | null): any[] {
  if (!itemsJson) {
    return [];
  }

  try {
    return JSON.parse(itemsJson);
  } catch (error) {
    console.error("Error parsing order items:", error);
    return [];
  }
}

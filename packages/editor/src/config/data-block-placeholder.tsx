"use client";

/**
 * Placeholder skeleton shown inside the editor canvas (puck.isEditing === true)
 * for data-display blocks. Prevents live Appwrite fetches during editing.
 */
export function DataBlockPlaceholder({
  type,
  itemCount = 3,
}: {
  type: string;
  itemCount?: number;
}) {
  return (
    <div className="w-full rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50 p-8">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gray-200 text-xs font-bold text-gray-500">
          {type.charAt(0)}
        </div>
        <div>
          <div className="text-sm font-semibold text-gray-600">{type}</div>
          <div className="text-xs text-gray-400">
            {itemCount} {itemCount === 1 ? "item" : "items"} from database
          </div>
        </div>
      </div>
      <div
        className="grid gap-3"
        style={{
          gridTemplateColumns: `repeat(${Math.min(itemCount, 3)}, 1fr)`,
        }}
      >
        {Array.from({ length: Math.min(itemCount, 6) }, (_, i) => (
          <div
            key={i}
            className="space-y-2 rounded-lg border border-gray-200 bg-white p-4"
          >
            <div className="h-20 w-full animate-pulse rounded-md bg-gray-100" />
            <div className="h-3 w-3/4 animate-pulse rounded bg-gray-100" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-gray-100" />
          </div>
        ))}
      </div>
    </div>
  );
}

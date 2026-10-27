import type { ReactNode } from "react";

interface ItemListProps<T> {
  addLabel: string;
  items: T[];
  max?: number;
  newItem: () => T;
  onChange: (items: T[]) => void;
  renderItem: (item: T, update: (next: T) => void, index: number) => ReactNode;
  title: (item: T, index: number) => string;
}

const ROW_STYLE = {
  marginBottom: 10,
  paddingBottom: 10,
  borderBottom: "0.5px solid var(--rule)",
} as const;

const ROW_HEAD_STYLE = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 4,
} as const;

const ICON_BUTTON_STYLE = {
  width: 18,
  height: 18,
  borderRadius: "50%",
  border: 0,
  background: "var(--rule-2)",
  cursor: "pointer",
  fontSize: 9,
  display: "grid",
  placeItems: "center",
} as const;

const ADD_BUTTON_STYLE = {
  fontSize: 12,
  padding: "4px 8px",
  border: "0.5px solid var(--rule-2)",
  borderRadius: 6,
  background: "var(--paper-2)",
  cursor: "pointer",
} as const;

function move<T>(items: T[], from: number, to: number): T[] {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** A reorderable list of inspector rows, styled like the stats inspector. */
export function ItemList<T>({
  addLabel,
  items,
  max,
  newItem,
  onChange,
  renderItem,
  title,
}: ItemListProps<T>) {
  const full = max !== undefined && items.length >= max;
  return (
    <div>
      {items.map((item, i) => (
        <div key={i} style={ROW_STYLE}>
          <div style={ROW_HEAD_STYLE}>
            <span style={{ fontSize: 11, color: "var(--ink-3)" }}>
              {title(item, i)}
            </span>
            <span style={{ display: "flex", gap: 4 }}>
              <button
                aria-label="Move up"
                disabled={i === 0}
                onClick={() => onChange(move(items, i, i - 1))}
                style={ICON_BUTTON_STYLE}
                type="button"
              >
                ↑
              </button>
              <button
                aria-label="Move down"
                disabled={i === items.length - 1}
                onClick={() => onChange(move(items, i, i + 1))}
                style={ICON_BUTTON_STYLE}
                type="button"
              >
                ↓
              </button>
              <button
                aria-label="Remove"
                onClick={() => onChange(items.filter((_, j) => j !== i))}
                style={ICON_BUTTON_STYLE}
                type="button"
              >
                ✕
              </button>
            </span>
          </div>
          {renderItem(
            item,
            (next) => onChange(items.map((x, j) => (j === i ? next : x))),
            i
          )}
        </div>
      ))}
      <button
        disabled={full}
        onClick={() => onChange([...items, newItem()])}
        style={ADD_BUTTON_STYLE}
        type="button"
      >
        {addLabel}
      </button>
    </div>
  );
}

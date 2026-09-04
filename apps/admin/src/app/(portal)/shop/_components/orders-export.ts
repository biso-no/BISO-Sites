/**
 * The client half of the orders CSV export.
 *
 * The server action builds the whole filtered file (cursor-paged, so it reaches
 * past the 5000 rows the screen can offset into); the browser half is only the
 * `Blob` -> object URL -> `<a download>` dance plus the toast that says what
 * happened. That split is why this is a plain module taking its dependencies as
 * arguments: the decision table is unit-testable without a DOM, a network, or
 * a running toast surface.
 */

import type { OrderFilters } from "../../_actions/shop";

export interface OrdersExportResult {
  csv: string;
  rowCount: number;
  truncated: boolean;
}

export interface OrdersExportInput {
  filters: OrderFilters;
  headers: string[];
}

export interface OrdersExportMessages {
  empty: string;
  failed: string;
  success: (rowCount: number) => string;
  truncated: (rowCount: number) => string;
}

export interface OrdersExportDeps {
  exportCsv: (input: OrdersExportInput) => Promise<OrdersExportResult>;
  notify: {
    error: (message: string) => void;
    success: (message: string) => void;
    warning: (message: string) => void;
  };
  save: (csv: string, fileName: string) => void;
}

/** `orders-2026-09-04.csv` — the date the file was pulled, not a filter bound. */
export function ordersCsvFileName(now: Date = new Date()): string {
  return `orders-${now.toISOString().slice(0, 10)}.csv`;
}

export async function runOrdersExport(
  deps: OrdersExportDeps,
  input: OrdersExportInput,
  messages: OrdersExportMessages,
  fileName: string
): Promise<void> {
  let result: OrdersExportResult;
  try {
    result = await deps.exportCsv(input);
  } catch {
    deps.notify.error(messages.failed);
    return;
  }

  if (result.rowCount === 0) {
    // A header-only file looks like a broken export; say so instead.
    deps.notify.error(messages.empty);
    return;
  }

  deps.save(result.csv, fileName);

  if (result.truncated) {
    // The export's own ceiling — a different, much larger one than the 500
    // matching orders the product-filtered LIST is capped at.
    deps.notify.warning(messages.truncated(result.rowCount));
    return;
  }
  deps.notify.success(messages.success(result.rowCount));
}

/** Hands the finished CSV to the browser as a download. */
export function saveCsvFile(csv: string, fileName: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

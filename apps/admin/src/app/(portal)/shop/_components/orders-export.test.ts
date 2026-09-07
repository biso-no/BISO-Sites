import { describe, expect, test } from "bun:test";
import {
  type OrdersExportResult,
  ordersCsvFileName,
  runOrdersExport,
} from "./orders-export";

const messages = {
  empty: "empty",
  failed: "failed",
  success: (orders: number, rows: number) => `success:${orders}/${rows}`,
  truncated: (orders: number, rows: number) => `truncated:${orders}/${rows}`,
};

const input = { filters: { status: "paid" }, headers: ["Order ID"] };

function harness(run: () => Promise<OrdersExportResult>): {
  deps: Parameters<typeof runOrdersExport>[0];
  notices: string[];
  saved: { csv: string; fileName: string }[];
} {
  const notices: string[] = [];
  const saved: { csv: string; fileName: string }[] = [];
  return {
    deps: {
      exportCsv: run,
      notify: {
        error: (m: string) => notices.push(`error:${m}`),
        success: (m: string) => notices.push(`success:${m}`),
        warning: (m: string) => notices.push(`warning:${m}`),
      },
      save: (csv: string, fileName: string) => saved.push({ csv, fileName }),
    },
    notices,
    saved,
  };
}

describe("runOrdersExport", () => {
  test("saves the server's CSV and reports orders and rows separately", async () => {
    // One row per order ITEM: three lines across two orders. Reporting the row
    // count as "orders" would overstate the sale.
    const { deps, notices, saved } = harness(() =>
      Promise.resolve({
        csv: "a,b\n1,2",
        orderCount: 2,
        rowCount: 3,
        truncated: false,
      })
    );

    await runOrdersExport(deps, input, messages, "orders-2026-09-04.csv");

    expect(saved).toEqual([
      { csv: "a,b\n1,2", fileName: "orders-2026-09-04.csv" },
    ]);
    expect(notices).toEqual(["success:success:2/3"]);
  });

  test("still saves a truncated export but warns that the file was cut", async () => {
    // The export's ceiling is its own, and far above the 500-order product
    // filter ceiling the list banner talks about — the user must be told the
    // FILE is short, not the screen.
    const { deps, notices, saved } = harness(() =>
      Promise.resolve({
        csv: "a,b\n1,2",
        orderCount: 20_000,
        rowCount: 26_500,
        truncated: true,
      })
    );

    await runOrdersExport(deps, input, messages, "orders.csv");

    expect(saved).toHaveLength(1);
    expect(notices).toEqual(["warning:truncated:20000/26500"]);
  });

  test("does not download an empty file", async () => {
    const { deps, notices, saved } = harness(() =>
      Promise.resolve({ csv: "", orderCount: 0, rowCount: 0, truncated: false })
    );

    await runOrdersExport(deps, input, messages, "orders.csv");

    expect(saved).toHaveLength(0);
    expect(notices).toEqual(["error:empty"]);
  });

  test("reports a failed export instead of throwing at the click handler", async () => {
    const { deps, notices, saved } = harness(() =>
      Promise.reject(new Error("appwrite exploded"))
    );

    await runOrdersExport(deps, input, messages, "orders.csv");

    expect(saved).toHaveLength(0);
    expect(notices).toEqual(["error:failed"]);
  });

  test("passes the filters and headers straight through to the server action", async () => {
    let received: unknown = null;
    const { deps } = harness(() => Promise.resolve({} as OrdersExportResult));
    const spied = {
      ...deps,
      exportCsv: (arg: unknown) => {
        received = arg;
        return Promise.resolve({
          csv: "",
          orderCount: 1,
          rowCount: 1,
          truncated: false,
        });
      },
    };

    await runOrdersExport(spied, input, messages, "orders.csv");

    expect(received).toEqual(input);
  });
});

describe("ordersCsvFileName", () => {
  test("stamps the file with the export date", () => {
    expect(ordersCsvFileName(new Date("2026-09-04T22:15:00.000Z"))).toBe(
      "orders-2026-09-04.csv"
    );
  });
});

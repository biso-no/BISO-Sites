/**
 * Clears the "posting" marker on an order whose Finago post was attempted but
 * never recorded, so the reconcile sweep can post it again. Refuses unless the
 * order carries the marker AND Finago has no transaction line mentioning the
 * order id around its date. Dry-run by default; pass --apply to write.
 *
 * Usage (from packages/api):
 *   bun run finago:reset-stranded-posting -- 6aa19747003c79019977
 *   bun run finago:reset-stranded-posting -- 6aa19747003c79019977 --apply
 */
import { Client, TablesDB } from "node-appwrite";
import {
  collectAllTransactionLines,
  parseNextLinkUrl,
} from "./finago-transaction-lines-paging";

const DAY_MS = 24 * 60 * 60 * 1000;
const LOOKBACK_DAYS = 1;
const LOOKAHEAD_DAYS = 5;
// The endpoint's `limit` caps lines per page; pagination (below) follows the
// `Link` response header for anything beyond this, so the value only trades
// off request count against page size.
const TRANSACTION_LINES_PAGE_SIZE = 200;

const endpoint =
  process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? process.env.APPWRITE_ENDPOINT;
const project =
  process.env.NEXT_PUBLIC_APPWRITE_PROJECT ?? process.env.APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;
const clientId = process.env.TFSO_REST_CLIENT_ID;
const clientSecret = process.env.TFSO_REST_CLIENT_SECRET;
const orgId = process.env.TFSO_REST_ORG_ID;

const orderId = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
const apply = process.argv.includes("--apply");

if (!(endpoint && project && apiKey && clientId && clientSecret && orgId)) {
  console.error("Missing Appwrite or TFSO_REST_* configuration.");
  process.exit(2);
}
if (!orderId) {
  console.error("Pass the order id as the first argument.");
  process.exit(2);
}

const db = new TablesDB(
  new Client().setEndpoint(endpoint).setProject(project).setKey(apiKey)
);
const order = (await db.getRow({
  databaseId: "app",
  rowId: orderId,
  tableId: "orders",
})) as unknown as {
  $createdAt: string;
  finago_posting_lock?: number | null;
  finago_transaction_id?: string | null;
  status?: string | null;
  total?: number | null;
};

console.log(
  `Order ${orderId}: status=${order.status} total=${order.total} finago_transaction_id=${order.finago_transaction_id} lock=${order.finago_posting_lock}`
);
if (order.finago_transaction_id !== "posting") {
  console.error('Refusing: the order does not carry the "posting" marker.');
  process.exit(1);
}

const tokenResponse = await fetch(
  "https://login.24sevenoffice.com/oauth/token",
  {
    body: new URLSearchParams({
      audience: "https://api.24sevenoffice.com",
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
      login_organization: orgId,
    }),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    method: "POST",
  }
);
const { access_token: token } = (await tokenResponse.json()) as {
  access_token?: string;
};
if (!token) {
  console.error("Could not get a Finago token.");
  process.exit(1);
}

const created = Date.parse(order.$createdAt);
const dateFrom = new Date(created - LOOKBACK_DAYS * DAY_MS)
  .toISOString()
  .slice(0, 10);
// `dateTo` is EXCLUSIVE on this endpoint (lines are returned up to 23:59 on
// the day before dateTo), so add one extra day to actually cover
// LOOKAHEAD_DAYS full days after the order was created.
const dateTo = new Date(created + (LOOKAHEAD_DAYS + 1) * DAY_MS)
  .toISOString()
  .slice(0, 10);

const firstLinesUrl = new URL(
  "https://rest.api.24sevenoffice.com/v1/transactionlines"
);
firstLinesUrl.searchParams.set("dateFrom", dateFrom);
firstLinesUrl.searchParams.set("dateTo", dateTo);
firstLinesUrl.searchParams.set("limit", String(TRANSACTION_LINES_PAGE_SIZE));

const paged = await collectAllTransactionLines(
  firstLinesUrl.toString(),
  async (url) => {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => null);
    if (!response?.ok) {
      return { lines: [], nextUrl: null, ok: false };
    }
    const body: unknown = await response.json().catch(() => null);
    if (!Array.isArray(body)) {
      return { lines: [], nextUrl: null, ok: false };
    }
    return {
      lines: body,
      nextUrl: parseNextLinkUrl(response.headers.get("link")),
      ok: true,
    };
  }
);
if (!paged.ok) {
  console.error(
    `Refusing: could not read Finago transaction lines (${paged.reason ?? "unknown error"}).`
  );
  process.exit(1);
}
const lines = paged.lines;
const mentions = lines.filter((line) => JSON.stringify(line).includes(orderId));

console.log(
  `Finago lines ${dateFrom}..${dateTo}: ${lines.length}; mentioning the order: ${mentions.length}`
);
if (mentions.length > 0) {
  console.error(
    "Refusing: Finago already has lines for this order. Record that transaction id on the order by hand instead."
  );
  process.exit(1);
}

if (!apply) {
  console.log(
    "Dry-run: would clear finago_transaction_id and the posting lock."
  );
  process.exit(0);
}

await db.updateRow({
  data: { finago_posting_lock: 0, finago_transaction_id: null },
  databaseId: "app",
  rowId: orderId,
  tableId: "orders",
});
console.log("Cleared. The next reconcile sweep will post the order.");

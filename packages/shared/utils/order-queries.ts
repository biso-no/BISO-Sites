import { Query } from "@repo/api";

/** Load line items and the product/variation identities needed downstream. */
export const ORDER_ITEMS_SELECT = Query.select([
  "*",
  "order_items.*",
  "order_items.product.*",
  "order_items.variation.*",
]);

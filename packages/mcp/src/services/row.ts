/**
 * Row projection types.
 *
 * `TablesDB.listRows<T>` / `getRow<T>` constrain `T` to `Models.Row`, so a
 * hand-written projection has to carry Appwrite's system columns (`$id`,
 * `$createdAt`, `$sequence`, …) even when the query only selects a few
 * business columns. `Projected` adds them, so a call site declares just the
 * columns it asked for.
 *
 * This is a type-level convenience only: it does not make the system columns
 * present at runtime if `Query.select` left them out. Every projection in this
 * package that reads `$id` or `$createdAt` selects them explicitly.
 */

import type { Models } from "@repo/api";

export type Projected<T> = Models.Row & T;

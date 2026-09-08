import { ID, type Models, Permission, Query, Role } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type { CartReservations } from "@repo/api/types/appwrite";
import {
  computeAvailableStock,
  sumReservedQuantity,
} from "@repo/shared/utils/stock-availability";
import { type NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/lib/auth";
import { applyCorsHeaders, corsPreflightResponse } from "@/lib/cors";

/**
 * Cart stock holds for clients without a server of their own (the native app).
 *
 * Adding something to a cart on the website writes a `cart_reservations` row
 * that holds the stock for ten minutes, so two students cannot both check out
 * the last hoodie while one of them is still deciding. Available stock
 * everywhere is `product.stock − Σ(active reservations)`.
 *
 * The app cannot write those rows itself: `cart_reservations` has row security
 * on and grants no create permission to end users, deliberately — the row
 * records how much stock a buyer is holding, so only a server may mint one.
 * This route is that server, and it mirrors the web actions in
 * `apps/web/src/app/actions/cart-reservations.ts` one-for-one:
 *
 *   PUT    { productId, quantity, … }  → upsert, clamped to live availability
 *   DELETE ?productId=…                → release one product's hold
 *   DELETE                             → release the whole cart
 *
 * Deliberately per-product rather than "replace my whole cart": a buyer may
 * have the website open on a laptop at the same time, and a wholesale replace
 * would silently drop the items they added there.
 *
 * Holding stock is a courtesy, not the safety net. Overselling is prevented by
 * the checkout route re-validating availability and by the atomic stock
 * decrement on payment, neither of which depends on a reservation existing.
 */

const RESERVATION_TTL_MS = 10 * 60 * 1000;
const MAX_RESERVATION_ROWS = 1000;

interface ReservationBody {
  customFieldLabels?: Record<string, string>;
  customFields?: Record<string, string>;
  productId?: string;
  quantity?: number;
}

type CartDb = Awaited<ReturnType<typeof createAdminClient>>["db"];

function hasBearerToken(req: NextRequest): boolean {
  return req.headers.get("authorization")?.startsWith("Bearer ") ?? false;
}

async function authenticate(req: NextRequest): Promise<string | null> {
  if (!hasBearerToken(req)) {
    return null;
  }
  try {
    const client = await createAuthenticatedClient(req);
    const user = await client.account.get();
    return user?.$id ?? null;
  } catch {
    return null;
  }
}

function buildUserRowPermissions(userId: string): string[] {
  const user = Role.user(userId);
  return [
    Permission.read(user),
    Permission.update(user),
    Permission.delete(user),
  ];
}

/**
 * The buyer's answers become `cart_field_answers` rows so they survive the
 * cart being reloaded on another device, and so checkout can read back what
 * was filled in. `label` is stored alongside the key because the question may
 * be relabelled before the order is placed.
 */
function buildAnswerRows(
  body: ReservationBody,
  permissions: string[]
): Record<string, unknown>[] {
  return Object.entries(body.customFields ?? {})
    .filter(([, value]) => value?.trim())
    .map(([id, value], sortOrder) => ({
      $permissions: permissions,
      field: id,
      field_key: id,
      label: body.customFieldLabels?.[id] ?? id,
      sort_order: sortOrder,
      value,
    }));
}

/** All active reservations for a product, across every buyer. */
async function readActiveReservations(db: CartDb, productId: string) {
  const now = new Date().toISOString();
  const result = await db.listRows<CartReservations>(
    "app",
    "cart_reservations",
    [
      Query.equal("product_id", productId),
      Query.greaterThan("expires_at", now),
      Query.select(["quantity", "user_id"]),
      Query.limit(MAX_RESERVATION_ROWS),
    ]
  );
  return result.rows;
}

/** The caller's own reservation row for a product, expired ones included. */
async function readOwnReservation(
  db: CartDb,
  productId: string,
  userId: string
) {
  const result = await db.listRows<CartReservations & { $id: string }>(
    "app",
    "cart_reservations",
    [
      Query.equal("product_id", productId),
      Query.equal("user_id", userId),
      Query.limit(1),
    ]
  );
  return result.rows[0] ?? null;
}

/**
 * How many units the caller may hold right now: what is left after everyone
 * else's active holds, plus their own active hold added back so editing their
 * own quantity is not blocked by it. `null` stock means untracked (no cap).
 *
 * An *expired* own hold is deliberately not credited back: availability
 * ignores expired rows, so counting one would inflate the ceiling and allow an
 * oversell until the cleanup cron catches up.
 */
async function computeCallerCeiling(
  db: CartDb,
  productId: string,
  userId: string,
  stock: number | null
): Promise<number> {
  if (stock === null) {
    return Number.POSITIVE_INFINITY;
  }
  const reservations = await readActiveReservations(db, productId);
  const totalReserved = sumReservedQuantity(reservations);
  const ownActiveHold = sumReservedQuantity(
    reservations.filter((row) => row.user_id === userId)
  );
  return computeAvailableStock(stock, totalReserved) + ownActiveHold;
}

async function readProductStock(
  db: CartDb,
  productId: string
): Promise<{ found: boolean; stock: number | null }> {
  try {
    const product = await db.getRow<
      Models.Row & { status?: string; stock?: number | null }
    >("app", "webshop_products", productId, [
      Query.select(["status", "stock"]),
    ]);
    if (product.status !== "published") {
      return { found: false, stock: null };
    }
    return {
      found: true,
      stock: typeof product.stock === "number" ? product.stock : null,
    };
  } catch {
    return { found: false, stock: null };
  }
}

export async function PUT(req: NextRequest) {
  const origin = req.headers.get("origin");
  const json = (data: unknown, status = 200) =>
    applyCorsHeaders(NextResponse.json(data, { status }), origin);

  try {
    const userId = await authenticate(req);
    if (!userId) {
      return json({ message: "Authentication required" }, 401);
    }

    const body = (await req.json().catch(() => null)) as ReservationBody | null;
    const productId = body?.productId;
    const requested = Math.floor(Number(body?.quantity ?? 0));
    const hasValidQuantity = Number.isFinite(requested) && requested >= 1;
    if (!(productId && hasValidQuantity)) {
      return json({ message: "Invalid reservation payload" }, 400);
    }

    const { db } = await createAdminClient();
    const { found, stock } = await readProductStock(db, productId);
    if (!found) {
      return json({ message: "Product is not available" }, 404);
    }

    const ceiling = await computeCallerCeiling(db, productId, userId, stock);
    if (ceiling <= 0) {
      return json({ message: "Out of stock", quantity: 0 }, 409);
    }

    const quantity = Math.max(1, Math.min(requested, ceiling));
    const expiresAt = new Date(Date.now() + RESERVATION_TTL_MS).toISOString();
    const permissions = buildUserRowPermissions(userId);
    // Sent only when this write carried answers, so a plain quantity change
    // does not wipe what the buyer already filled in. Replacing the child list
    // drops the previous rows (cascade delete).
    const answers = body?.customFields
      ? { field_answers: buildAnswerRows(body, permissions) }
      : {};

    const existing = await readOwnReservation(db, productId, userId);
    if (existing) {
      await db.updateRow("app", "cart_reservations", existing.$id, {
        quantity,
        expires_at: expiresAt,
        ...answers,
      });
    } else {
      await db.createRow(
        "app",
        "cart_reservations",
        ID.unique(),
        {
          product_id: productId,
          user_id: userId,
          quantity,
          expires_at: expiresAt,
          field_answers: buildAnswerRows(body ?? {}, permissions),
        },
        permissions
      );
    }

    // The effective quantity may be below what was asked for; the client
    // reconciles its cart to this rather than to its own optimistic clamp.
    return json({ expiresAt, productId, quantity });
  } catch (error) {
    console.error("[shop/cart] reservation write failed:", error);
    return json({ message: "Failed to reserve stock" }, 500);
  }
}

export async function DELETE(req: NextRequest) {
  const origin = req.headers.get("origin");
  const json = (data: unknown, status = 200) =>
    applyCorsHeaders(NextResponse.json(data, { status }), origin);

  try {
    const userId = await authenticate(req);
    if (!userId) {
      return json({ message: "Authentication required" }, 401);
    }

    const productId = new URL(req.url).searchParams.get("productId");
    const { db } = await createAdminClient();

    // Always scoped to the caller: this runs on the admin client, which sees
    // every buyer's rows, so the user filter is what keeps one buyer from
    // clearing another's cart.
    const queries = [
      Query.equal("user_id", userId),
      Query.limit(MAX_RESERVATION_ROWS),
    ];
    if (productId) {
      queries.unshift(Query.equal("product_id", productId));
    }

    const reservations = await db.listRows<CartReservations & { $id: string }>(
      "app",
      "cart_reservations",
      queries
    );
    await Promise.all(
      reservations.rows.map((row) =>
        db.deleteRow("app", "cart_reservations", row.$id)
      )
    );

    return json({ released: reservations.rows.length });
  } catch (error) {
    console.error("[shop/cart] reservation delete failed:", error);
    return json({ message: "Failed to release stock" }, 500);
  }
}

export function OPTIONS(req: NextRequest) {
  return corsPreflightResponse(req.headers.get("origin"));
}

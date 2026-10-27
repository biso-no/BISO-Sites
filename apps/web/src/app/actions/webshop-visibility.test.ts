import { beforeEach, describe, expect, it, vi } from "vitest";

const sessionDb = vi.hoisted(() => ({ listRows: vi.fn() }));

vi.mock("@repo/api/server", () => ({
  createSessionClient: vi.fn(async () => ({ db: sessionDb })),
}));

import { getProduct } from "./products";
import {
  getProductBySlug,
  getProductDetailBySlug,
  listProducts,
} from "./webshop";

const queriesOf = (call: number): string[] =>
  sessionDb.listRows.mock.calls[call][2].map(String);

const UNLISTED_FILTER =
  '"method":"equal","attribute":"unlisted","values":[false]';
// A row written before the column existed carries null, not false, so the
// predicate has to treat null as "listed" or the whole catalogue disappears the
// moment the column is pushed.
const NULL_TOLERANT = '"method":"isNull","attribute":"unlisted"';
const PUBLISHED_FILTER =
  '"method":"equal","attribute":"status","values":["published"]';

describe("link-only products", () => {
  beforeEach(() => {
    sessionDb.listRows.mockReset();
    sessionDb.listRows.mockResolvedValue({ rows: [], total: 0 });
  });

  it("keeps unlisted products out of the shop listing", async () => {
    await listProducts({});

    const serialized = queriesOf(0).join("|");
    expect(serialized).toContain(UNLISTED_FILTER);
    expect(serialized).toContain(NULL_TOLERANT);
    expect(serialized).toContain(PUBLISHED_FILTER);
  });

  it("cannot be talked out of either filter by its arguments", async () => {
    // `listProducts` is a server action, so it is an ordinary POST endpoint the
    // browser can call with anything it likes. Neither filter may be reachable
    // through a parameter — `status` once was, and `status: "all"` dropped it.
    await listProducts({
      campus: "all",
      category: "all",
      limit: 500,
      locale: "no",
    });

    const serialized = queriesOf(0).join("|");
    expect(serialized).toContain(UNLISTED_FILTER);
    expect(serialized).toContain(NULL_TOLERANT);
    expect(serialized).toContain(PUBLISHED_FILTER);
  });

  it("still serves an unlisted product on its own page", async () => {
    // The whole point of the flag: absent from listings, reachable by link. A
    // filter here would 404 the link and make the feature useless.
    await getProductBySlug("julebord-2026", "no");

    const serialized = queriesOf(0).join("|");
    expect(serialized).not.toContain('"attribute":"unlisted"');
    // Still projected, so `generateMetadata` can mark the page `noindex`.
    expect(serialized).toContain("unlisted");
  });

  it("is served by the all-locale reader the product page renders from", async () => {
    // `/shop/<slug>` and its metadata read through `getProductDetailBySlug`
    // (every translation, so a product with no English row still renders).
    // It must sell a link-only product as well, and still refuse a draft.
    await getProductDetailBySlug("julebord-2026");

    const serialized = queriesOf(0).join("|");
    expect(serialized).not.toContain('"attribute":"unlisted"');
    expect(serialized).toContain("unlisted");
    expect(serialized).toContain(PUBLISHED_FILTER);
    // The checkout questions the storefront renders and checkout re-validates.
    expect(serialized).toContain("custom_fields.field_key");
  });
});

describe("member-only products", () => {
  beforeEach(() => {
    sessionDb.listRows.mockReset();
    sessionDb.listRows.mockResolvedValue({ rows: [], total: 0 });
  });

  it("never hides them — members-only limits who can buy, not who can see", async () => {
    await listProducts({});

    const serialized = queriesOf(0).join("|");
    // "member_only" stays in the projection so the card can render its badge,
    // so pin the filter's attribute key rather than the bare column name.
    expect(serialized).not.toContain('"attribute":"member_only"');
    expect(serialized).toContain("member_only");
  });
});

describe("the checkout read", () => {
  beforeEach(() => {
    sessionDb.listRows.mockReset();
    sessionDb.listRows.mockResolvedValue({ rows: [], total: 0 });
  });

  it("sells every product the shop lists, whatever its languages", async () => {
    // The shop and the product page show every published product, and 52 of
    // the 55 have no English row. A locale filter here refused each of those
    // at checkout for an English reader, after it was already in the cart.
    await getProduct("product-1");

    const serialized = queriesOf(0).join("|");
    expect(serialized).not.toContain('"attribute":"translation_refs.locale"');
    expect(serialized).toContain("translation_refs.title");
    // Still never quotes a draft: `webshop_products` is readable by `any`.
    expect(serialized).toContain(PUBLISHED_FILTER);
  });
});

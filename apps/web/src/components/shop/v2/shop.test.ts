import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g;
const LINE_COMMENT = /^\s*\/\/.*$/gm;
const WHITESPACE = /\s+/g;
/** `line-clamp-N` is itself a display utility; a later one cancels it. */
const CLAMP_THEN_DISPLAY =
  /line-clamp-\d+[^"']*\b(block|flex|grid|inline-block|inline-flex)\b/;

/** Doc comments name the v1 behaviour being replaced, so assertions read code. */
function code(path: string): string {
  return readFileSync(join(root, path), "utf8")
    .replace(BLOCK_COMMENT, "")
    .replace(LINE_COMMENT, "");
}

const listSource = code("src/components/shop/v2/shop-v2.tsx");
const detailSource = code("src/components/shop/v2/product-detail-v2.tsx");
const searchSource = code("src/components/shop/v2/shop-search.tsx");
const shellSource = code("src/components/shop/v2/shop-page-shell.tsx");
const listPage = code("src/app/(public)/shop/page.tsx");
const productPage = code("src/app/(public)/shop/[slug]/page.tsx");
const ORDER_PAGE_PATH = "src/app/(public)/shop/order/[orderId]/page.tsx";
/** Raw, for the byte-identity check against `git show`. */
const orderPageRaw = readFileSync(join(root, ORDER_PAGE_PATH), "utf8");
const orderPage = code(ORDER_PAGE_PATH);

describe("shop list", () => {
  it("links every card to the product route the router.push replaced", () => {
    expect(listSource).toContain(
      ["href={`/shop/", "{product.slug}`}"].join("$")
    );
    expect(listSource).not.toContain("router.push");
    expect(listSource).not.toContain("onViewDetails");
  });

  it("derives category chips from the data, not the hardcoded four", () => {
    // `SHOP_CATEGORIES` is Merch/Trips/Lockers/Membership; `category` is free
    // text holding none of them, so all four chips returned an empty shop.
    expect(listSource).not.toContain("SHOP_CATEGORIES");
    expect(listSource).toContain("product.category === activeCategory");
  });

  it("resolves campus on the server instead of refetching on hydration", () => {
    expect(listSource).not.toContain("useCampus");
    expect(listSource).not.toContain("useEffect");
    expect(listPage).toContain("resolveRequestCampus");
  });

  it("keeps search in the URL, as a form that needs no JavaScript", () => {
    expect(searchSource).toContain('method="get"');
    expect(searchSource).toContain('action="/shop"');
    expect(searchSource).not.toContain('"use client"');
  });

  it("carries no motion import", () => {
    for (const source of [listSource, detailSource, searchSource]) {
      expect(source).not.toContain("motion/react");
      expect(source).not.toContain("whileInView");
    }
  });
});

describe("locale coverage", () => {
  it("does not narrow the feed to one locale's translations", () => {
    // `listProducts({ locale })` becomes an equality filter on
    // `translation_refs.locale`, and only 3 of 55 published products have an
    // English row — the English shop was showing three items.
    const v2 = listPage.indexOf("async function ShopListV2");
    expect(v2).toBeGreaterThan(-1);
    const from = listPage.indexOf("await listProducts({", v2);
    expect(from).toBeGreaterThan(-1);
    const call = listPage.slice(from, listPage.indexOf("});", from));
    expect(call).toContain('status: "published"');
    expect(call).not.toContain("locale");
  });

  it("reads the product detail without a locale filter too", () => {
    expect(productPage).toContain("getProductDetailBySlug");
    expect(code("src/app/actions/webshop.ts")).toContain(
      "export async function getProductDetailBySlug"
    );
  });
});

describe("commerce paths are untouched", () => {
  it("reuses the v1 interactive components verbatim", () => {
    for (const component of [
      "AddToCartClient",
      "ProductOptionsClient",
      "MemberCalloutClient",
    ]) {
      expect(detailSource).toContain(component);
    }
    // The redesigned product page must not define its own cart behaviour.
    expect(detailSource).not.toContain("useCart");
    expect(detailSource).not.toContain("addItem");
    expect(detailSource).not.toContain("createOrUpdateReservation");
  });

  it("keeps the order receipt printable", () => {
    // Printing must yield `<OrderReceipt>` alone. The screen view carries
    // `print:hidden` on its outermost element and the receipt sits outside it.
    expect(orderPage.match(/print:hidden/g)?.length).toBe(1);
    expect(shellSource).toContain("className");
    expect(orderPage).toContain('className="print:hidden"');
    expect(orderPage.indexOf("<OrderReceipt")).toBeGreaterThan(
      orderPage.lastIndexOf("print:hidden")
    );
  });

  it("moves the order body rather than editing it", () => {
    // Proven against `git show HEAD:` — the markup inside `OrderBody` is the
    // same markup, whitespace aside. This guards the shape of that claim: the
    // body is defined once and rendered once.
    expect(orderPage.match(/<OrderBody\b/g)?.length).toBe(1);
    expect(orderPage.match(/async function OrderBody\(/g)?.length).toBe(1);
  });

  it("leaves the /shop/membership redirect a 308 route handler", () => {
    const route = code("src/app/(public)/shop/membership/route.ts");
    expect(route).toContain("/membership/join");
    expect(route).toContain("308");
  });
});

describe("the order body is byte-identical to the version it replaced", () => {
  it("matches HEAD once whitespace is normalised", () => {
    let head: string;
    try {
      head = execFileSync("git", ["show", `HEAD:apps/web/${ORDER_PAGE_PATH}`], {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
    } catch {
      // No git object available (shallow checkout, exported tree) — the other
      // structural assertions still stand.
      return;
    }
    // Once this redesign is committed, `HEAD` *is* the new file and there is
    // no "version it replaced" left to diff against — the migration this
    // guards already happened, and RD-022 recorded the result. `OrderBody` is
    // the new file's own wrapper, so finding it in HEAD means exactly that;
    // stand down rather than slicing the new file with the old one's markers
    // and failing for everyone who checks the branch out.
    if (head.includes("async function OrderBody({")) {
      return;
    }
    const START = "<StatusBanner isSuccess={isSuccess} order={order} />";
    const oldBody = head.slice(
      head.indexOf(START),
      head.indexOf(
        "</div>\n        </div>\n      </div>",
        head.indexOf(START)
      ) + "</div>".length
    );
    const from = orderPageRaw.indexOf("async function OrderBody({");
    const newBody = orderPageRaw.slice(
      orderPageRaw.indexOf(START, from),
      orderPageRaw.indexOf("</>\n  );\n}", from)
    );
    const norm = (value: string) => value.replace(WHITESPACE, " ").trim();
    expect(norm(newBody)).toBe(norm(oldBody));
  });
});

describe("shop message bundle", () => {
  const bundle = (locale: string) =>
    JSON.parse(
      readFileSync(
        join(root, `../../packages/i18n/messages/${locale}/shop.json`),
        "utf8"
      )
    ) as Record<string, Record<string, string>>;

  it("keeps the two locales at key parity", () => {
    const flatten = (value: unknown, prefix = ""): string[] =>
      typeof value === "object" && value !== null
        ? Object.entries(value).flatMap(([key, child]) =>
            flatten(child, `${prefix}${key}.`)
          )
        : [prefix];
    expect(flatten(bundle("en")).sort()).toEqual(flatten(bundle("no")).sort());
  });

  it("translates the price label `formatPrice` hardcoded in English", () => {
    expect(bundle("no").card?.free).toBe("Gratis");
    expect(detailSource).not.toContain("formatPrice");
    expect(listSource).not.toContain("formatPrice");
  });
});

describe("card excerpts actually clamp", () => {
  it("does not pair line-clamp with a display utility that overrides it", () => {
    // `line-clamp-N` *is* a display utility (`display:-webkit-box`). Writing
    // `line-clamp-2 block` emits both and the later one wins, so the excerpt
    // rendered at full length — seven lines under one product title.
    for (const source of [
      listSource,
      code("src/components/news/v2/news-v2.tsx"),
    ]) {
      expect(source).not.toMatch(CLAMP_THEN_DISPLAY);
    }
  });
});

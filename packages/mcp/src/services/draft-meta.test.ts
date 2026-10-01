/**
 * A stored draft whose `meta` is missing is not a document.
 *
 * `PageDoc.meta` is `PageMeta`, not `PageMeta | null`. A stored
 * `{"blocks": [], "meta": null}` is therefore already outside the type, and
 * handing it back as a `PageDoc` makes every reader's dereference a lie. They
 * do dereference: `@repo/api/page-builder` reads `normalizedDoc.meta.slug`
 * unconditionally when it publishes, and `readPage` reads `doc.meta.slug`
 * whenever the row's own `slug` column is empty.
 *
 * `parseDoc` is the one place that decides, so `load` and the publish check
 * agree by construction: such a draft is **absent**, which is the path that
 * lets its owner repair it, and it is refused rather than copied over a
 * working published page.
 */

import { describe, expect, test } from "bun:test";
import { parseDoc } from "./pages";

const BLOCKS = '"blocks": []';

describe("parseDoc", () => {
  test("refuses a document whose meta is null", () => {
    expect(parseDoc(`{ ${BLOCKS}, "meta": null }`)).toBeNull();
  });

  test("refuses a document with no meta at all", () => {
    expect(parseDoc(`{ ${BLOCKS} }`)).toBeNull();
  });

  test("refuses meta that is not an object", () => {
    expect(parseDoc(`{ ${BLOCKS}, "meta": "home" }`)).toBeNull();
    expect(parseDoc(`{ ${BLOCKS}, "meta": [] }`)).toBeNull();
  });

  test("refuses meta with no slug, the field its readers require", () => {
    expect(parseDoc(`{ ${BLOCKS}, "meta": { "title": "Home" } }`)).toBeNull();
  });

  test("accepts meta that states a slug but little else", () => {
    // Deliberately permissive beyond `slug`: a draft that has lost its title
    // or its accent colour is repairable, and rejecting it here would make it
    // unloadable instead. Only what the readers dereference is required.
    const doc = parseDoc(`{ ${BLOCKS}, "meta": { "slug": "home" } }`);
    expect(doc?.meta.slug).toBe("home");
  });

  test("still refuses unparseable JSON and a missing blocks array", () => {
    expect(parseDoc("{not json")).toBeNull();
    expect(parseDoc('{ "meta": { "slug": "home" } }')).toBeNull();
    expect(parseDoc(null)).toBeNull();
  });
});

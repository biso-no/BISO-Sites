/**
 * Content registry tests.
 *
 * The registry is the single source of truth for what this package claims to
 * support, and it drives both tool registration and execution. These tests pin
 * the two properties that make that safe: every gap carries a reason, and the
 * status values match the Appwrite enums rather than a convenient guess.
 */

import { describe, expect, test } from "bun:test";

/** A reason for declining a read has to name the tool that does it. */
const BISO_TOOL_RE = /`biso_\w+`/;

import {
  CONTENT_DOMAINS,
  CONTENT_OPERATIONS,
  domainSpec,
  domainsSupporting,
  supportMatrix,
  supports,
  unsupportedReason,
} from "./content-registry";

const SHAREPOINT_I_RE = /SharePoint/i;
const ARCHIVE_I_RE = /archive/i;
const BISO_PAGE_PUBLISH_RE = /biso_page_publish/;
const ASSERTPRODUCTBOOKABLE_RE = /assertProductBookable/;

describe("registry completeness", () => {
  test("every domain declares a spec", () => {
    for (const domain of CONTENT_DOMAINS) {
      expect(domainSpec(domain).table).toBeTruthy();
    }
  });

  test("every unsupported operation carries a reason", () => {
    for (const domain of CONTENT_DOMAINS) {
      for (const operation of CONTENT_OPERATIONS) {
        if (!supports(domain, operation)) {
          const reason = unsupportedReason(domain, operation);
          expect(reason.length).toBeGreaterThan(0);
          // A reason that just restates the question is not a reason.
          expect(reason).not.toBe(`\`${operation}\` is not supported.`);
        }
      }
    }
  });

  test("a domain that declines a read says where to read it instead", () => {
    // `search`/`get` used to be asserted supported everywhere, which is the
    // kind of blanket claim that outlives the thing it describes: `pages` keeps
    // its translations in a table the generic content service does not decode,
    // and its dedicated tools apply a visibility rule the generic path does
    // not. The invariant that actually matters is that declining points
    // somewhere real.
    for (const domain of CONTENT_DOMAINS) {
      for (const operation of ["search", "get"] as const) {
        if (!supports(domain, operation)) {
          expect(unsupportedReason(domain, operation)).toMatch(BISO_TOOL_RE);
        }
      }
    }
  });

  test("the published status is one of the declared statuses", () => {
    for (const domain of CONTENT_DOMAINS) {
      const spec = domainSpec(domain);
      expect(spec.statuses).toContain(spec.publishedStatus);
      expect(spec.statuses).toContain(spec.draftStatus);
      if (spec.archivedStatus) {
        expect(spec.statuses).toContain(spec.archivedStatus);
      }
    }
  });
});

describe("status enums match the Appwrite schema", () => {
  // Transcribed from packages/api/appwrite.config.json. A schema change that
  // adds or renames a status should fail here before it fails at runtime.
  const EXPECTED: Record<string, readonly string[]> = {
    jobs: ["draft", "published", "closed"],
    events: ["draft", "published", "cancelled"],
    news: ["draft", "published"],
    benefits: ["draft", "published", "archived"],
    products: ["draft", "pending_approval", "published", "archived"],
    documents: ["draft", "published"],
    pages: ["draft", "published", "archived"],
  };

  for (const [domain, statuses] of Object.entries(EXPECTED)) {
    test(`${domain}`, () => {
      expect(domainSpec(domain as never).statuses).toEqual(statuses);
    });
  }
});

describe("the gaps the admin assistant papers over", () => {
  test("documents cannot be created — the assistant offers it with no adapter", () => {
    expect(supports("documents", "create_draft")).toBe(false);
    expect(unsupportedReason("documents", "create_draft")).toMatch(
      SHAREPOINT_I_RE
    );
  });

  test("benefits cannot be deleted — the assistant offers it with no adapter", () => {
    expect(supports("benefits", "delete")).toBe(false);
    expect(unsupportedReason("benefits", "delete")).toMatch(ARCHIVE_I_RE);
  });

  test("pages route to the page tools, not to generic content operations", () => {
    expect(supports("pages", "create_draft")).toBe(false);
    expect(unsupportedReason("pages", "publish")).toMatch(BISO_PAGE_PUBLISH_RE);
  });

  test("product publishing is deferred to the bookable gate", () => {
    expect(supports("products", "publish")).toBe(false);
    expect(unsupportedReason("products", "publish")).toMatch(
      ASSERTPRODUCTBOOKABLE_RE
    );
  });

  test("nothing supports delete in this release", () => {
    expect(domainsSupporting("delete")).toEqual([]);
  });
});

describe("supportMatrix", () => {
  test("covers every domain and operation", () => {
    const matrix = supportMatrix();
    expect(matrix).toHaveLength(CONTENT_DOMAINS.length);
    for (const row of matrix) {
      expect(Object.keys(row.operations)).toHaveLength(
        CONTENT_OPERATIONS.length
      );
    }
  });
});

/**
 * The content domain registry.
 *
 * The admin assistant advertises one `CONTENT_DOMAIN` enum across
 * search/get/create/update/publish/delete and then discovers per-domain gaps at
 * runtime: `documents` is offered for create and update but absent from both
 * switches, `benefits` is offered for delete but absent from that switch, and
 * `pages` has an entirely separate editor workflow. A model calling those gets
 * `Create not supported for domain: documents` after it has already told the
 * user it was creating something.
 *
 * So support is data here, one row per domain, derived from three things that
 * were actually checked: the table definition in `appwrite.config.json`, the
 * server actions that exist in `apps/admin`, and the row permissions each table
 * grants. `supports()` is the single source of truth for both tool registration
 * and execution, so a tool cannot be advertised for a domain that cannot run it.
 */

export const CONTENT_DOMAINS = [
  "jobs",
  "events",
  "news",
  "benefits",
  "products",
  "documents",
  "pages",
] as const;

export type ContentDomain = (typeof CONTENT_DOMAINS)[number];

export const CONTENT_OPERATIONS = [
  "search",
  "get",
  "create_draft",
  "update",
  "publish",
  "unpublish",
  "archive",
  "delete",
] as const;

export type ContentOperation = (typeof CONTENT_OPERATIONS)[number];

/** How a domain stores its translated title/description. */
export type TranslationModel =
  /** Child rows in `content_translations`, linked by a relationship column. */
  | { kind: "content_translations"; relationship: string; contentType: string }
  /** Child rows in `page_translations`; handled by the pages module. */
  | { kind: "page_translations" }
  /** Bilingual columns on the row itself (`title_nb` / `title_en`). */
  | { kind: "inline_columns" }
  /** No translations. */
  | { kind: "none" };

export interface ContentDomainSpec {
  /** Path template for a deep link into the admin app. */
  adminPath: (id: string) => string;
  /** The value an archive moves to, when the enum has one. */
  archivedStatus: string | null;
  domain: ContentDomain;
  /** The value a publish is reverted to. */
  draftStatus: string;
  /** Human note surfaced in the capability matrix resource. */
  note?: string;
  /** Path template on the public site, when the domain has a public page. */
  publicPath: ((slug: string) => string) | null;
  /** The value meaning publicly visible. */
  publishedStatus: string;
  /** Columns that carry campus/department ownership for scoping. */
  scope: {
    campusField: string | null;
    departmentField: string | null;
    /** Relationship paths, preferred for authorization. */
    campusRelation: string | null;
    departmentRelation: string | null;
  };
  /** Exact enum values from `appwrite.config.json`. */
  statuses: readonly string[];
  /** Extra columns worth returning in a summary projection. */
  summaryColumns: readonly string[];
  /** Which operations this package actually implements for this domain. */
  supported: Partial<Record<ContentOperation, true>>;
  table: string;
  translations: TranslationModel;
  /** Why an unsupported operation is unsupported. Shown verbatim to the model. */
  unsupportedReason: Partial<Record<ContentOperation, string>>;
}

const NOT_IMPLEMENTED_CREATE =
  "Creating this content type needs fields this package does not model yet. Use the admin app.";

export const CONTENT_REGISTRY: Readonly<
  Record<ContentDomain, ContentDomainSpec>
> = Object.freeze({
  jobs: {
    domain: "jobs",
    table: "jobs",
    statuses: ["draft", "published", "closed"],
    publishedStatus: "published",
    draftStatus: "draft",
    archivedStatus: "closed",
    translations: {
      kind: "content_translations",
      relationship: "translations",
      contentType: "job",
    },
    scope: {
      campusField: "campus_id",
      departmentField: "department_id",
      campusRelation: "campus.$id",
      departmentRelation: "department.$id",
    },
    supported: { search: true, get: true },
    unsupportedReason: {
      create_draft:
        "Vacancies carry a screening rubric, custom questions and an interview template that the recruitment studio owns. Create them in the admin app.",
      update: NOT_IMPLEMENTED_CREATE,
      publish:
        "Publishing a vacancy also opens its translation permissions and may be scheduled; that sequence lives in the recruitment publication path and is not reimplemented here.",
      unpublish: "See `publish`.",
      archive: "See `publish`.",
      delete: "Deleting a vacancy cascades to applications. Use the admin app.",
    },
    summaryColumns: [
      "slug",
      "status",
      "campus_id",
      "department_id",
      "application_deadline",
      "scheduled_publish_at",
    ],
    adminPath: (id) => `/jobs/${id}`,
    publicPath: (slug) => `/jobs/${slug}`,
    note: "Recruitment is HR-exclusive with global-admin break-glass; a plain department member sees nothing here even though general content is open to them.",
  },
  events: {
    domain: "events",
    table: "events",
    statuses: ["draft", "published", "cancelled"],
    publishedStatus: "published",
    draftStatus: "draft",
    archivedStatus: "cancelled",
    translations: {
      kind: "content_translations",
      relationship: "translation_refs",
      contentType: "event",
    },
    scope: {
      campusField: "campus_id",
      departmentField: "department_id",
      campusRelation: "campus.$id",
      departmentRelation: "department.$id",
    },
    supported: {
      search: true,
      get: true,
      create_draft: true,
      publish: true,
      unpublish: true,
    },
    unsupportedReason: {
      update:
        "Event updates touch pricing, capacity, ticket linkage and segments together; partial updates through this package could leave those inconsistent.",
      archive:
        "`cancelled` is a user-visible state with downstream messaging consequences. Cancel an event in the admin app.",
      delete:
        "Deleting an event cascades to attendees and segments. Use the admin app.",
    },
    summaryColumns: [
      "slug",
      "status",
      "campus_id",
      "department_id",
      "start_date",
      "end_date",
      "location",
      "capacity",
      "member_only",
      "pricing_mode",
      // Read by the quality audit, which flags a paid event with no member
      // price. A column the projection omits comes back `undefined`, which is
      // indistinguishable from "not set" — so omitting it here would make the
      // audit report that problem for every paid event.
      "member_price",
      "category",
    ],
    adminPath: (id) => `/events/${id}`,
    publicPath: (slug) => `/events/${slug}`,
  },
  news: {
    domain: "news",
    table: "news",
    statuses: ["draft", "published"],
    publishedStatus: "published",
    draftStatus: "draft",
    archivedStatus: null,
    translations: {
      kind: "content_translations",
      relationship: "translation_refs",
      contentType: "news",
    },
    scope: {
      campusField: "campus_id",
      departmentField: "department_id",
      campusRelation: "campus.$id",
      departmentRelation: "department.$id",
    },
    supported: {
      search: true,
      get: true,
      create_draft: true,
      publish: true,
      unpublish: true,
    },
    unsupportedReason: {
      update:
        "Not implemented yet: an update has to rewrite the linked translation rows and their permissions together with the parent.",
      archive: "The `news` status enum has only `draft` and `published`.",
      delete: "Not implemented; deleting news orphans its translation rows.",
    },
    summaryColumns: [
      "slug",
      "status",
      "campus_id",
      "department_id",
      "sticky",
      "author",
      "image",
    ],
    adminPath: (id) => `/news/${id}`,
    publicPath: (slug) => `/news/${slug}`,
  },
  benefits: {
    domain: "benefits",
    table: "campus_benefits",
    statuses: ["draft", "published", "archived"],
    publishedStatus: "published",
    draftStatus: "draft",
    archivedStatus: "archived",
    translations: { kind: "inline_columns" },
    scope: {
      campusField: "campus_id",
      departmentField: null,
      campusRelation: "campus.$id",
      departmentRelation: "department.$id",
    },
    supported: {
      search: true,
      get: true,
      publish: true,
      unpublish: true,
      archive: true,
    },
    unsupportedReason: {
      create_draft:
        "A benefit needs bilingual title/description/teaser/terms plus partner and redemption configuration; the admin benefit editor owns that shape.",
      update: NOT_IMPLEMENTED_CREATE,
      delete:
        "The admin assistant advertises benefit deletion but its adapter has no `benefits` case, so nothing implements it. Archive instead.",
    },
    summaryColumns: [
      "status",
      "campus_id",
      "kind",
      "category",
      "partner_name",
      "title_nb",
      "title_en",
      "is_member_only",
      "is_featured",
      "publish_start",
      "publish_end",
    ],
    adminPath: (id) => `/benefits/${id}`,
    publicPath: null,
    note: "Member-only redemption codes are never returned by search or get; see the membership module.",
  },
  products: {
    domain: "products",
    table: "webshop_products",
    statuses: ["draft", "pending_approval", "published", "archived"],
    publishedStatus: "published",
    draftStatus: "draft",
    archivedStatus: "archived",
    translations: {
      kind: "content_translations",
      relationship: "translation_refs",
      contentType: "product",
    },
    scope: {
      campusField: "campus_id",
      departmentField: "departmentId",
      campusRelation: "campus.$id",
      departmentRelation: "department.$id",
    },
    supported: { search: true, get: true },
    unsupportedReason: {
      create_draft:
        "Products need a sales type, pricing, stock mode and custom fields; the shop editor owns that shape.",
      update: NOT_IMPLEMENTED_CREATE,
      publish:
        "Publishing a product must pass `assertProductBookable` (an active sales type and a department) and `webshop_products` grants no row-level update, so it needs the service key behind that gate. Left to the admin app so the gate has exactly one implementation.",
      unpublish: "See `publish`.",
      archive: "See `publish`.",
      delete: "Deleting a product affects order history. Use the admin app.",
    },
    summaryColumns: [
      "slug",
      "status",
      "campus_id",
      "departmentId",
      "regular_price",
      "member_price",
      "member_only",
      "stock",
      "inventory_mode",
      "category",
      "sales_type",
      "linked_event_id",
    ],
    adminPath: (id) => `/shop/products/${id}`,
    publicPath: (slug) => `/shop/${slug}`,
  },
  documents: {
    domain: "documents",
    table: "documents",
    statuses: ["draft", "published"],
    publishedStatus: "published",
    draftStatus: "draft",
    archivedStatus: null,
    translations: { kind: "none" },
    scope: {
      campusField: "campus_id",
      departmentField: null,
      campusRelation: "campus.$id",
      departmentRelation: "department.$id",
    },
    supported: { search: true, get: true, publish: true, unpublish: true },
    unsupportedReason: {
      create_draft:
        "A document row is metadata pointing at a SharePoint item; it cannot be created without first uploading the file. The admin assistant advertises this and has no adapter case for it either.",
      update: NOT_IMPLEMENTED_CREATE,
      archive: "The `documents` status enum has only `draft` and `published`.",
      delete:
        "Deleting the row leaves the SharePoint file orphaned. Use the admin app, which handles both.",
    },
    summaryColumns: [
      "title",
      "status",
      "category",
      "scope",
      "campus_id",
      "version",
      "version_number",
      "language",
      "sharepoint_web_url",
      "file_size",
    ],
    adminPath: (id) => `/documents/${id}`,
    publicPath: null,
    note: "File content is not read by this package; only metadata and the SharePoint link.",
  },
  pages: {
    domain: "pages",
    table: "pages",
    statuses: ["draft", "published", "archived"],
    publishedStatus: "published",
    draftStatus: "draft",
    archivedStatus: "archived",
    translations: { kind: "page_translations" },
    scope: {
      campusField: "campus_id",
      departmentField: "department_id",
      campusRelation: "campus.$id",
      departmentRelation: "department.$id",
    },
    // Every operation, reads included. A page's title and locales live in
    // `page_translations`, which the generic content service does not project
    // or decode — it handles `content_translations` and inline columns — so a
    // generic read would report a null title and no translations for a page
    // that has both. It would also be *weaker* than the dedicated path: the
    // generic search applies only `scopeQueries`, while `pages.list` applies a
    // per-row visibility rule because `pages` has row security off with a
    // table-level `read("any")`. A second, thinner door into page data is
    // worse than no second door.
    supported: {},
    unsupportedReason: {
      search:
        "Pages are block documents with their own translation table. Use `biso_page_list`, which applies the per-row visibility rule this table needs.",
      get: "Use `biso_page_load`, which returns the real document, its blocks and which document you were served.",
      create_draft:
        "Pages are block documents. Use the `biso_page_*` tools, which operate on a real PageDoc.",
      update: "Use the `biso_page_*` tools.",
      publish: "Use `biso_page_publish`.",
      unpublish: "Use `biso_page_publish` with `publish: false`.",
      archive:
        "Not implemented; archiving a page is not exposed in the editor either.",
      delete: "Not implemented. Use the admin app.",
    },
    summaryColumns: [
      "slug",
      "status",
      "visibility",
      "campus_id",
      "department_id",
    ],
    adminPath: (id) => `/pages/${id}`,
    publicPath: (slug) => `/${slug}`,
    note: "`pages` and `page_translations` have rowSecurity disabled and a table-level read(any) grant, so draft documents are readable at the Appwrite layer. This package filters by status in application code and never relies on row security for page visibility.",
  },
});

export function domainSpec(domain: ContentDomain): ContentDomainSpec {
  return CONTENT_REGISTRY[domain];
}

export function supports(
  domain: ContentDomain,
  operation: ContentOperation
): boolean {
  return CONTENT_REGISTRY[domain].supported[operation] === true;
}

/** Domains that support an operation. Used to build tool input enums. */
export function domainsSupporting(
  operation: ContentOperation
): ContentDomain[] {
  return CONTENT_DOMAINS.filter((domain) => supports(domain, operation));
}

export function unsupportedReason(
  domain: ContentDomain,
  operation: ContentOperation
): string {
  return (
    CONTENT_REGISTRY[domain].unsupportedReason[operation] ??
    `\`${operation}\` is not supported for ${domain}.`
  );
}

/** The full matrix, for the capability resource and the docs. */
export function supportMatrix(): Array<{
  domain: ContentDomain;
  table: string;
  operations: Record<ContentOperation, "supported" | string>;
}> {
  return CONTENT_DOMAINS.map((domain) => {
    const operations = {} as Record<ContentOperation, "supported" | string>;
    for (const operation of CONTENT_OPERATIONS) {
      operations[operation] = supports(domain, operation)
        ? "supported"
        : unsupportedReason(domain, operation);
    }
    return { domain, table: CONTENT_REGISTRY[domain].table, operations };
  });
}

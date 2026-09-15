/**
 * Resources.
 *
 * Resources carry stable *context*: things a model benefits from having in
 * front of it before it starts, which do not change per call. They are
 * deliberately NOT a mirror of the tools — mirroring every tool as a resource
 * doubles the surface and gives a client two ways to ask the same question,
 * with no way to tell which is authoritative.
 *
 * The same authorization applies: a resource is registered only for profiles
 * that may read it, and the scoped one re-derives scope from the principal at
 * read time rather than trusting the URI.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { BRAND_ACCENT_VALUES } from "@repo/editor/theme/presets";
import { describeConfig } from "../config/env";
import { CAMPUS_NAME_TO_ID } from "../identity/campus";
import { describePrincipal, isAnonymous } from "../identity/principal";
import { describeScope } from "../identity/scope";
import type { ToolContext } from "../runtime/context";
import { BLOCK_TYPE_CATALOG, FEED_BINDING_BLOCKS } from "../services/blocks";
import { supportMatrix } from "../services/content-registry";

export interface RegisteredResource {
  name: string;
  uri: string;
}

function json(uri: string, value: unknown) {
  return {
    contents: [
      {
        uri,
        mimeType: "application/json",
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

function markdown(uri: string, text: string) {
  return {
    contents: [{ uri, mimeType: "text/markdown", text }],
  };
}

export function registerResources(
  server: McpServer,
  context: ToolContext
): RegisteredResource[] {
  const registered: RegisteredResource[] = [];

  const add = (
    uri: string,
    name: string,
    description: string,
    mimeType: string,
    read: () => ReturnType<typeof json>
  ) => {
    server.registerResource(
      name,
      uri,
      { title: name, description, mimeType },
      () => read()
    );
    registered.push({ uri, name });
  };

  add(
    "biso://identity/principal",
    "Current principal",
    "The verified identity this server acts as, its derived roles, and the scope every result is filtered to.",
    "application/json",
    () =>
      json("biso://identity/principal", {
        principal: describePrincipal(context.principal),
        scope: describeScope(context.principal),
        server: describeConfig(context.config),
        writeMode: context.mutation.writeMode,
      })
  );

  add(
    "biso://schema/content-support-matrix",
    "Content support matrix",
    "Which content operations this server implements for which domain, and the reason for each gap. Read this before telling a user something can be created, published or deleted.",
    "application/json",
    () =>
      json("biso://schema/content-support-matrix", {
        matrix: supportMatrix(),
        note: "Derived from the Appwrite schema, the admin app's server actions, and each table's row permissions. An operation marked unsupported here may still exist in the admin app.",
      })
  );

  add(
    "biso://schema/campuses",
    "Campus identifiers",
    "Campus names and the numeric ids content rows store in campus_id.",
    "application/json",
    () =>
      json("biso://schema/campuses", {
        nameToId: CAMPUS_NAME_TO_ID,
        note: "National (5) is where organisation-wide content is filed. Benefits scoped to a campus also include National.",
      })
  );

  add(
    "biso://editor/blocks",
    "Page block catalogue",
    "Every block type a page document can contain, which of them bind to a live Appwrite feed, and the approved brand accents.",
    "application/json",
    () =>
      json("biso://editor/blocks", {
        blockTypes: BLOCK_TYPE_CATALOG,
        feedBindingBlocks: FEED_BINDING_BLOCKS,
        brandAccents: BRAND_ACCENT_VALUES,
      })
  );

  add(
    "biso://guide/authoring",
    "Authoring and brand guidance",
    "How BISO content is structured: bilingual authoring, ownership, publication, and the conventions a draft should follow.",
    "text/markdown",
    () =>
      markdown(
        "biso://guide/authoring",
        AUTHORING_GUIDE
      ) as unknown as ReturnType<typeof json>
  );

  if (!isAnonymous(context.principal)) {
    add(
      "biso://guide/permissions",
      "How permissions work here",
      "How roles are derived from Azure-AD-synced Appwrite teams, and what each role may do.",
      "text/markdown",
      () =>
        markdown(
          "biso://guide/permissions",
          PERMISSIONS_GUIDE
        ) as unknown as ReturnType<typeof json>
    );
  }

  return registered;
}

const AUTHORING_GUIDE = `# Authoring BISO content

## Bilingual by default

Norwegian Bokmål is the authoritative source; English is the translation. A
content item with only English text is incomplete, not "English-only". Most
content types store translations as child rows in \`content_translations\`
keyed by \`locale\` (\`no\` / \`en\`); benefits are the exception and use inline
\`title_nb\` / \`title_en\` columns.

## Ownership

Every content row belongs to a campus, and usually to a department within it.
The relationship columns (\`campus\`, \`department\`) are canonical; the scalar
\`campus_id\` / \`department_id\` columns are migration-era compatibility
metadata. Ownership decides who may edit it, so it cannot be changed casually.

## Publication is a separate step

Creating something never publishes it. A draft carries no public read
permission at all — it is invisible until a publish both flips the status and
grants \`read(any)\`. Publishing needs campus-admin or global-admin scope for
the item's campus. A department member who cannot publish directly can file an
approval request, which routes to the campus management team.

## Tone

BISO is a student organisation, writing for students. Be concrete and warm;
avoid corporate register. Events say what, when, where and why, and end with a
call to action. News leads with the facts. Vacancies state responsibilities,
requirements, and what BISO offers in return.

## Slugs

Lowercase, hyphenated, derived from the English title, and stable once
published — a slug is the public URL.
`;

const PERMISSIONS_GUIDE = `# How permissions work

Roles are not stored. They are derived, on every session, from Appwrite team
memberships that are synced from Azure AD security groups.

| Membership | Role |
|---|---|
| National campus + Operations Unit department | \`globaladmin\` — every campus |
| Campus-{City} + Ledelsen{City} | \`campusadmin\` for that city |
| Any \`SG-App-Dept-*\` team | department member, scoped to that department |
| HR department | \`hr\` — the only role that opens recruitment |

**Campus membership alone grants nothing.** Being on the Oslo campus team
without a department or management team resolves to no write scope at all.

## Scope

- Global admins are unrestricted.
- Campus admins are restricted to their managed campuses.
- Department members are restricted to BOTH their campus and their department.
- A principal whose scope cannot be resolved sees nothing. This is deliberate:
  the alternative — an empty filter — would return every row in every campus.

## Recruitment is separate

Vacancies and applications are HR-exclusive, with global-admin break-glass.
General content access does not extend to them, even for a department member
who can publish news and events.

## Why a refusal is not an approval request

Not being permitted to do something and needing someone's sign-off are
different. Only publishing can be routed for approval, because only publishing
has an execution path behind the approval queue. Everything else that is
refused is simply refused.
`;

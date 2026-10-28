# apps/docs

Fumadocs site on port 3002. It holds the platform guide for BISO staff and the
developer handover. Whoever writes docs next should read this file first.

## Two areas

| Area           | URL           | Folder                          | Audience |
|----------------|---------------|---------------------------------|----------|
| Platform guide | `/guide`      | `content/docs/guide/`           | Staff who use the admin |
| Developers     | `/developers` | `content/docs/developers/`      | People who run and change the platform |

Each is a Fumadocs root folder with its own sidebar. The landing page at `/`
is coded, not MDX. Its links live in `lib/landing.ts`, and a test checks that
every href resolves to a page.

`legacy/` holds the old pages. It is not built. It is often wrong, so use it
as source material only, and check everything against the code. It is deleted
in the final stage of the rework.

Old URLs are redirected through `redirects.json`. Rules there are
`{ source, destination }` only. `next.config.mjs` serves all of them as
temporary (307) redirects, so don't add a `permanent` key. The first matching
rule wins, so put specific rules above the section fallbacks. If you move or
rename a page, add a redirect. The tests fail on redirect chains.

## Front matter

```yaml
---
title: Create a vacancy
description: One sentence on what the page covers.
who: HR team, National HR and global admins
covers:
  - apps/admin/src/app/**/jobs/**
  - packages/shared/recruitment/**
---
```

- `title`: required. `description`: optional in the schema, but write one.
- `who`: guide task pages only. It fills "Who can do this". Name the real
  roles from `apps/admin/src/lib/roles.ts`.
- `covers`: globs, relative to the repo root, for the code the page describes.
  `[` and `]` are literal, so a Next route folder like `[id]` matches as
  written. Quote any glob that starts with `*`, e.g. `- "**/jobs/**"`: unquoted
  it is a YAML alias and the list is reported as malformed.
  `covers: []` is only for pages on the allow-list in
  `scripts/page-coverage/narrative-pages.json` (history, design decisions, area
  indexes and similar). To add one, put its repo-relative path in that file.
  Always include `covers`: the PR check warns when a changed page has none, or
  has `covers: []` without being on the list.
- Add every new page or folder to its folder's `meta.json` `pages`, in reading
  order. Fumadocs hides anything not listed, and `lib/content-structure.test.ts`
  enforces it.

The last-updated date comes from git. It is hidden on shallow clones.

## Task page shape

Every guide task page has the same six parts, in this order:

1. Who can do this: the `who` field.
2. Before you start: `<BeforeYouStart>`.
3. Numbered steps, with screenshots where the screen can be shown with
   made-up data: `<Steps>` and `<Step>`.
4. What happens next: `<WhatHappensNext>`. Notifications, timings, anything
   automatic.
5. What the student sees.
6. Common mistakes.

The two panels have no built-in title. Write the heading inside the box so it
gets an anchor and a TOC entry:

```mdx
<BeforeYouStart>

## Before you start

- You need the HR role for your campus.
</BeforeYouStart>
```

Do the same for `<WhatHappensNext>` with `## What happens next`.

Other components, from `mdx-components.tsx`:

- `Callout` with `type` of `info`, `warn` or `error`.
- `Screenshot` with `src`, `alt`, `caption` (optional), `width` and `height`.

Each area opens with a "How [area] works" page: who can use it, the whole flow
end to end, and what the system does on its own against what staff must do.

## Writing rules

- **Language.** The guide is in English. The admin defaults to Norwegian, so
  name each button and field as it appears on screen, with the English in
  brackets: choose **Utlys stilling** (Post Job). Some strings are
  hard-coded in English. Follow what the screen shows.
- **Screenshots.** Plain frame, never cut at an angle. Made-up data only: no
  real students, applicants, buyers or staff. Never point real credentials at
  a screenshot run.
- **No placeholders.** No "TBD", "coming soon" or "[FILL IN]". If a section
  has nothing to say, leave it out.
- **Private values.** This repo is public. Never write account owners, emails,
  server addresses, Microsoft group names, Infisical links, secrets or the
  emergency kit contents in a page. Those are shown only after sign-in.
- **Check every claim against the code** before you commit. The code is the
  source of truth, not the old pages and not memory.
- Plain English, sentence case, short sentences. Display headings are
  uppercased by CSS, so the source stays sentence case.

`app/brand.test.ts` blocks specific patterns: gradients, `backdrop-blur`,
`whileInView`, `next/font/google`, `hover:-translate-y` and `--font-inter`.
Separately, the rule is Museo Sans and Museo Slab only. The test does not
check that.

## The PR check

`.github/workflows/docs-coverage.yml` runs `bun apps/docs/scripts/page-coverage/cli.ts`.
It warns on a PR. It never fails it. It warns when:

- a PR changes files matched by a page's `covers` but not the page itself,
  and names the pages;
- a glob matches no files;
- a page changed in the PR has no `covers`;
- `covers` is malformed;
- a changed page has `covers: []` but is not on the narrative allow-list.

## Sign-in

Docs reuses the admin's Microsoft sign-in and only ever reads its session
cookie (`lib/auth/viewer.ts`, exposed as `GET /api/viewer`, `no-store`). Docs
never sets or clears cookies and never uses `createAdminClient`.

- `APPWRITE_SESSION_COOKIE=a_session_biso_admin` is required. Unset, the shared
  client falls back to `a_session_biso`, which is Appwrite's own cookie, not
  the admin's. Docs is read-only here, so there is no collision, but nobody
  would be recognised.
- Also needed: `NEXT_PUBLIC_APPWRITE_ENDPOINT`, `NEXT_PUBLIC_APPWRITE_PROJECT`.
- `NEXT_PUBLIC_ADMIN_URL` is the admin's origin, used for sign-in links.
- Locally the admin cookie is host-only on `localhost` and ignores ports, so
  docs on :3002 receives it after signing in on :3001.

## Private details

Some facts are too sensitive for a public repo and a static site: who owns an
account, where the servers live, the emergency kit. A page names them with
`<Private>`, and the reader's browser fetches the value after sign-in.

```mdx
<Private name="server-access" label="Server access" />
```

- `name` must be a key in `lib/private/registry.ts`. To add one, add an entry
  there. The entry holds a name and a description only. The description tells
  the owner what to store under that key, so write it for them.
- Values never go in a page, the registry, a test or a screenshot. They live in
  Infisical (production) or a local JSON file (development).
- `label` is optional text shown with the value.
- A page always renders. A reader sees the value, or one of three messages:
  "Sign in with your BISO admin account to see this." (with a sign-in link),
  "Your account doesn't have access to this.", or "This couldn't be loaded
  right now. Try again later."
- Values are served only by `GET /api/private` (`no-store`) and never appear in
  static HTML, the RSC payload or `llms-full.txt`. The search index is built
  per request by `/api/search`, so the leak check does not scan it. Values stay
  out of it by design, because they are never in page source.

### Who can see values

- Global admins: members of the National campus team and the OperationsUnit
  department team.
- Campus admins: members of a campus team plus the matching `Ledelsen{City}`
  team.
- The `docs-handover` Appwrite team. A global admin adds and removes
  consultants by hand in the Appwrite console. Nothing is automatic.
- Nobody else, including plain department members and HR.

Access uses the shared role helpers from `@repo/shared/utils/team-roles`
(`lib/auth/access.ts`). A drift test in `lib/auth/access.test.ts` pins only the
admin team-name parser, so check `apps/admin/src/lib/roles.ts` by hand if the
rules change.

### Env vars

Docs:

- `NEXT_PUBLIC_APPWRITE_ENDPOINT`, `NEXT_PUBLIC_APPWRITE_PROJECT`
- `APPWRITE_SESSION_COOKIE=a_session_biso_admin`
- `NEXT_PUBLIC_ADMIN_URL`: the admin's origin, for sign-in links
- `DOCS_PRIVATE_SOURCE`: `infisical`, `fake` or `none` (default `none`)
- `INFISICAL_SITE_URL`, `INFISICAL_CLIENT_ID`, `INFISICAL_CLIENT_SECRET`,
  `INFISICAL_PROJECT_ID`, `INFISICAL_ENVIRONMENT`, `INFISICAL_SECRET_PATH`
- `DOCS_PRIVATE_FAKE_FILE` and `DOCS_PRIVATE_ALLOW_FAKE`: fake source only

Admin:

- `NEXT_PUBLIC_DOCS_URL`: lets the admin's sign-in return to docs. It is
  inlined at build time, so rebuild the admin after setting it.

In production the admin session cookie must be set on `.biso.no` and docs must
run on a `*.biso.no` host, or the browser never sends the cookie to docs.

### Local development

Use the fake source. The file maps registry names to made-up values:

```json
{
  "server-access": "Fake value: ask Fake Person (fake@example.test)",
  "account-owners": "Fake value: domain is owned by Nobody Real"
}
```

```bash
DOCS_PRIVATE_SOURCE=fake DOCS_PRIVATE_FAKE_FILE=/path/to/values.json bun run dev --filter=docs
```

Locally the admin cookie is host-only on `localhost` and ignores ports, so sign
in on :3001 and docs on :3002 sees you. The fake source is refused when
`NODE_ENV=production` unless `DOCS_PRIVATE_ALLOW_FAKE=1`.

### Owner actions

These need the owner. Nothing here is done by code.

1. Create an Infisical folder for docs values and a read-only machine identity
   scoped to that folder. Put its details in the `INFISICAL_*` vars above.
2. Set the docs Appwrite site env: the vars listed under Docs.
3. Create the Appwrite team with id `docs-handover`.
4. Set `NEXT_PUBLIC_DOCS_URL` on the admin and rebuild the admin.
5. Set `NEXT_PUBLIC_ADMIN_URL` on docs.

### Leak check

```bash
cd apps/docs && bun run check:private-leaks
```

It deletes `apps/docs/.next` first and overwrites it with a production build,
so stop `bun run dev` before running it. It builds docs with random fake values
and a temporary page using every registry name, scans `.next` for those values,
and requires a marker from that page to appear in the output, so a build that
skipped the page fails instead of passing. The page is removed even if the
build fails or you press Ctrl+C. If a run was killed hard and left
`content/docs/developers/__leak-check.mdx` behind, delete it. The check refuses
to start while it exists. `.source` may keep a stale entry for the page until
the next `fumadocs-mdx` run (`check-types` or `postinstall`). It exits non-zero
on a leak. Run it after changing anything in
`lib/private/` or how `<Private>` renders.

### Stage 3b

Pages do not use `<Private>` yet. When they do, flip `REQUIRE_REGISTRY_USAGE`
to `true` in `lib/private/registry.test.ts` so every registry name must be used.

## Commands

Run from the repo root with `--filter=docs`, or from `apps/docs/`.

```bash
bun run dev --filter=docs          # next dev on :3002
bun run test --filter=docs         # bun test: landing links, redirects, coverage check, brand guard
bun run check-types --filter=docs  # fumadocs-mdx && tsc --noEmit. Required before merging
bun run build --filter=docs        # next build
```

`bun test` run directly in `apps/docs/` does the same as the test script.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

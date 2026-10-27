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
  written. Use `covers: []` for a narrative page (history, design decisions).
  Always include `covers`: the PR check warns when a changed page has none.

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
  brackets: choose **Opprett ny stilling** (New vacancy). Some strings are
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
- `covers` is malformed.

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

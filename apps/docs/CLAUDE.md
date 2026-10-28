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
never sets or clears cookies and never uses `createAdminClient`. With no
session cookie at all, docs answers "signed out" without calling Appwrite.

- `APPWRITE_SESSION_COOKIE=a_session_biso_admin` must be set. Unset, the
  shared client reads `a_session_biso` instead. Old web sessions may have left
  an `a_session_biso` cookie on `.biso.no` (see `apps/web/CLAUDE.md`), so docs
  could treat such a visitor as signed in with no access, while real admins
  would not be recognised.
- Also needed: `NEXT_PUBLIC_APPWRITE_ENDPOINT`, `NEXT_PUBLIC_APPWRITE_PROJECT`.
- `NEXT_PUBLIC_ADMIN_URL` is the admin's origin, used for sign-in links. It is
  inlined at build time, so rebuild docs after changing it.
- Locally the admin cookie is host-only on `localhost` and ignores ports, so
  docs on :3002 receives it after signing in on :3001.
- Docs needs no Microsoft sign-in setup of its own, and no redirect URL for
  docs.biso.no. The OAuth flow stays on the admin. Docs only makes
  server-side GETs to Appwrite with the session it reads.

## Private details

Some facts are too sensitive for a public repo and a static site: who owns an
account, where the servers live, who can recover access. A page names them
with `<Private>`, and the reader's browser fetches the value after sign-in.

```mdx
<Private name="server-access" label="Server access" />
```

- `name` must be a key in `lib/private/registry.ts`. To add one, add an entry
  there. The entry holds a name and a description only. The description tells
  the owner what to store under that key, so write it for them.
- Values never go in a page, the registry, a test or a screenshot. They live in
  Infisical (production) or a local JSON file (development).
- Kit-only entries (`kitOnly: true`, today `emergency-kit-contents`) are never
  served. `/api/private` answers 400 for them and a test fails if a page uses
  one. The entry only reserves the name and describes the checklist. The kit
  itself is kept offline by the administration leader.
- `label` is optional text shown with the value.
- A page always renders. A reader sees the value, or one of three messages:
  "Sign in with your BISO admin account to see this." (with a sign-in link),
  "Your account doesn't have access to this.", or "This couldn't be loaded
  right now. Try again later."
- Values are served only by `GET /api/private` (`no-store`) and never appear in
  static HTML, the RSC payload or `llms-full.txt`. The search index
  (`/api/search`) is built at runtime on demand, so it isn't in the build
  output. Private values stay out of it because they're never in page source.

### Who can see values

Docs is deliberately stricter than the admin: it trusts only exact team ids
created by the M365 sync, because names can be created by anyone. Any
signed-in Appwrite user, even an anonymous one, can create a team with any
name and a custom id of their choice. So `lib/auth/access.ts` ignores team
names and checks ids only.

The sync builds each team id by lowercasing the Microsoft group's display
name (`sanitizeTeamId` in `apps/admin/src/lib/m365-sync.ts`), so
`SG-App-Dept-OperationsUnit` becomes `sg-app-dept-operationsunit`.

- Global admins: members of both `sg-app-campus-national` and
  `sg-app-dept-operationsunit`.
- Campus admins: members of a city's campus team and that city's Ledelsen
  team, for example `sg-app-campus-oslo` and `sg-app-dept-ledelsenoslo`. The
  cities are Oslo, Bergen, Stavanger and Trondheim (`CAMPUS_CITY_NAMES` in
  `@repo/shared/utils/team-roles`).
- The `docs-handover` team. A global admin adds and removes consultants by
  hand in the Appwrite console. Nothing is automatic. To let a consultant in:
  they sign in to the admin once with a Microsoft account the admin's sign-in
  accepts, which creates their Appwrite account. Then a global admin adds
  that account to `docs-handover`.
- Nobody else, including plain department members, HR, and anyone whose team
  only has the right name.

`lib/auth/access.test.ts` pins the sync's id rule and checks the city list.
If the sync changes how it builds ids, that test fails and points back here.

### Env vars

Docs:

- `NEXT_PUBLIC_APPWRITE_ENDPOINT`, `NEXT_PUBLIC_APPWRITE_PROJECT`
- `APPWRITE_SESSION_COOKIE=a_session_biso_admin`
- `NEXT_PUBLIC_ADMIN_URL`: the admin's origin, for sign-in links. Inlined at
  build time, so rebuild docs after changing it.
- `DOCS_PRIVATE_SOURCE`: `infisical`, `fake` or `none` (default `none`)
- `INFISICAL_SITE_URL`, `INFISICAL_CLIENT_ID`, `INFISICAL_CLIENT_SECRET`,
  `INFISICAL_PROJECT_ID`, `INFISICAL_ENVIRONMENT`, `INFISICAL_SECRET_PATH`
- `DOCS_PRIVATE_FAKE_FILE` and `DOCS_PRIVATE_ALLOW_FAKE`: fake source only
- The assistant's `ANTHROPIC_API_KEY`, `DOCS_ASSISTANT_MODEL` and
  `DOCS_ASSISTANT_DAILY_LIMIT`: see "Assistant" below.

`apps/docs/.env.example` lists these names without values.

Admin:

- `NEXT_PUBLIC_DOCS_URL`: lets the admin's sign-in return to docs. It is
  inlined at build time, so rebuild the admin after setting it.

In production the admin session cookie must be set on `.biso.no` and docs must
run on a `*.biso.no` host, or the browser never sends the cookie to docs.

Owner note: the admin sets that cookie on `.biso.no`
(`apps/admin/src/app/(auth)/auth/oauth/route.ts`), so the browser sends every
admin's session to every `*.biso.no` host. Only host first-party BISO sites on
biso.no subdomains. Anything else there would receive admin sessions.

### Local development

Use the fake source. The file maps registry names to made-up values. Keep it
outside the repo:

```json
{
  "server-access": "Fake value: ask Fake Person (fake@example.test)",
  "account-owners": "Fake value: domain is owned by Nobody Real"
}
```

Turbo runs tasks in strict env mode, and the `dev` task in `turbo.json`
declares no env vars. So `bun run dev --filter=docs` drops variables you set
in the shell, such as `DOCS_PRIVATE_SOURCE` and `APPWRITE_SESSION_COOKIE`.
Use one of these instead:

- Copy `apps/docs/.env.example` to `apps/docs/.env.local` and fill it in.
  Next.js reads that file itself, so it works with `bun run dev --filter=docs`
  too. It is gitignored (`.env*.local` in `apps/docs/.gitignore`).
- Or run from inside `apps/docs`, which skips turbo:

  ```bash
  cd apps/docs
  export APPWRITE_SESSION_COOKIE=a_session_biso_admin
  export DOCS_PRIVATE_SOURCE=fake DOCS_PRIVATE_FAKE_FILE=/path/to/values.json
  bun run dev
  ```

Locally the admin cookie is host-only on `localhost` and ignores ports, so sign
in on :3001 and docs on :3002 sees you. The fake source is refused when
`NODE_ENV=production` unless `DOCS_PRIVATE_ALLOW_FAKE=1`.

### Owner actions

These need the owner. Nothing here is done by code. Do them in this order.

1. Create the `docs-handover` team in the Appwrite console, with the custom
   id `docs-handover`. Do this first, before any private-source env is set,
   so nobody else can create a team with that id and own it. Then check the
   team's members in the console: nobody should be in it, and nobody should
   be its owner, until you add someone. If a team with the id `docs-handover`
   already exists and you didn't create it, delete it and create it again.
2. Confirm that each team id docs trusts exists in the production Appwrite
   project: `sg-app-campus-national`, `sg-app-dept-operationsunit`,
   `sg-app-campus-oslo`, `sg-app-campus-bergen`, `sg-app-campus-stavanger`,
   `sg-app-campus-trondheim`, `sg-app-dept-ledelsenoslo`,
   `sg-app-dept-ledelsenbergen`, `sg-app-dept-ledelsenstavanger` and
   `sg-app-dept-ledelsentrondheim`. Pre-create any that are missing, with the
   custom id exactly as listed, so nobody else can claim the id. Name each one
   as the sync would (`National`, `Operations Unit`, `Oslo`, `Ledelsen Oslo`),
   because the admin still reads names. The sync adds members to an existing
   team, but it skips its one-time setup for new department teams
   (`grantDeptTeamAccess` in `apps/admin/src/lib/team-provisioning.ts`), so
   check that setup by hand for any `sg-app-dept-*` team you create. If real
   admins sit in legacy teams with other ids, they won't get docs access until
   they are in the teams above.
   For each of the 10 ids, also check in the console that the team has no
   owner and no stray members. The M365 sync only ever adds `member`
   (`apps/admin/src/lib/m365-sync.ts`), so an owner means someone created the
   team by hand. If so, delete the team and recreate it with the exact id and
   name below, then redo the department-team setup. The next admin sign-in
   sync re-adds each person as a `member`, so don't add members by hand. A
   stray member is anyone who isn't in the matching `SG-App-*` group in
   Microsoft Entra. Remove stray members by hand, and do the same in
   `docs-handover` for anyone who shouldn't have docs access. The sync won't
   do it for you: it only prunes the memberships of the user who is signing
   in, and only for teams it manages (`isAzureSyncedTeamId` in
   `apps/admin/src/lib/m365-sync.ts`). It never removes someone who doesn't
   sign in, and it never touches `docs-handover`. The sync's name is the group
   name without its `SG-App-Campus-` or `SG-App-Dept-` prefix, with a space
   before each inner capital (`sanitizeTeamName` in
   `apps/admin/src/lib/m365-sync.ts`, which calls `expandDeptName` in
   `apps/admin/src/lib/campus-constants.ts`):

   | Id | Name |
   | --- | --- |
   | `sg-app-campus-national` | National |
   | `sg-app-dept-operationsunit` | Operations Unit |
   | `sg-app-campus-oslo` | Oslo |
   | `sg-app-campus-bergen` | Bergen |
   | `sg-app-campus-stavanger` | Stavanger |
   | `sg-app-campus-trondheim` | Trondheim |
   | `sg-app-dept-ledelsenoslo` | Ledelsen Oslo |
   | `sg-app-dept-ledelsenbergen` | Ledelsen Bergen |
   | `sg-app-dept-ledelsenstavanger` | Ledelsen Stavanger |
   | `sg-app-dept-ledelsentrondheim` | Ledelsen Trondheim |

   Don't use the IT team-health view for this check: it lowercases ids
   (`normalizeId` in `apps/admin/src/lib/team-health.ts`). Use the console.
3. Create an Infisical folder for docs values and a read-only machine identity
   scoped to that folder. Put its details in the `INFISICAL_*` vars above.
4. Set the docs Appwrite site env: the vars listed under Docs.
5. Set `NEXT_PUBLIC_DOCS_URL` on the admin and rebuild the admin.
6. Set `NEXT_PUBLIC_ADMIN_URL` on docs and rebuild docs.

The spec also listed "set up the Microsoft sign-in for docs.biso.no (redirect
URL)". That is not needed: sign-in happens on the admin, and docs only reads
the admin's cookie.

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

### Registry usage

The developer pages use `<Private>`, and `REQUIRE_REGISTRY_USAGE` is `true` in
`lib/private/registry.test.ts`. Every registry name must be used by at least one
page. The only exception is a kit-only name, which no page may use. When you add
a registry entry, use it in a page in the same change, or the test fails.

## Assistant

The docs answer questions from their own pages. A reader asks from the
landing's field, or from **Ask about this page** at the foot of a page's
**On this page** rail. Below 1280px the rail becomes a popover, opened from
the bar under the header that shows the page's title, with the button at its
foot. Pages with no headings have no rail, so they have no button. The answer
opens in a panel: a 480px sheet on the right from 768px, full screen below.

Code: `app/api/ask/route.ts`, `lib/assistant/`, `components/assistant/` and
`components/landing/ask-field.tsx`. The model comes from `@repo/ai`
(`resolveModel` in `packages/ai/src/models.ts`). Never import an Anthropic SDK
directly.

The search dialog has no "Ask the assistant" item. In fumadocs-ui 16.7.10 the
dialog's footer slot renders outside the dialog, so an item there would mean
forking the dialog. The landing field and the page button cover asking.

### How it works

1. `POST /api/ask` takes `{ question, pageUrl? }` and checks the request and
   the limits below before anything else.
2. **Search.** The question runs through the same Orama index as the search
   dialog (`lib/assistant/search.ts`) for the top 20 hits. The page being read
   is added if the search missed it.
3. **Sources.** Each page goes in whole, as the processed Markdown from
   `getLLMText` in `lib/source.ts`. A page is never cut. The page being read
   goes first, then the rest by rank, skipping any page that would take the
   total over 120,000 characters, up to 6 pages. The page being read is kept
   even if it alone is over.
4. **The placeholder.** Every `<Private …/>` in the page text becomes
   `[private detail, shown only to signed-in staff]` before anything is sent
   (`redactPrivate` in `lib/assistant/retrieve.ts`). The assistant never reads
   the private source, signed in or not. `lib/assistant/retrieve.test.ts` fails
   if the assistant code or the route imports `lib/private`.
5. **No pages, no call.** If the search finds no page, the route answers
   "I couldn't answer that. Try the docs search instead." without calling the
   model.
6. **Answer.** Otherwise it makes one streamed call with the system prompt in
   `lib/assistant/prompt.ts`. The prompt says: answer only from the numbered
   sources, cite each claim as `[n]`, say so in one sentence when the sources
   don't cover the question, use numbered steps for how-to questions, start a
   line with `Watch out:` only for a pitfall a source states, write in English
   and name admin buttons as the sources do. The question goes in a
   `<question>` tag and is treated as a reader's question, never as
   instructions.
7. **Sources in the panel.** The answer is plain text. The `X-Docs-Sources`
   header lists each source's number, title and url. The panel renders
   paragraphs, numbered lists, bold, `[n]` citations and `Watch out:` lines as
   React elements, never as HTML (`components/assistant/answer-text.tsx`), and
   lists the cited pages under **Pages used**. A source becomes a link only if
   its url is a docs page path (`components/assistant/site-path.ts`).
8. **When it goes wrong.** A refusal, an answer cut off at the output cap or an
   error partway through ends with the "I couldn't answer that" line. An error
   before any text is a `502`, and the panel says "The assistant couldn't
   answer right now. Try the search instead."

Closing the panel aborts the request, and the route passes the abort on to
the model call, so an abandoned answer stops being generated.

### Env vars

| Variable | Default | What it does |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Unset: the assistant is off | Switches the assistant on. The AI SDK reads it for the call. The route only checks that it's set. |
| `DOCS_ASSISTANT_MODEL` | `balanced` | `balanced` is Claude Sonnet 5.5, `fast` is Claude Haiku 5.5. Any other value is sent to Anthropic as a model id. |
| `DOCS_ASSISTANT_DAILY_LIMIT` | `400` | Questions a day, per server instance. An unset, empty or non-numeric value means 400. |

All three are read on each request, so they aren't in `turbo.json`.
`apps/docs/.env.example` lists them without values. In production, set them on
the docs Site in the Appwrite console, then redeploy without shipping new code.

Don't leave `DOCS_ASSISTANT_MODEL` set to an empty value, as a copy of
`.env.example` does. The route's `??` keeps the empty string, and
`resolveModel` reads it as no model and picks `fast`. Delete the line to get
the default.

### Limits

Both counters are per server instance and held in memory
(`lib/assistant/limits.ts`). A restart or a redeploy resets them.

- **8 questions per visitor per 10 minutes.** This stops one person using the
  docs as a free chatbot. The visitor is a SHA-256 hash of the first address
  in `x-forwarded-for`. With no such header, every visitor shares the key
  `unknown`, and the whole site gets 8 questions per 10 minutes.
- **A daily total**, `DOCS_ASSISTANT_DAILY_LIMIT`, counted per UTC day. It caps
  the spend, whatever the visitor key. `0` refuses every question but leaves
  the entry points showing, so switch the assistant off with the key instead.
- **At most 10,000 visitors are tracked.** Past that, new visitors are refused
  until older entries are 10 minutes old. This keeps the memory bounded.
- Over a limit the route answers `429` with `{ "error": "rate_limited" }`, and
  the panel says "You've asked a lot of questions. Try again in a few
  minutes." It says the same when the daily total is reached.
- **Input.** A body over 4 KB, a question over 500 characters after trimming,
  or a `pageUrl` that isn't a docs page gets `400`.
- **Each call.** At most 120,000 characters of sources (about 30,000 tokens)
  from at most 6 pages, and 1,200 output tokens, which include the model's
  thinking. Reasoning is set to `low`. There are no retries, and a call stops
  after 60 seconds.

Whether a visitor can choose their own key depends on the proxy in front of
docs. If it appends to an `x-forwarded-for` the client sent, instead of
replacing it, the first address is whatever the client put there. Then the
per-visitor limit can be got round, and the daily total is the limit that
holds.

### What a question costs

At the caps, one question sends about 30,000 tokens of sources (120,000
characters at roughly 4 characters a token) plus about 500 for the prompt and
the question, and gets back at most 1,200 tokens.

| Model | Input | Output | Per question, at most | 400 questions |
| --- | --- | --- | --- | --- |
| Sonnet 5.5 (`balanced`), $2 / $10 per million tokens | 30,500 × $2 / 1M ≈ $0.061 | 1,200 × $10 / 1M = $0.012 | About $0.07 | About $29 |
| Haiku 5.5 (`fast`), $0.10 / $0.50 per million tokens | 30,500 × $0.10 / 1M ≈ $0.003 | 1,200 × $0.50 / 1M = $0.0006 | About $0.004 | About $1.50 |

Most questions use fewer pages than the cap, so they cost less. A question
that finds no page costs nothing. The assistant spends from the same Anthropic
credit as the admin, the api and the website: about USD 160 a month. On
Sonnet at the caps, the whole credit would pay for about 2,200 questions a
month, about 70 a day, if nothing else used it. A full daily total every day
would cost about $880 a month on Sonnet, more than five times the credit. If
spend climbs, lower `DOCS_ASSISTANT_DAILY_LIMIT` or switch to `fast`.

These are Anthropic's list prices in October 2026, and they change. Check
Anthropic's pricing page before you rely on them.

### Switch it off

Unset `ANTHROPIC_API_KEY` on the docs Site and redeploy. `GET /api/ask` then
answers `{ "enabled": false }`, `POST /api/ask` answers `503`
`{ "error": "disabled" }`, the ask entry points disappear and the landing
field is the search button again. The browser asks `GET /api/ask` once when
the site loads in a tab, so entry points stay hidden until it says yes, and a
failed check leaves them hidden. Nothing else on the site changes.

### Change the model

Set `DOCS_ASSISTANT_MODEL=fast` for Haiku 5.5, or remove it for the default,
Sonnet 5.5. Then redeploy and ask the three test questions below again. The
default is `balanced`, chosen over `fast` because the worst failure is a
confident wrong answer. To move both tiers to newer models, change
`MODEL_IDS` in `packages/ai/src/models.ts`. That changes every app.

### Nothing is stored

- The route logs nothing: not the question, not the answer and not errors.
  Its `onError` handler does nothing, because the default one logs the error,
  which can carry the request.
- Every response from `/api/ask` is `Cache-Control: no-store`.
- The browser holds the current answer in React state only. Nothing goes in
  storage, and a reload clears it.
- The server holds, in memory, each visitor's hashed key with the times of
  their questions in the last 10 minutes, and the day's count.
- The question and the source pages go to Anthropic to be answered. They go
  nowhere else.

### Owner steps

These need the owner. Nothing here is done by code.

1. In the Appwrite console, set `ANTHROPIC_API_KEY` on the docs Site. Use a
   key of its own, so it can be revoked without touching the other apps and
   its spend can be told apart. Leave `DOCS_ASSISTANT_MODEL` and
   `DOCS_ASSISTANT_DAILY_LIMIT` unset for the defaults.
2. Redeploy docs without shipping new code.
3. Confirm the proxy in front of docs sets `x-forwarded-for`. Otherwise every
   visitor shares one key. A free way to check: on the landing, ask a made-up
   word that matches no page, such as `qzxv`, nine times. Those questions
   find no page, so the model isn't called. The ninth gets the limit message.
   Then ask once from another network, such as a phone on mobile data. If
   that is refused too, the visitor's address isn't reaching docs.
4. Ask three test questions:
   - One the docs answer: on the landing, "How do I publish a vacancy?"
     Expect numbered steps with `[n]` citations, and Publish a vacancy under
     **Pages used**.
   - One they don't: "How do I book a group room at BI?" Expect one sentence
     saying the docs don't cover it, pointing to the search, and no steps.
   - One on a page with a private detail: on Getting access
     (`/developers/start-here/getting-access`), use **Ask about this page**:
     "What is the Infisical address?" Expect the placeholder wording, or a
     sentence that the detail is private, and no address. Ask it signed in
     too: the answer must still hold no value.
5. A few days later, check the key's usage in Anthropic's console against the
   estimate above.

### When it fails

- **No ask field on the landing and no button on pages.** Open `/api/ask` in
  the browser. `{ "enabled": false }` means the running Site has no key: set
  it and redeploy. A page with no headings never has the button.
- **Every question gets "The assistant couldn't answer right now".** The call
  fails before any text (`502`). The route logs nothing, so check the key and
  the account's billing, limits and credit in Anthropic's console. "AI
  features fail" in
  `content/docs/developers/keep-it-running/when-things-break.mdx` lists
  Anthropic's errors.
- **Everyone gets "You've asked a lot of questions".** Either the daily total
  is reached, or every visitor shares one key because `x-forwarded-for` isn't
  set (step 3 above). The total resets at midnight UTC or on a redeploy.

### Checking the UI without spending

Run docs with any non-empty key, such as `ANTHROPIC_API_KEY=test`, and never
submit a question. A submitted question would go to Anthropic. To see an
answer, intercept `/api/ask` in the browser, for example with Playwright's
`page.route`, and return a canned text answer with an `X-Docs-Sources` header:
a URI-encoded JSON array of `{ n, title, url }`. Don't add a scratch page to
the repo for it. The unit tests use `ai/test` mock models and make no calls.

## Commands

Run from the repo root with `--filter=docs`, or from `apps/docs/`.

```bash
bun run dev --filter=docs          # next dev on :3002
bun run test --filter=docs         # bun test: landing links, redirects, coverage check, brand guard, assistant
bun run check-types --filter=docs  # fumadocs-mdx && tsc --noEmit. Required before merging
bun run build --filter=docs        # next build
```

`bun test` run directly in `apps/docs/` does the same as the test script.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

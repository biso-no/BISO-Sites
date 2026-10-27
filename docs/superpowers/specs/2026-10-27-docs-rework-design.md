# Docs rework: a platform guide and a developer handover — design

## Why

One person built BISO's platform and is the only one who knows how it runs or
can get into it. If that person leaves, BISO will most likely hire an outside
consultancy, possibly a new in-house developer. Either way, someone starts from
zero, often billing by the hour.

The people who use the admin are students in board, department and HR roles.
They change every year, arrive in August without knowing the system, and ask
the developer how to do things. Recruitment produces the most questions.

`apps/docs` (docs.biso.no, Fumadocs) already has about 120 pages and 105,000
words. More pages won't fix it:

- **It is wrong in places that matter.** Most pages were written in one pass
  on 2026-06-01 and never touched again. Recruitment docs give the wrong roles,
  statuses and AI screening. The deploy page describes a workflow deleted in
  September. The AI pages swap Anthropic and OpenAI. The cron page says there is
  no scheduler. Infisical, the Flutter app and app-store signing don't appear at
  all. Next.js 15 is named in 10 places; the code runs 16.
- **It is organised around the system, not the reader.** The admin handbook
  tours screens. "Public website" sits under "Use the platform" but is developer
  notes. Ten top-level sections mix both audiences.
- **The handover pages are unfilled templates** with `[FILL IN]` markers.
- **There are no screenshots.**
- **It doesn't look like BISO.** The landing uses gradients, icon tiles and stat
  cards, all of which the 2026 brand system forbids.
- **Nothing keeps it in sync with the code**, which is why it drifted in five
  months.

Product bugs found during the audit are not part of this work. They are listed
in `docs/2026-10-27-issues-from-docs-audit.md` in the main checkout (untracked)
for the owner to fix separately.

## Success looks like

- **A new HR lead in August** opens docs.biso.no, picks "HR team", and follows
  the reading path. They publish a vacancy and run a round to offers without
  messaging anyone. They know the system doesn't email candidates, so they send
  those emails themselves.
- **A department editor working in the admin** asks the admin's assistant "how
  do I send a push about our event?" and gets short steps with a link to the
  guide page.
- **A consultancy is asked for a quote.** They read the developer area, which
  is public, and understand what they'd take on before anyone gives them
  access. On day one they sign in to the docs. They see every account, which
  Microsoft group grants it, and a link to each credential's entry in
  Infisical. They ship a fix by following the deploy page.
- **After the developer has left, Infisical goes down.** The administration
  leader opens the emergency kit, and the docs' public "If you're hiring
  someone" page tells them what to hand the consultant.
- **A pull request changes the recruitment status flow** without touching the
  guide. A check on the PR names the guide pages that cover that code.

## Audiences

1. **Platform guide**: BISO staff who use the admin, meaning the HR team,
   department editors, campus leaders and IT/global admins. Written in
   English only, which the owner confirmed is fine for staff. It is not for
   students; where it helps staff, each task page says what the student sees.
2. **Developer handover**: whoever takes over the platform, whether a
   consultant or a new hire. A short part is written for the BISO board.

## Goals

- Two clearly separate areas, each written for its reader.
- Every published page is accurate against the code on the day it ships.
- The platform guide is organised around tasks and much more thorough than
  today. Recruitment comes first and gets the most depth.
- A stranger can run, deploy and change the platform from the developer
  handover, including the Flutter app.
- The site looks like biso.no.
- The docs stay accurate after this project ends.
- An assistant answers questions from the docs, both on docs.biso.no and
  inside the admin's assistant.

## Non-goals

- A guide for students or members.
- A Norwegian translation.
- Writing secret values anywhere in the docs.
- Fixing the product bugs from the audit.
- Adding pages for their own sake. Fewer, accurate pages beat many.

## Anti-goals (failure even if it technically works)

- **A wrong page.** One mistake a reader catches costs the trust of every other
  page. A page that hasn't been checked against the code doesn't ship.
- **Placeholders on a published page.** No `[FILL IN]`. A fact nobody has
  supplied is left out, or the page waits.
- **Sensitive details anywhere public.** That covers the public repo, static
  HTML, RSC payloads, the search index, `llms-full.txt`, the sitemap, OG images
  and anything sent to the model.
- **Real personal data in screenshots**, meaning students, applicants, buyers
  or members.
- **An assistant that answers past the docs**, confidently stating something
  the docs don't say.
- **An off-brand site.**

## Constraints

- **The GitHub repo `biso-no/BISO-Sites` is public.** Everything committed is
  world-readable, this document included. It names roles, never private
  emails.
- Bun, Turborepo and Ultracite, per the root `CLAUDE.md`. `bun run check-types`
  must pass. New build-time env vars go into `turbo.json`.
- Keep Fumadocs (core and ui 16.7.10, mdx 14.2.11).
- The brand is the 2026 web design system:
  - spec in `docs/redesign/01-design-spec.md`
  - tokens in `.biso-surface-v2` in `packages/ui/styles/biso-surface.css`
  - rules in `apps/web/CLAUDE.md` under "Design system"
  - Museo Sans 300/700 and Museo Slab 700/900 only
  - no gradients, `backdrop-blur`, icon tiles, stat cards, scroll-triggered
    motion or hover-lift
- AI goes through `@repo/ai` (Anthropic).
- The admin assistant is being rebuilt on `feat/admin-assistant` in worktree
  `.claude/worktrees/admin-assistant`, with spec
  `docs/superpowers/specs/2026-10-23-admin-assistant-design.md`. The admin
  side of this work builds on that once it has merged.
- The builder never pushes, deploys or writes to production. Owner actions are
  listed below.

## Structure

The docs have two areas with their own sidebars, using Fumadocs root folders.
A switcher at the top of the sidebar moves between them, and a landing page
sits at `/`. The approved mockups are in
`docs/superpowers/specs/2026-10-27-docs-rework/`: `guide-structure.html`
(option C) and `mockups.html`. Their fonts load only in the brainstorm
server, so the layout is what counts.

### Platform guide

The sidebar is organised by area. A "Start here" section at the top holds a
**Pick your role** page, with one short ordered reading path per role into the
area pages, and **Sign in and find your way**.

The areas mirror what the admin does. A working list:

- Recruitment
- Pages and news
- Events
- Shop and orders
- Members and benefits
- Push announcements
- Access and settings

The builder may split or rename areas to match the admin nav (`apps/admin/src/lib/nav-tree.ts`).
Every user-facing admin feature must be covered somewhere, including:

- the inbox and approvals
- documents
- departments and department pages
- member-pass scanning and guest scanner links
- shop accounting
- analytics
- varsling settings
- operations health, feature flags and payment settings
- app version prompts
- the IT tools: users, audit, data health and expense approval issues
- the activity log
- drafts
- the notification bell
- the admin assistant itself

Each area opens with **How [area] works**:
- who can use it, by actual role
- the whole flow end to end, including statuses and transitions
- what the system does on its own, and what staff must do themselves

Then one page per task. **Every task page has the same shape**:
1. Who can do this
2. Before you start
3. Numbered steps, with screenshots wherever the screen can be shown with
   made-up data
4. What happens next: notifications, timings, anything automatic
5. What the student sees
6. Common mistakes

**Language** (owner's decision). The guide is written in English. The admin
defaults to Norwegian for every user, and only global admins can switch it,
so screenshots are taken in Norwegian. Steps name each button and field as it
appears on screen, with the English in brackets, for example "choose
**Opprett ny stilling** (New vacancy)". Some strings are hard-coded in
English, so steps follow what the screen actually shows. If the language
switch is later opened to everyone, this can be revisited.

**Screens fed by outside services** (my call). Some screens get their data
from outside services, and with real credentials they would show real people:
- IT users and audit (Microsoft Graph)
- analytics (Umami)
- documents (SharePoint)
- accounting and expense screens (24SevenOffice)

For those, the builder may fake the service in the docs environment if that
is cheap. Otherwise the steps for those screens go without screenshots. Real
credentials are never pointed at the screenshot run.

Every page shows a last-updated date taken from git, and has an "Ask about this
page" entry in the right rail.

The roles on Pick your role are HR team, department editor, campus leader and
IT. They follow the real roles in `apps/admin/src/lib/roles.ts`: global admin,
campus admin, department, HR, National HR and benefits editor. The builder maps
them, and adds a path if a real role doesn't fit the four, benefits editor for
example.

The recruitment flow the guide must describe accurately (verified in the
audit, re-verify when writing):
- **Access:** HR department members for their own campus, National HR, and
  global admins. Not campus admins.
- **Creating a vacancy:** a 6-step wizard, with scheduled publishing and
  notify-students push timing.
- **Statuses:** submitted → reviewed → interview → accepted, with rejected
  reachable from each, under the UI labels Applied / Shortlist / Interview /
  Offer / Archived.
- **AI screening:** gives a score and a suggestion, and never changes the
  status.
- **Interviews:** the schedule modal moves the candidate to Interview; a
  booking link does not.
- **Emails:** the advance and bulk emails are drafts staff copy themselves.
- **Retention:** 180 days.

### Developer handover

Items marked **(private)** show their details only after sign-in (see "Private
details").

**Start here**
- **If you're hiring someone**, written for the board:
  - what BISO owns
  - who holds the keys (private)
  - the emergency kit: that it exists, who holds it, and when to use it
  - what to give a consultant on day one
- **Your first day**: reading order and an access checklist.
- **What BISO runs**: one diagram covering the four apps, self-hosted Appwrite,
  self-hosted Infisical, the Appwrite functions (including the two that exist
  only in the console), the Flutter app, and every outside service.
- **Getting access**: every account, and which Microsoft group or person
  grants it (private). Each credential links to its Infisical entry (private).

**Keep it running**
- **Deploying**: the four apps, the functions, and the Android CI and manual
  iOS fastlane releases.
- **Scheduled jobs**: the 5-minute dispatcher and everything it calls, plus
  the nightly roster sync and the content notifier.
- **Secrets and environment variables**, by service, and how Infisical is
  used.
- **Monitoring and health.**
- **Backups and recovery**, including Appwrite's and Infisical's own.
- **When things break**: short runbooks for the usual failures, such as
  payments, sign-in, push and Appwrite down.
- **Yearly calendar**:
  - the August handover to a new board: whose access to add and remove, and
    how
  - renewals: certificates, domains, the Apple Developer account, the wallet
    pass certificates and anything else that expires

**Change it**
- Local setup
- Code layout
- Data model
- Auth and roles
- Common changes: a route, a server action, an editor block, a table column
- **The mobile app** (`BISO-Flutter`): stack, how it talks to Appwrite and
  `apps/api`, release process

**Reference**
- One page per integration and per package
- Design decisions
- Known limitations
- History

### Existing content

The old sections are retired. An existing page moves into the new structure
only after it has been checked against the code. The pages updated on
2026-10-27 are the most likely to survive: the page-editor guide, architecture
overview, editor architecture, publish flow, data model and translations. Every
other page is rewritten. Old URLs redirect to the closest new page where one
exists (my call). No app links into docs.biso.no today, so nothing else needs
updating.

## Private details

The repo is public, so anything only signed-in readers may see is kept out of
it.

- **Where they live:** private values sit in a dedicated Infisical folder,
  for example `/docs-handover`. That covers account owners and their emails,
  server addresses, the Microsoft groups that grant access, Infisical entry
  links, and the administration leader's contact.
- **In the pages:** MDX marks where each value goes with a component, for
  example `<Private name="appwrite-host" />`; the builder names it. Signed-out
  readers see "Sign in to see this" in its place.
- **Fetching:** after sign-in, the docs server fetches the values with a
  read-only Infisical machine identity that can see only that folder. Pages
  with private blocks render per request. Values never reach static output,
  the search index, `llms-full.txt`, the sitemap, OG images or the assistant.
- **If Infisical can't be reached,** the private blocks say so and the page
  still renders.
- **Every production credential is already in Infisical** (owner).
- **The builder never reads Infisical**, values or names (my call). Infisical
  secret keys are assumed to match the env var names in the code. The builder
  delivers two things:
  - a list of every private value: its name, what it should contain, and
    which page uses it
  - the expected Infisical entry for each credential link

  The owner fills the folder and checks every private block during final QA.
  For development and tests, the builder uses a fake value source, never the
  real Infisical.
- **Sign-in:** Microsoft through Appwrite, as in the admin. The docs get their
  own session cookie name; read the cookie-name warning in `apps/web/CLAUDE.md`
  first. Who sees private values:
  - **Global admins and campus admins**, as `apps/admin/src/lib/roles.ts`
    derives them from the `SG-App-*` groups. This is the owner's decision.
  - **Consultants**, through a "Docs handover" Appwrite team. A global admin
    adds and removes members by hand in the Appwrite console, and removal is
    on the yearly calendar. This is my call. Putting consultants in an
    `SG-App-Dept-*` group would also give them the admin's department role,
    which can publish content. Any other Microsoft group is invisible to
    Appwrite unless the docs app gets its own Graph access.
  - **Access is checked on every request.** Admin roles only resync when
    someone signs in to the admin, so a person removed from a group in August
    keeps docs access until their next admin sign-in. The yearly calendar
    covers this.
- **Emergency kit:** the administration leader keeps it offline, outside every
  server. It holds what's needed to get back into Infisical when its server is
  down or its admin is gone. The docs say publicly that it exists, who holds
  it, and when to use it, never what's in it. The builder writes the list of
  what the kit must contain for the owner to assemble. The list is a private
  value.

## Keeping it accurate

- **Code coverage per page.** Every page except a short allow-list of narrative
  pages (history, design decisions) declares, in its frontmatter, the code
  paths it describes as globs. Example: the recruitment pages cover the
  admin's jobs routes and `packages/shared/recruitment/**`.
- **A PR check.** A new GitHub Actions workflow runs alongside
  `pr-review.yml`. When a PR changes files matched by a page's globs but not
  the page itself, it warns and names the pages. It also warns about globs
  that match nothing. It warns rather than blocks (my call: a hard block
  invites throwaway edits).
- **CLAUDE.md rules.** The root `CLAUDE.md` and the ones in `apps/admin`,
  `apps/web` and `apps/api` say: any change to a feature updates the docs page
  that covers it, or creates one with coverage globs. The `BISO-Flutter`
  repo's CLAUDE.md says the same about the mobile-app pages in BISO-Sites,
  since the check can't see that repo.
- **Last updated** on every page, from git.
- **Screenshots generated by script.** The admin runs locally against a
  separate Appwrite project the owner creates for the docs, seeded with
  made-up data. One script seeds the project; another signs in and captures
  each named screen into `apps/docs/public/screenshots/` with the admin set to
  Norwegian. Both can be rerun.
  How the script signs in is left to the builder; an API-key-minted session is
  fine. Screenshots sit in a plain frame, never the chevron cut, so no part of
  the UI is cropped.

## Look

Follow the mockups in `docs/superpowers/specs/2026-10-27-docs-rework/mockups.html`.

**Landing**
- Top bar: navy, with the BISO logo, "Docs", links to both areas, and Sign
  in.
- The hero is split by a 13° edge:
  - Navy left: "How BISO runs", one line on who it's for, and the ask field,
    which searches and answers.
  - Sky-blue right, with navy text: "Keeping it running", one line, and
    "Start the handover".
- "Start with your role": four columns of numbered reading paths.
- Common tasks by area: headings with the sun underline, which is allowed
  because the headings link to collections.

**Pages**
- Sidebar with the area switcher on top.
- The area name as a breadcrumb.
- H1 in Museo Slab 900, uppercase.
- A meta line: who can do this, and the update date.
- A "Before you start" box.
- Numbered steps.
- A "What happens next" panel.
- Right rail: "On this page" and "Ask about this page".

Dark mode, if Fumadocs keeps it, uses the brand's navy tokens. The details are
the builder's call. The fonts come from `apps/web/public`.

## Assistant

- **On the docs site:** the landing's ask field, the search box and "Ask about
  this page" open an answer panel:
  - a short answer, in steps where it fits
  - warnings for the details people get wrong
  - "Pages used", linking to the pages it drew on
- **What it answers from:** public page content only. It never receives
  private values, whether or not the reader is signed in (my call; signed-in
  readers see those values on the page anyway). When the docs don't cover a
  question, it says so.
- **Running it:** Anthropic through `@repo/ai`. The model tier and retrieval
  approach are the builder's call; whole-docs context with prompt caching and
  search-then-answer are both fine. The endpoint is rate-limited per visitor,
  stores no chats, and turns off cleanly if the API key is missing.
- **In the admin:** the admin assistant gets a tool that answers how-to
  questions through the same docs endpoint or index, with links. It is built
  after `feat/admin-assistant` merges, using that branch's tool helper.

## Stages (my proposal; the order is my call)

1. **Foundation**:
   - the two-area structure and redirects
   - the brand theme, landing and page layout components
   - last-updated dates
   - the coverage frontmatter and the PR check
   - the CLAUDE.md rules in both repos
2. **Recruitment guide and screenshot pipeline**: written and verified. Once
   the owner has created the docs Appwrite project, the screenshots are added.
3. **Developer handover**:
   - sign-in and private blocks
   - the Infisical fetch
   - everything in the developer area
   - the owner Q&A (below)
4. **Rest of the platform guide**: every other area, plus Pick your role and
   the common tasks.
5. **Assistant**: first on the docs site, then in the admin once
   `feat/admin-assistant` has merged.

**Release** (my call). All stages are built on `feat/docs-rework`, which merges
`main` regularly. Nothing goes live stage by stage. The live site keeps its old
pages until the owner deploys the finished rework in one cut-over, after
stages 1 to 4 and the docs-site half of stage 5. Before that, a final pass
re-checks every page against the current `main`, since other work keeps
changing it. The admin half of the assistant ships separately, with or after
`feat/admin-assistant`.

## Facts only the owner can supply

The builder gets everything it can from code, config and git. These need the
owner, collected in one question session during stage 3:

- how deploys are triggered now (the GitHub workflow was deleted 2026-09-17)
- whether the Appwrite build has the full git history; without it, pages show
  no last-updated date (added 2026-10-27 after the Stage 1 review)
- the Appwrite server version, and where Appwrite and Infisical run and back up
- who owns and pays for each outside account, and when each renews
- the August board handover routine, and the BISO year's recurring jobs
- the group consultants should be put in
- the source of the two console-only functions, `get_board_members` and
  `generateDescription`, if it exists anywhere

Answers go into public pages or the Infisical folder, depending on
sensitivity.

## Owner actions (outside the docs)

- Give the administration leader emergency access to Infisical, and test it.
- Assemble the emergency kit from the builder's list.
- Create the docs Appwrite project for screenshots, push the schema from
  `packages/api/appwrite.config.json` to it, and create an API key. Then run
  the seed and capture scripts as their README describes.
- Create the Infisical folder and a read-only machine identity scoped to it.
- Fill the folder from the builder's list of private values, then check every
  private block in final QA.
- Set up the Microsoft sign-in for docs.biso.no (redirect URL), and create the
  "Docs handover" Appwrite team.
- Deploy.

## Left to the builder

- The exact page list, titles and slugs within the structure above.
- Fumadocs mechanics, MDX components and their names.
- How the PR check reports (comment or annotations).
- The assistant's retrieval and model tier.
- How the screenshot script signs in, and how the seed data is shaped. It must
  be realistic but invented.
- Dark mode details.

# Docs go-live checklist

This is the owner's checklist for putting the reworked docs live at
`docs.biso.no` in one cut-over: the platform guide, the developer handover
with its private details, and the docs assistant. Work top to bottom. Each
step assumes the ones above it are done. Tick a step only when its "Done when"
holds.

Nothing here has been run against production yet. This repo is public, so
never write a value from these steps into it.

## 1. Before go-live: security fixes

- [ ] **Fix every item tagged **[Before go-live]** in the private issues list.**
  Done when: each of them is fixed on `main` and live in production.

## 2. Microsoft and Appwrite teams

These are steps 1 and 2 of [Owner actions](CLAUDE.md#owner-actions). Work in
the Appwrite console, in the production project. Don't use the IT team-health
view for these checks: it lowercases ids.

- [ ] **Create the `docs-handover` team first.** Give it the custom id
  `docs-handover`. Do it before any private-source variable is set in
  section 7, so nobody else can claim the id. If a team with that id already
  exists and you didn't create it, delete it and create it again.
  Done when: the team `docs-handover` exists with no members and no owner.
- [ ] **Check the 10 trusted team ids.** Each id in the table under Owner
  actions step 2 must exist. Create any that's missing, with the id and name
  exactly as in the table. For each `sg-app-dept-*` team you create, set up
  the department by hand: on the matching row in the `departments` table,
  keep it readable by anyone and give that team update and delete. If a team has an owner, someone
  made it by hand: delete it, create it again, and redo that setup.
  Done when: all 10 ids exist with the names in the table, and none has an
  owner.
- [ ] **Remove stray members.** In the 10 teams, a stray member is anyone who
  isn't in the matching `SG-App-*` group in Microsoft Entra. In
  `docs-handover`, it's anyone who shouldn't have docs access. The M365 sync
  never removes them for you.
  Done when: every member of the 10 teams is in the matching Entra group, and
  `docs-handover` holds only people you added.

## 3. Infisical

- [ ] **Create the docs folder and a read-only machine identity.** In BISO's
  Infisical project, create a folder for docs values and a machine identity
  with Universal Auth that can only read that folder (Owner actions step 3).
  Done when: the identity can read that folder and nothing else, and you have
  what section 7 needs: the Infisical address, the project id, the
  environment slug, the folder path, and the identity's client id and client
  secret.
- [ ] **Fill in every registry name.** Add one secret per name below to the
  folder. The key is the name exactly as written. The value is what the
  description asks for. Names and descriptions come from
  `lib/private/registry.ts`.

  | Name | Description |
  | --- | --- |
  | `appwrite-console-url` | The address of the Appwrite console that BISO uses, as a full link. |
  | `server-provider-account` | Which hosting provider runs the BISO servers, and who owns that account. |
  | `server-access` | How a handover person gets onto the servers: who grants access and where the keys are kept. |
  | `infisical-url` | The link to BISO's Infisical project, as a full link. |
  | `infisical-layout` | How BISO's Infisical project is organised: which environment and folder holds the production values for each app (web, admin, api, docs) and each Appwrite function, so a developer knows where to read or update a value. |
  | `infisical-admin-recovery` | Who can recover Infisical admin access if the current admins are gone, and how to reach them. |
  | `admin-leader-contact` | The current administration leader, who keeps the emergency kit: name and a way to reach them. |
  | `emergency-kit-contents` | **Offline kit, not in Infisical.** The checklist of what the offline emergency kit must contain — item names only, never the credentials themselves; the kit's contents are kept offline by the administration leader. |
  | `docs-handover-team` | The people in the docs-handover team right now, with names and contact details. |
  | `account-owners` | Who owns each shared BISO account, one line per account: the domain, email and social media, and every outside service the platform uses that has no entry of its own here, such as Umami, Anthropic, 24SevenOffice, Vipps and Firebase. |
  | `apple-developer-account` | Who owns the Apple Developer account and which email it is registered under. |
  | `google-play-account` | Who owns the Google Play Console account and which email it is registered under. |
  | `azure-app-registration` | Where the Azure app registrations BISO uses live (sign-in, Microsoft Graph, SharePoint, the Teams bot, and the app that reads BI's student directory) and who owns each. |
  | `microsoft-tenant-admins` | Who the administrators of BISO's Microsoft tenant are, and how to reach them. They create Microsoft accounts outside the admin, for example a consultant's account with no SG-App group. |
  | `github-org` | Who the owners of the BISO GitHub organisation are, and how to reach them. They invite collaborators to BISO-Sites and BISO-Flutter. |
  | `infisical-admins` | Who the Infisical admins are today, and how to reach them. They invite new users to BISO's Infisical project. |
  | `appwrite-console-admins` | Who can invite people to BISO's Appwrite console (the owners of its organisation), and how to reach them. |
  | `better-stack-account` | Who owns the Better Stack account, which email it is registered under, and who receives its alerts. |
  | `security-issues-tracker` | Where the owner keeps the list of open security issues, such as a private GitHub security advisory list or an Infisical note, and who to ask for access. Never the issues themselves. |

  Done when: the folder has a secret for each of the 18 names other than
  `emergency-kit-contents`, and none for that one.
- [ ] **Give the administration leader emergency access to Infisical, and
  test it.**
  Done when: the administration leader has signed in with that access and
  opened a value.
- [ ] **The administration leader assembles the emergency kit** from the private
  emergency kit checklist the builder handed to the owner. The
  `emergency-kit-contents` description says what it must cover. The leader
  keeps the kit offline, away from every server.
  Done when: the administration leader holds the kit and has ticked every
  item on the checklist.

## 4. Anthropic

- [ ] **Create a docs workspace, spend limit and key.** In the Anthropic
  Console, create a workspace for docs alone, give it a monthly spend limit,
  and create the docs API key in it ([Owner steps](CLAUDE.md#owner-steps)
  step 1). The limit is the real spend guard. At the defaults, one process
  that reaches its daily total every day spends about $105 a month.
  Done when: the key exists in the docs workspace only, and the workspace
  shows the monthly limit.

## 5. Screenshots

Do this in a checkout of `feat/docs-rework`, before the merge in section 6,
so the images go live with the rest. Follow
[Steps](scripts/screenshots/README.md#steps) in the screenshots README, from a
shell with only the `DOCS_*` variables set.

- [ ] **Create the docs Appwrite project** (README step 1).
  Done when: you have its project id, it isn't the production project, and
  it's set as `DOCS_APPWRITE_PROJECT`, with `DOCS_APPWRITE_ENDPOINT`.
- [ ] **Push the schema.** From `apps/docs`, run
  `bun run screenshots:schema`, then `appwrite push tables --all` from the
  folder it prints (README step 2). Never push from `packages/api`.
  Done when: the CLI named the docs project before you confirmed, and the docs
  project has the tables.
- [ ] **Create the API key** in the docs project with the scopes in README
  step 3.
  Done when: it's set as `DOCS_APPWRITE_API_KEY`.
- [ ] **Run seed and capture** (README steps 4 to 6). Move
  `apps/admin/.env.local` out first, and start the admin from `apps/admin`,
  not through Turbo. Capture before 15 January 2027, or move the seeded
  vacancy deadlines forward first.
  Done when: `bun run screenshots:capture` prints `Saved 28 of 28 shots` and
  exits without an error, and `apps/admin/.env.local` is back.
- [ ] **Add the `<Screenshot>` tags** (README step 7). Look at every image
  first: made-up data only, nothing private on screen. For each shot in
  `scripts/screenshots/manifest.ts`, add a `<Screenshot>` to its `page`,
  after the content of the `<Step>` named in `afterStep`. The 28 shots go on
  19 guide pages.
  Done when: `git grep -o "<Screenshot" apps/docs/content | wc -l` prints 28,
  and `bun run test --filter=docs` and `bun run build --filter=docs` pass.
- [ ] **Commit the images** in `apps/docs/public/screenshots` with the pages.
  Done when: the commit is on `feat/docs-rework`.

## 6. Merge to main

The Sites build the latest commit on `main`. The admin's half of docs sign-in
(`NEXT_PUBLIC_DOCS_URL`) is only on this branch until it merges.

- [ ] **Merge `feat/docs-rework` into `main`**, then run
  [Before you deploy](content/docs/developers/keep-it-running/deploying.mdx#before-you-deploy)
  on `main`.
  Done when: `bun run check-types`, `bun run test --filter=docs`,
  `bun run build --filter=docs` and `bun run build --filter=admin` pass on
  `main`.
- [ ] **Run the [leak check](CLAUDE.md#leak-check)** on `main`, from
  `apps/docs`: `bun run check:private-leaks`. It deletes and rebuilds
  `apps/docs/.next`, so stop any docs dev server in that checkout first.
  Done when: it exits 0.

## 7. Appwrite site for docs

- [ ] **Create the docs Site** in the production project, from BISO-Sites
  `main`. Copy the admin Site's build settings (root directory, install command,
  output directory, runtime), not its variables. Use the build command
  `bun run build:docs:appwrite`. If a docs Site already exists (the old
  deploy workflow had one), use it. If the console builds on create, let it:
  section 8 deploys again with the variables set.
  Done when: the docs Site exists and builds from `main`.
- [ ] **Set the env vars from `apps/docs/.env.example`** on the docs Site:

  | Variable | Value |
  | --- | --- |
  | `NEXT_PUBLIC_APPWRITE_ENDPOINT`, `NEXT_PUBLIC_APPWRITE_PROJECT` | The same as on the admin Site |
  | `APPWRITE_SESSION_COOKIE` | `a_session_biso_admin` |
  | `DOCS_PRIVATE_SOURCE` | `infisical` |
  | `INFISICAL_SITE_URL` | The Infisical server's base address, with no path |
  | `INFISICAL_PROJECT_ID`, `INFISICAL_ENVIRONMENT`, `INFISICAL_SECRET_PATH` | BISO's project id, the environment slug and the docs folder's path, from section 3 |
  | `INFISICAL_CLIENT_ID`, `INFISICAL_CLIENT_SECRET` | The machine identity's, from section 3 |
  | `ANTHROPIC_API_KEY` | The docs key, from section 4 |
  | `DOCS_ASSISTANT_MODEL`, `DOCS_ASSISTANT_DAILY_LIMIT` | Leave unset, for `balanced` and 50 |
  | `DOCS_PRIVATE_FAKE_FILE`, `DOCS_PRIVATE_ALLOW_FAKE` | Leave unset: development only |

  `NEXT_PUBLIC_ADMIN_URL` comes two steps down.
  Done when: the Site has every value above and no other variables.
- [ ] **Set `NEXT_PUBLIC_DOCS_URL` on the admin and rebuild the admin.** Set
  `NEXT_PUBLIC_DOCS_URL=https://docs.biso.no` on the admin Site, then deploy
  the latest `main` to it
  ([Steps](content/docs/developers/keep-it-running/deploying.mdx#steps)). The
  value is inlined at build time. The deploy also ships any other commits on
  `main` that aren't live on the admin yet. If it misbehaves,
  [roll back](content/docs/developers/keep-it-running/deploying.mdx#roll-back).
  Done when: the admin's active deployment is the latest `main`,
  `https://admin.biso.no/api/health/ready` answers 200, and you can sign in.
  The docs link in the admin leads nowhere until section 8 is done.
- [ ] **Set `NEXT_PUBLIC_ADMIN_URL` on docs** to `https://admin.biso.no`. It
  is inlined at build time, so set it before the deploy in section 8.
  Done when: the docs Site has it.
- [ ] **Point `docs.biso.no` at the docs Site.** Add the domain to the Site
  and create the DNS record the console asks for. Docs must run on a
  `*.biso.no` host, or the browser never sends it the admin's session cookie.
  Done when: the console shows `docs.biso.no` on the docs Site as verified.
- [ ] **Make sure the admin session cookie is set on `.biso.no`.** Sign in at
  `https://admin.biso.no` and open the cookies in the browser's developer
  tools.
  Done when: `a_session_biso_admin` has the domain `.biso.no`.

## 8. Deploy and check

- [ ] **Deploy docs.** Start a new deployment of the latest `main` on the docs
  Site and watch the build log.
  Done when: it's the active deployment, and
  `curl -s https://docs.biso.no/api/health` answers `{"status":"ok",…}`.
- [ ] **Check the sign-in link from a signed-out page.** In a private window,
  open `https://docs.biso.no/developers/start-here/getting-access`. A private
  block says "Sign in with your BISO admin account to see this." Choose
  **Sign in** and sign in on the admin.
  Done when: you land back on Getting access, signed in.
- [ ] **Sign in and check every `<Private>` block shows a value.** As a global
  admin, open each developer page that uses one
  (`git grep -l "<Private name=" apps/docs/content` lists 17). Values are
  cached for 5 minutes, so wait that long after changing one in Infisical.
  If every block fails, the docs Site's log line
  `[docs] private source unavailable:` names the error: check the
  `INFISICAL_*` variables.
  Done when: no block says "This couldn't be loaded right now. Try again
  later.", and the log shows no new `[docs] private source has no value for:`
  line. If there is no such line, check that `DOCS_PRIVATE_SOURCE` is
  `infisical`.
- [ ] **Confirm the proxy sets `x-forwarded-for`.** Follow
  [Owner steps](CLAUDE.md#owner-steps) step 4: on the landing, ask `qzxv`
  nine times, then ask once from another network, such as a phone on mobile
  data. It costs nothing but uses 10 of the day's 50 questions.
  Done when: the ninth question gets "You've asked a lot of questions. Try
  again in a few minutes." and the one from the other network doesn't.
- [ ] **Check a sample of legacy URLs redirect.** Do this while the
  per-visitor limit resets. Try five paths from `legacy-urls.json`, for
  example:

  ```bash
  curl -sI https://docs.biso.no/docs/admin-handbook/jobs | grep -i -E '^(HTTP|location)'
  ```

  Done when: each answers 307 with a `location` that loads. This one goes to
  `/guide/recruitment`.
- [ ] **Check the denied side.** Sign in as a department member who isn't a
  global or campus admin, and open
  `https://docs.biso.no/developers/start-here/getting-access`.
  Done when: every private block reads "Your account doesn't have access to
  this."
- [ ] **Check that last-updated dates show.** Open any page.
  Done when: "Updated" and a date show under the title. If no page has one,
  the Appwrite build is a shallow clone and `lib/git-dates.ts` hides every
  date.
  [What a deploy workflow needs](content/docs/developers/keep-it-running/deploying.mdx#what-a-deploy-workflow-needs)
  explains how to build with full history. Fix that, or go live without dates
  for now.
- [ ] **Ask the assistant's three test questions** from Owner steps step 5.
  Wait 10 minutes after the `x-forwarded-for` check first, or use the other
  network.
  Done when: "How do I publish a vacancy?" gets numbered steps with `[n]`
  citations and Publish a vacancy under **Pages used**; "How do I book a group
  room at BI?" gets one sentence saying the docs don't cover it; and "What is
  the Infisical address?", asked with **Ask about this page** on Getting
  access, gets no address, signed out or signed in.

If the assistant misbehaves, unset `ANTHROPIC_API_KEY` on the docs Site and
redeploy ([Switch it off](CLAUDE.md#switch-it-off)).

## 9. After go-live

- [ ] **Retire the old docs.** Delete any deployment or domain that still
  serves the old pages, such as an older docs deployment or an
  Appwrite-generated domain.
  Done when: the old `/docs/...` pages open only as redirects on
  `docs.biso.no`, and no deployment with the old pages can be made active.
- [ ] **Update the pages that say docs isn't live.** Also write the docs
  Site's settings into `deploying.mdx`, as
  [The Site settings live only in the console](content/docs/developers/keep-it-running/deploying.mdx#the-site-settings-live-only-in-the-console)
  asks, and add `docs.biso.no` to the certificate check in
  `yearly-calendar.mdx`.
  Done when this prints nothing:

  ```bash
  git grep -n -i -E "planned for|, planned|not deployed yet|live yet\. Before|once (docs is|it's) live|once these docs" apps/docs/content/docs/developers
  ```

- [ ] **Monitor docs.** Add `https://docs.biso.no/api/health` to Better
  Stack
  ([Monitoring and health](content/docs/developers/keep-it-running/monitoring-and-health.mdx)).
  Done when: the check is green and its alerts reach you.
- [ ] **Check the assistant's spend** a few days later (Owner steps step 6).
  Done when: the docs workspace's usage in the Anthropic Console is in line
  with [What a question costs](CLAUDE.md#what-a-question-costs). A day with
  more than 50 requests means the Site restarted that day or runs more than
  one process.
- [ ] **Answer the two open questions.** When does the BI sign-in (OIDC)
  client secret expire, and who owns its app registration? When the scanner
  shows orange, **Allerede skannet** (Already scanned), should the guard check
  ID or refuse entry?
  Done when: the first is under
  [Azure app secrets](content/docs/developers/keep-it-running/yearly-calendar.mdx#azure-app-secrets),
  and the second is in `content/docs/guide/members-and-benefits/scan-member-passes.mdx`.
- [ ] **Delete this file** once every box above is ticked, and remove the
  `GO-LIVE.md` pointer line in `apps/docs/CLAUDE.md`.
  Done when: `git grep -n "GO-LIVE" apps/docs` prints nothing.

The admin assistant's docs tool comes after `feat/admin-assistant` merges.
Nothing is needed for it at go-live.

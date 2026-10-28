# Guide screenshots

These scripts take the guide's admin screenshots from a docs-only Appwrite
project filled with made-up data. No real student, applicant or staff member
appears in them, and no Microsoft sign-in is needed.

| File | What it does |
|------|--------------|
| `seed-data.ts` | The made-up data: one campus (Oslo), the HR and Demo Events departments, four staff users, two vacancies, eight applicants across every status, two interviews and one scorecard. Every email ends in `@example.org`. |
| `schema.ts` | Writes a tables-only copy of the schema with the docs project's id, for the Appwrite CLI to push. |
| `seed.ts` | Writes the seed to the docs project: users, teams, memberships and rows. Safe to run again. |
| `manifest.ts` | The shots: admin route, the guide page, the step it follows, size and caption. |
| `capture.ts` | Signs in as the seeded users and saves `<id>.png` for each shot. |

## The production guard

Every script reads its settings through `config.ts` first. It stops when:

- `DOCS_APPWRITE_PROJECT` is not set;
- `DOCS_APPWRITE_PROJECT` is the production project (the `projectId` in
  `packages/api/appwrite.config.json`), in any case and with any spaces
  around it;
- `DOCS_APPWRITE_PROJECT` equals `APPWRITE_PROJECT_ID`,
  `NEXT_PUBLIC_APPWRITE_PROJECT` or `NEXT_PUBLIC_APPWRITE_PROJECT_ID` in the
  shell.

`seed.ts` and `capture.ts` also stop when `DOCS_APPWRITE_API_KEY` equals
`APPWRITE_API_KEY`, or when `DOCS_ADMIN_URL` points at the production domain.
`schema.ts` reads no key, so it can run before you make one.

So run the scripts from a shell that has only the `DOCS_*` variables below,
not one set up for an app.

## Settings

| Variable | Used by | Value |
|----------|---------|-------|
| `DOCS_APPWRITE_ENDPOINT` | all scripts | The Appwrite endpoint of the server that holds the docs project, ending in `/v1`. |
| `DOCS_APPWRITE_PROJECT` | all scripts | The docs project's id. |
| `DOCS_APPWRITE_API_KEY` | `seed.ts`, `capture.ts` | An API key made in the docs project (step 3). |
| `DOCS_ADMIN_URL` | `capture.ts` | Where the admin runs. Defaults to `http://localhost:3001`. |
| `DOCS_SCREENSHOT_DIR` | `capture.ts` | Where the images go, from the repo root. Defaults to `apps/docs/public/screenshots`. |

## Steps

1. **Create the project.** In the Appwrite console, create a new project,
   for example "BISO docs screenshots". Note its project id. It can live on
   the same Appwrite server as production: the project id keeps the data
   apart.

2. **Push the schema.** Log the Appwrite CLI in to the server
   (`appwrite login`, with `--endpoint` set to the same endpoint as
   `DOCS_APPWRITE_ENDPOINT` for a self-hosted server). Then, from
   `apps/docs`, with `DOCS_APPWRITE_ENDPOINT` and `DOCS_APPWRITE_PROJECT` set
   (no API key yet, that comes in step 3):

   ```bash
   bun run screenshots:schema
   ```

   It prints a temporary folder. Push from there, never from
   `packages/api`, whose config names the production project:

   ```bash
   cd <the folder it printed>
   appwrite push tables --all
   ```

   Check that the CLI names the docs project before you confirm. It creates
   the databases and tables with their permissions.

3. **Create an API key.** In the docs project, open **Overview**, then
   **Integrations**, then **API keys**, and create a key with these scopes:

   - `users.read`, `users.write` (create the staff users, set their language,
     open and close sessions; also `sessions.write` if your server lists it)
   - `teams.read`, `teams.write` (create the teams and memberships)
   - `databases.read`, `tables.read`, `rows.read`, `rows.write` (write and
     read the rows)

   Set it as `DOCS_APPWRITE_API_KEY`. The admin uses the same key in step 5.

4. **Install the browser.** Once per machine, from `apps/docs`:

   ```bash
   bunx playwright install chromium
   ```

5. **Start the admin against the docs project.** Next.js reads
   `apps/admin/.env.local` on start. Move that file (and any other
   `apps/admin/.env*` file with real values) out of the folder for the run,
   so no production value or service secret is in reach. Then, in its own
   terminal, set only these in the shell (for example with `export`):

   | Variable | Value |
   |----------|-------|
   | `NEXT_PUBLIC_APPWRITE_ENDPOINT` | the same as `DOCS_APPWRITE_ENDPOINT` |
   | `NEXT_PUBLIC_APPWRITE_PROJECT` | the same as `DOCS_APPWRITE_PROJECT` |
   | `APPWRITE_API_KEY` | the same as `DOCS_APPWRITE_API_KEY` |
   | `APPWRITE_SESSION_COOKIE` | `a_session_biso_admin` |
   | `NEXT_PUBLIC_BASE_URL` | `http://localhost:3001` |

   and start the admin from its own folder:

   ```bash
   cd apps/admin
   bun run dev
   ```

   That runs `next dev` on port 3001 with the shell's variables. Don't use
   `bun run dev --filter=admin` from the repo root: it goes through Turbo,
   which passes only the variables a task declares, so these settings never
   reach the admin and it refuses to start.

   Leave the Microsoft (`AZURE_*`), OpenAI, SMTP, SharePoint and payment
   variables unset. None of the shots needs them, and without them the admin
   can't reach Outlook or send mail. Put `.env.local` back when you are done.

6. **Seed, then capture.** In a second terminal, from `apps/docs`, with only
   the `DOCS_*` variables set:

   ```bash
   bun run screenshots:seed
   bun run screenshots:capture
   ```

   `seed.ts` prints the staff user ids. `capture.ts` prints one line per shot,
   saved or failed, and exits with an error if any failed. It sets each
   signed-in user's language to Norwegian, as staff see the admin. The first
   visit to each screen compiles it in `next dev`, so the first run is slow.
   Run the seed again before a new capture to reset the data.

   The seeded dates are fixed in September 2026. The **Panel calendar** on
   the **Interviews** tab shows the weekdays from today, so the seeded
   interviews won't appear in that grid. The shots use the lists on that tab,
   not the grid. The "days since applied" on each card also depends on the
   day you capture.

   The vacancy deadlines are fixed too: 14 January 2027 for the published
   vacancy and 29 January 2027 for the draft (`PUBLISHED_DEADLINE` and
   `DRAFT_DEADLINE` in `seed-data.ts`). Capture before 15 January 2027.
   After that, **Stillinger** (Jobs) shows the published vacancy past its
   deadline, with **Frist passert** (Past deadline). To capture later, move
   both deadlines forward and seed again. Before then, the days left on the
   jobs list depend on the day you capture.

7. **Add the images to the guide.** For each shot in `manifest.ts`, open its
   `page` and add a `<Screenshot>` after the content of the `<Step>` named in
   `afterStep`:

   ```mdx
   <Screenshot
     src="/screenshots/recruitment-pipeline.png"
     alt="The Pipeline tab with candidates in each stage"
     caption="The Pipeline tab: one column per stage, from Applied to Archived, with each candidate's AI match score."
     width={1440}
     height={900}
   />
   ```

   Use the shot's `id` in `src`, its `caption`, and its `width` and `height`.
   Look at every image before you commit it: made-up data only, and nothing
   private on screen. Then commit the images in `apps/docs/public/screenshots`
   with the pages.

## What the scripts write

- `seed.ts`: the staff users, the teams `sg-app-campus-oslo`,
  `sg-app-campus-national`, `sg-app-dept-hr`, `sg-app-dept-operationsunit` and
  `sg-app-dept-demoevents`, each user's memberships (it removes any other
  role-team membership a seeded user has), and the rows in `seed-data.ts`.
- `capture.ts`: each signed-in user's language preference, one session per
  role (deleted at the end), and the PNG files in the screenshot folder. The
  seed marks the recruitment tour as dismissed. If the tour opens anyway,
  `capture.ts` chooses **Hopp over** (Skip tour), and the admin saves that
  for the user in the docs project.

Nothing is written anywhere else.

## Screens that need outside services

The schedule dialog reads Outlook calendars only when you choose **Check
availability**, and booking links are made only on **Generate booking link**.
The shots stop before both, so they show the dialog and the form with
made-up data and never call Microsoft.

## How sign-in works here

Real sign-in goes through Microsoft, which also syncs the user's groups into
Appwrite teams. `capture.ts` skips that: it creates a session for the seeded
user with the server SDK and sets the admin's session cookie,
`a_session_biso_admin`, for the admin's own host. The seeded team memberships
are what gives each user their role:

| User | Teams | Role in the admin |
|------|-------|-------------------|
| Kari Nordmann, Per Olsen | Oslo, HR | HR for Oslo |
| Ingrid Berg | National, Operations Unit | Global admin |
| Lars Johansen | Oslo, Demo Events | Department member |

The HR team must be called "HR": the admin finds the HR role by that name.

## BISO Sites Admin App (`apps/admin`)

The admin app is the internal CMS and operations console for BISO Sites. It is
used by IT, global admins, campus admins, and department staff to manage content,
recruitment, events, documents, shop products, approvals, Microsoft 365 users,
and page publishing.

For the longer operator-facing guide, see
`apps/docs/content/docs/applications/admin-app`.

### Current Scope

- **Authentication and RBAC**: Microsoft/Appwrite sessions with roles derived
  from Appwrite team memberships synced from Azure AD security groups.
- **Content operations**: jobs, events, news, benefits, documents, shop products,
  pages, submissions, drafts, and activity.
- **Publishing controls**: department users can draft/update in scope; publishing
  requires campus-admin or global-admin access. Assistant-driven publish
  escalations use `/approvals`.
- **Settings**: global admins can save their own admin locale, timezone, and
  notification preferences; integration/security rows report configured status.
- **Integrations**: Appwrite, Microsoft 365, SharePoint documents, Vipps
  MobilePay, and the assistant stack from `@repo/ai`.

### Tech Stack

- Next.js 16 App Router with React 19 and Server Components.
- TypeScript with shared config from `@repo/typescript-config`.
- Appwrite auth, Teams, TablesDB, Storage, Functions, and Messaging via
  `@repo/api`.
- `next-intl` messages from `packages/i18n/messages`.
- In-house page editor from `@repo/editor`; this app does not use Puck.
- Tailwind CSS and local studio components under `(portal)/_components`.

### Local Development

From the monorepo root:

```bash
bun install
bun run dev --filter=admin
```

The dev server runs on `http://localhost:3001`.

### Route Structure

```text
apps/admin/src/app/
├── (auth)/auth/             # login, callback, OAuth, invite
├── (portal)/                # primary admin UI
│   ├── _actions/            # domain server actions
│   ├── _components/         # portal shell, studio UI, assistant UI
│   ├── activity/
│   ├── approvals/
│   ├── benefits/
│   ├── departments/
│   ├── documents/
│   ├── drafts/
│   ├── events/
│   ├── it/users/
│   ├── jobs/
│   ├── news/
│   ├── pages/
│   ├── settings/
│   ├── shop/
│   └── submissions/
├── (editor)/pages/[id]/     # page editor
├── (protected)/profile/
└── api/                     # assistant, auth, health, upload, sync, etc.
```

There is no `middleware.ts`; route-group layouts, server actions, and route
handlers enforce auth.

### Production Checks

Use root commands so Turborepo runs the package task with the right graph:

```bash
bun x turbo run check-types --filter=admin --force
bun x ultracite check apps/admin package.json
bun run build:admin
bun run build:admin:appwrite
```

Focused admin regression tests can be run with:

```bash
bun test 'apps/admin/src/app/(portal)/_actions/approval-execution.test.ts' \
  'apps/admin/src/app/(portal)/settings/settings-model.test.ts'
```

### Deployment Notes

- Appwrite standalone packaging uses `bun run build:admin:appwrite`.
- The container entrypoint is `apps/admin/server.js` from the Next standalone
  output.
- Required environment variables are documented in `apps/admin/.env.example`.
- Docker builds need a running Docker daemon; local `next build` and standalone
  smoke tests are still required when Docker is unavailable.

## BISO Sites Admin App (`apps/admin`)

The **Admin App** is the CMS and control center for BISO Sites. It is used by IT, editors, and operations staff to manage users, content, events, shop data, units, jobs, and expenses.

For a full overview, see `/docs/applications/admin-app` in the docs app.

### Features

- **Authentication & RBAC** – login, role-based access control (admin/editor/viewer).
- **User management** – manage accounts, roles, and invitations.
- **Content management** – posts/news, pages, events, units, jobs.
- **Page builder** – Puck-powered visual editor for landing pages and content blocks.
- **Shop & payments** – products, orders, integration with Vipps via `@repo/payment`.
- **Internal tools** – expense tracking and operational dashboards.

### Tech Stack

- Next.js 15 (App Router) with React 19 and Server Components.
- TypeScript with shared config from `@repo/typescript-config`.
- Tailwind CSS + shared components from `@repo/ui`.
- Appwrite for auth, database, and storage via `@repo/api`.
- Puck (`@measured/puck`) and `@repo/editor` for visual page building.
- Vipps payments via `@repo/payment`.

### Local Development

From the monorepo root:

```bash
# Install dependencies (once)
bun install

# Run only the admin app (port 3001)
bun run dev --filter=admin
```

Visit `http://localhost:3001`. Authentication, roles, and collections are configured in Appwrite – see `/docs/operations/appwrite-setup` and `/docs/applications/admin-app/auth`.

### Directory Structure

```text
apps/admin/
├── src/
│  ├── app/
│  │  ├── (admin)/          # Protected admin routes
│  │  │  └── admin/
│  │  │     ├── page.tsx    # Dashboard
│  │  │     ├── users/      # User management
│  │  │     ├── posts/      # News/posts
│  │  │     ├── events/     # Events
│  │  │     ├── pages/      # Page builder
│  │  │     ├── shop/       # E‑commerce
│  │  │     ├── units/      # Departments
│  │  │     ├── jobs/       # Job board
│  │  │     └── expenses/   # Expense system
│  │  ├── (auth)/           # Login and auth routes
│  │  ├── (protected)/      # Other protected routes
│  │  ├── actions/          # Server actions
│  │  ├── api/              # Route handlers
│  │  └── ...
│  ├── components/          # Admin UI components
│  ├── lib/                 # Utilities, hooks, server helpers
│  ├── i18n/                # Localization helpers
│  └── proxy.ts
├── messages/               # `en`/`no` translation JSON files
├── public/                 # Static assets
├── next.config.ts
├── tailwind.config.cjs
├── tsconfig.json
└── package.json
```

See `/docs/applications/admin-app` for detailed module and route documentation.

### Shared Packages

- `@repo/api` – Appwrite clients for server actions and dashboards.
- `@repo/editor` – Puck editor configuration and renderer used in the page builder.
- `@repo/ui` – shared design system (tables, forms, navigation, etc.).
- `@repo/payment` – Vipps-related order and payment handling.

### Scripts

Defined in `apps/admin/package.json`:

```bash
bun run dev      # next dev -p 3001
bun run build    # next build
bun run start    # next start
bun run lint     # next lint
```

Prefer running repo-wide commands from the root (`bun run dev`, `bun run build`, etc.) when working across apps.

### Further Reading

- Admin overview: `/docs/applications/admin-app`
- Auth & RBAC: `/docs/applications/admin-app/auth`
- User management: `/docs/applications/admin-app/user-management`
- Page builder: `/docs/packages/editor/overview`

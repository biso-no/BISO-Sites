## BISO Sites Web App (`apps/web`)

The **Web App** is the public-facing website for students, members, and visitors. It powers membership onboarding, events, e‑commerce, units/departments, jobs, and public content pages.

For a deep dive, see `/docs/applications/web-app` in the docs app.

### Features

- **Public information hub** – about pages, policies, contact, press.
- **Membership** – registration flows, benefits overview, member dashboard.
- **Events** – listing, filtering, registration and attendance tracking.
- **E‑commerce** – product catalog, cart, Vipps checkout, orders.
- **Units & departments** – department pages with products, news, and teams.
- **Jobs & news** – job board and news/press content.

### Tech Stack

- Next.js 15 (App Router) with React 19 and Server Components.
- TypeScript with strict settings via `@repo/typescript-config`.
- Tailwind CSS + design system components from `@repo/ui`.
- Appwrite (database, auth, storage) via `@repo/api`.
- Vipps MobilePay payments via `@repo/payment`.
- `next-intl` for Norwegian/English localization.

### Local Development

From the monorepo root:

```bash
# Install dependencies (once)
bun install

# Run only the web app (port 3000)
bun run dev --filter=web
```

The app will be available at `http://localhost:3000` (with `/no` and `/en` locale prefixes).

Environment variables and Appwrite/Vipps setup are documented in `/docs/operations` and the **Installation** guide under `/docs/repository/installation`.

### Directory Structure

```text
apps/web/
├── src/
│  ├── app/
│  │  ├── (public)/       # Public routes (home, about, events, shop, units, membership, contact, ...)
│  │  ├── (protected)/    # Authenticated routes (profile, expenses, etc.)
│  │  ├── (auth)/         # Auth routes
│  │  ├── actions/        # Server actions
│  │  ├── api/            # Route handlers (webhooks, integrations)
│  │  └── ...
│  ├── components/        # UI and feature components
│  ├── lib/               # Utilities, Appwrite helpers, misc logic
│  ├── i18n/              # next-intl configuration
│  └── proxy.ts           # Proxy/middleware helpers
├── messages/             # `en`/`no` translation JSON files
├── public/               # Static assets (images, fonts, pdf.worker, etc.)
├── next.config.ts
├── tailwind.config.cjs
├── tsconfig.json
└── package.json
```

See `/docs/applications/web-app/routing` for a full route map and `/docs/applications/web-app/components` for component-level guidance.

### Shared Packages

The web app relies heavily on shared packages:

- `@repo/api` – Appwrite clients (`createSessionClient`, storage helpers, generated types).
- `@repo/payment` – Vipps checkout flows used in cart/checkout server actions.
- `@repo/ui` – design system primitives and patterns.
- `@repo/editor` – rendering content created in the admin Puck editor.

### Scripts

Defined in `apps/web/package.json`:

```bash
bun run dev      # next dev -p 3000
bun run build    # next build
bun run start    # next start
bun run lint     # next lint
```

Use the root-level commands (`bun run dev`, `bun run build`, etc.) when working across multiple apps.

### Further Reading

- Web app overview: `/docs/applications/web-app`
- Feature guides (membership, events, e‑commerce, units): `/docs/applications/web-app/features/*`
- Server actions and routes: `/docs/applications/web-app/server-actions` and `/docs/applications/web-app/api-routes`

## BISO Sites API App (`apps/api`)

This app hosts the repository's server-side API routes and integration endpoints. It is a Next.js App Router application used for operational APIs, admin-facing endpoints, payment/webhook flows, and background-facing integration handlers.

For shared setup, architecture, and environment details, use the root documentation in `/docs` and the workspace `README.md`.

### What lives here

- `src/app/api/health` – health/readiness endpoint
- `src/app/api/events` and `src/app/api/jobs` – public-facing data endpoints
- `src/app/api/admin/*` – admin operations for users, campuses, departments, and account turnover
- `src/app/api/expenses/*` – expense submission, OCR, and summary flows
- `src/app/api/wc-products` – webshop/product integration endpoint
- `src/app/api/cleanup-anon-users` – maintenance endpoint

### Local development

From the monorepo root:

```bash
bun run dev --filter=api
```

The API app runs on `http://localhost:3003`.

### Useful commands

From the monorepo root:

```bash
bun run lint --filter=api
bun run check-types --filter=api
bun run build --filter=api
```

### Notes

- This app depends on shared workspace packages such as `@repo/api`, `@repo/connectors`, `@repo/payment`, and `@repo/ai`.
- Environment variables and deployment details should stay documented centrally in `/docs/operations`.

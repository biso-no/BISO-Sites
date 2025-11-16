## BISO Sites Docs App (`apps/docs`)

The **Docs App** is the canonical documentation site for the BISO Sites monorepo. It is built with Next.js and Fumadocs, and hosts guides for the repository, applications, architecture, operations, and shared packages.

This is where onboarding guides, operational runbooks, and API/package documentation live.

### Audience

- **New IT managers / maintainers** – onboarding, operations, and architecture.
- **Developers** – development workflow, package APIs, and feature guides.
- **Editors / stakeholders** – high-level overviews of applications and features.

### Tech Stack

- Next.js 15 with the App Router.
- React 19 with MDX content rendering.
- Fumadocs (`fumadocs-core`, `fumadocs-ui`, `fumadocs-mdx`) for navigation and layout.
- Shared UI components from `@repo/ui`.

### Local Development

From the monorepo root:

```bash
# Install dependencies (once)
bun install

# Run only the docs app (port 3002)
bun run dev --filter=docs
```

Then open `http://localhost:3002` in your browser.

### Directory Structure

```text
apps/docs/
├── app/
│  ├── (home)/              # Landing page for docs
│  ├── docs/                # Fumadocs routes ([[...slug]])
│  ├── api/search/          # Search route handler
│  └── og/                  # Open Graph images
├── content/
│  └── docs/
│     ├── repository/       # Monorepo & onboarding docs
│     ├── applications/     # web/admin/docs app docs
│     ├── packages/         # @repo/api, @repo/payment, @repo/ui, @repo/editor
│     ├── development/      # Dev workflow, patterns, guides
│     ├── architecture/     # High-level system design
│     ├── operations/       # Environments, Appwrite, Docker, deployments
│     └── reference/        # Command reference and misc
├── components/             # MDX components (Callout, Steps, Tabs, etc.)
├── lib/
│  ├── source.ts            # Content source adapter
│  └── layout.shared.tsx    # Shared layout config
├── next.config.mjs
├── postcss.config.mjs
├── tsconfig.json
└── package.json
```

### Editing Documentation

All docs content lives under `apps/docs/content/docs`. Each section has its own `meta.json` and `.mdx` files:

- Repository docs: `content/docs/repository/*`
- Application docs: `content/docs/applications/*`
- Package docs: `content/docs/packages/*`
- Architecture docs: `content/docs/architecture/*`
- Operations docs: `content/docs/operations/*`

After editing `.mdx` files, save and refresh your browser; Fast Refresh will reload the page automatically.

### Scripts

Defined in `apps/docs/package.json`:

```bash
bun run dev      # next dev -p 3002 --turbo
bun run build    # next build
bun run start    # next start
bun run lint     # next lint
```

### Further Reading

- Repository overview: `/docs/repository`
- 5-minute quickstart: `/docs/repository/quickstart`
- Packages overview: `/docs/packages`
- Architecture overview: `/docs/architecture/overview`

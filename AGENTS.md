# Repository Guidelines

## Project Structure & Module Organization
- Monorepo managed by Turbo and Bun.
- Apps: `apps/web`, `apps/admin`, `apps/docs` (Next.js, app router). Static assets live under each app’s `public/`.
- Packages: `packages/ui` (shared UI), `packages/editor`, `packages/api`, and internal configs `packages/eslint-config`, `packages/typescript-config`.
- Root configs: `package.json` (scripts), `turbo.json` (task graph), `bun.lock`.

## Build, Test, and Development Commands
- Install deps: `bun install` (Node >= 18, Bun >= 1.3).
- Dev all apps: `bun run dev`. Single app: `bun run dev --filter=web` (or `admin`/`docs`).
- Build all: `bun run build`. Single app: `bun run build --filter=web`.
- Lint: `bun run lint` (ESLint via internal config).
- Types: `bun run check-types` (Next typegen + `tsc` where defined).
- Format: `bun run format` (Prettier 3).

## Coding Style & Naming Conventions
- TypeScript strict (`packages/typescript-config`); prefer explicit types on exports.
- Prettier defaults, 2‑space indent; run `bun run format` before PRs.
- ESLint configs in `packages/eslint-config` (React, Next, TS). Turbo rule blocks undeclared env vars.
- Components: PascalCase (`Button.tsx`). Routes/utility files: kebab-case (`user-profile.ts`).

## Testing Guidelines
- No dedicated unit-test runner configured yet. Validate with `bun run check-types`, `bun run lint`, and `bun run build`.
- Prefer integration checks: run the target app locally (`bun run dev --filter=web`) and verify critical flows.
- Add lightweight test harnesses per package if needed; keep tests adjacent under `__tests__/` when introduced.

## Commit & Pull Request Guidelines
- Conventional Commits with scope: `feat(web): ...`, `fix(admin): ...`, `chore(repo): ...`.
- PRs must include: purpose, scope (`web`/`admin`/`docs`/`ui`/`editor`/`api`), linked issues, and screenshots for UI changes.
- Checklist before submit: `bun run format`, `bun run lint`, `bun run check-types`, and `bun run build` on the changed app/package.
- Update `apps/docs` when public APIs or UI patterns change.

## Security & Configuration Tips
- Environment: use per-app `.env.local`; inputs are captured by `turbo.json` (`.env*`). Avoid committing secrets.
- Keep browser-only secrets out of server bundles; prefer Next server routes or `@repo/api` wrappers.

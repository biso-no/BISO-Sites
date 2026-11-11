# Contributing to BISO-Sites

This repository holds BISO's website, the admin, the API, the docs site and
the Appwrite functions behind them. BISO's IT team maintains it. This page
says how to report problems and how to get a change merged.

## Report a problem or suggest a change

- **Bug or idea:** [open an issue](https://github.com/biso-no/BISO-Sites/issues/new/choose)
  and pick a template.
- **Security problem:** don't open an issue. Follow [SECURITY.md](SECURITY.md).
- **Keep personal data out.** The repository is public. Don't put students'
  names, email addresses, order details or screenshots that show them in
  issues, pull requests, test data or commits.

## Before you write code

Read these first:

1. [`CLAUDE.md`](CLAUDE.md) at the root, then the `CLAUDE.md` of the app you're
   changing (`apps/web`, `apps/admin` or `apps/docs`). They hold the rules for
   data access, auth, env vars and generated files.
2. The developer docs at [docs.biso.no/developers](https://docs.biso.no/developers),
   especially [Local setup](https://docs.biso.no/developers/change-it/local-setup).
   The source is in `apps/docs/content/docs/developers/`.

## Set up

You need Bun 1.3.1 and Node 22 or later. npm and pnpm don't work, because the
workspaces and the shared `catalog:` versions need Bun.

```bash
git clone https://github.com/biso-no/BISO-Sites.git
cd BISO-Sites
bun install
cp apps/web/.env.example apps/web/.env.local   # and the same for each app you run
bun run dev --filter=web
```

> [!WARNING]
> An Appwrite endpoint or project you leave unset falls back to
> **production**. Point every app at an Appwrite project of your own before you
> run it, as [Local setup](https://docs.biso.no/developers/change-it/local-setup)
> describes. Never run `appwrite push` from `packages/api`: its config names
> the production project.

## Make the change

- Branch from `main`. Name the branch after the kind of change:
  `feat/…`, `fix/…`, `chore/…` or `docs/…`.
- Write commit messages as `type(scope): summary`, for example
  `fix(admin): keep the campus filter after saving`.
- Go through `@repo/api` for all data access. Don't import `appwrite` or
  `node-appwrite` in app code.
- Don't edit generated files: `packages/api/appwrite.config.json`,
  `packages/api/types/appwrite.ts` and `apps/*/next-env.d.ts`.
- Add any new build-time env var to `turbo.json`.
- If you change how a feature behaves, update the docs page whose `covers`
  list matches the code you changed, or add a page. A check on the pull
  request warns when you don't. `apps/docs/CLAUDE.md` has the rules.
- Never commit secrets. `.env` files are ignored by git; keep it that way.

## Check your work

CI doesn't run the type-check, the linter or the tests, so run them yourself
before you open a pull request:

```bash
bun run check-types                     # required before merging
bun x ultracite fix <paths you changed>
bun x ultracite check <paths you changed>
bun run test --filter=<workspace>       # for each workspace you touched
```

If you changed a `"use server"` file in the admin, also run
`bun run build --filter=admin`. Only a real build catches a server-action file
that exports something other than async functions.

## Open a pull request

- Open it against `main` and fill in the template.
- Two checks run on every pull request: the docs coverage check, and an
  automated code review that leaves comments. Answer or fix each comment.
- A maintainer reviews and merges. Smaller, focused pull requests are merged
  faster.
- If the change needs anything outside the code before or after it deploys,
  such as a new Appwrite table or column, an env var, or a scheduled job, say
  so in the pull request. A maintainer has to do it by hand.

## Terms for contributions

This repository is not open source. [LICENSE](LICENSE) reserves all rights to
BISO. By submitting a contribution (a pull request, a patch or code in an
issue), you:

- confirm that you wrote it, or otherwise have the right to submit it;
- give BISO a permanent, worldwide, free, non-exclusive and irrevocable right
  to use, copy, change, distribute and sublicense it as part of BISO's
  software, on any terms BISO chooses.

Don't submit code copied from somewhere whose license doesn't allow this.

## Code of conduct

Everyone who takes part is expected to follow the
[code of conduct](CODE_OF_CONDUCT.md).

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


# Ultracite Code Standards

This project uses **Ultracite**, a zero-config Biome preset that enforces strict code quality standards through automated formatting and linting.

## Quick Reference

- **Format code**: `npx ultracite fix`
- **Check for issues**: `npx ultracite check`
- **Diagnose setup**: `npx ultracite doctor`

Biome (the underlying engine) provides extremely fast Rust-based linting and formatting. Most issues are automatically fixable.

---

## Core Principles

Write code that is **accessible, performant, type-safe, and maintainable**. Focus on clarity and explicit intent over brevity.

### Type Safety & Explicitness

- Use explicit types for function parameters and return values when they enhance clarity
- Prefer `unknown` over `any` when the type is genuinely unknown
- Use const assertions (`as const`) for immutable values and literal types
- Leverage TypeScript's type narrowing instead of type assertions
- Use meaningful variable names instead of magic numbers - extract constants with descriptive names

### Modern JavaScript/TypeScript

- Use arrow functions for callbacks and short functions
- Prefer `for...of` loops over `.forEach()` and indexed `for` loops
- Use optional chaining (`?.`) and nullish coalescing (`??`) for safer property access
- Prefer template literals over string concatenation
- Use destructuring for object and array assignments
- Use `const` by default, `let` only when reassignment is needed, never `var`

### Async & Promises

- Always `await` promises in async functions - don't forget to use the return value
- Use `async/await` syntax instead of promise chains for better readability
- Handle errors appropriately in async code with try-catch blocks
- Don't use async functions as Promise executors

### React & JSX

- Use function components over class components
- Call hooks at the top level only, never conditionally
- Specify all dependencies in hook dependency arrays correctly
- Use the `key` prop for elements in iterables (prefer unique IDs over array indices)
- Nest children between opening and closing tags instead of passing as props
- Don't define components inside other components
- Use semantic HTML and ARIA attributes for accessibility:
  - Provide meaningful alt text for images
  - Use proper heading hierarchy
  - Add labels for form inputs
  - Include keyboard event handlers alongside mouse events
  - Use semantic elements (`<button>`, `<nav>`, etc.) instead of divs with roles

### Error Handling & Debugging

- Remove `console.log`, `debugger`, and `alert` statements from production code
- Throw `Error` objects with descriptive messages, not strings or other values
- Use `try-catch` blocks meaningfully - don't catch errors just to rethrow them
- Prefer early returns over nested conditionals for error cases

### Code Organization

- Keep functions focused and under reasonable cognitive complexity limits
- Extract complex conditions into well-named boolean variables
- Use early returns to reduce nesting
- Prefer simple conditionals over nested ternary operators
- Group related code together and separate concerns

### Security

- Add `rel="noopener"` when using `target="_blank"` on links
- Avoid `dangerouslySetInnerHTML` unless absolutely necessary
- Don't use `eval()` or assign directly to `document.cookie`
- Validate and sanitize user input

### Performance

- Avoid spread syntax in accumulators within loops
- Use top-level regex literals instead of creating them in loops
- Prefer specific imports over namespace imports
- Avoid barrel files (index files that re-export everything)
- Use proper image components (e.g., Next.js `<Image>`) over `<img>` tags

### Framework-Specific Guidance

**Next.js:**
- Use Next.js `<Image>` component for images
- Use `next/head` or App Router metadata API for head elements
- Use Server Components for async data fetching instead of async Client Components

**React 19+:**
- Use ref as a prop instead of `React.forwardRef`

**Solid/Svelte/Vue/Qwik:**
- Use `class` and `for` attributes (not `className` or `htmlFor`)

---

## Testing

- Write assertions inside `it()` or `test()` blocks
- Avoid done callbacks in async tests - use async/await instead
- Don't use `.only` or `.skip` in committed code
- Keep test suites reasonably flat - avoid excessive `describe` nesting

## When Biome Can't Help

Biome's linter will catch most issues automatically. Focus your attention on:

1. **Business logic correctness** - Biome can't validate your algorithms
2. **Meaningful naming** - Use descriptive names for functions, variables, and types
3. **Architecture decisions** - Component structure, data flow, and API design
4. **Edge cases** - Handle boundary conditions and error states
5. **User experience** - Accessibility, performance, and usability considerations
6. **Documentation** - Add comments for complex logic, but prefer self-documenting code

---

Most formatting and common issues are automatically fixed by Biome. Run `npx ultracite fix` before committing to ensure compliance.

## Plans

If the user specifically asks for a plan, present the summary of a plan and wait for user
confirmation before proceeding with any code modifications. Do not do extensive research
prior to presenting the plan. Succinctly summarize the task and the main requirements
using informal but terse language (no need to use RFC 2119 modal verbs). If the task is
clear from the prompt, ask the user if the plan looks good before proceeding. If there are
aspects of the plan that require clarification or there are design tradeoffs, ask the user up
to four questions. In cases where there is a clear choice between two or three options, phrase
the question as multiple choice so the user can simply reply with A, B, C, etc. Do not modify
any code until the user tells you that the plan is acceptable.

## Specs

If the user specifically asks for a spec, make sure that a spec exists for the task before
proceeding with detailed planning. If no spec exists for the feature already, create a new
one. Do not do extensive planning or research first. Instead, create a basic spec template
with placeholders.

Do not create a spec if the user doesn't ask for one.

Use the following rules for specs:

- Specs should be written in markdown.
- Specs should be concise, including only critical information to capture intent,
   requirements, and high-level design decisions
- A `/specs` directory at the root of the project should contain specs for features. If this
   directory doesn't exist, create it. Do not place specs in the `/docs` directory unless explicitly
   told to do so.
- Within the `/specs` directory, subdirectories represent features or feature areas. Each directory
   contains one or more "md" files that contain the specification details. Each directory contains a
    single "spec.md" file.
- A complete spec contains: 1. Overview, which is a succinct description of the feature and the
   motivation behind it, 2. Requirements, which capture the intent and user journey, and 3. Design,
   which provides a high-level technical design considerations including architecture, standards,
   frameworks, and external dependencies. Do not include extra sections. Use bulleted lists in
   each section and be concise.
- Requirements should be listed as declarative statements that use RFC 2119 modal verbs
   (MUST, SHOULD, MAY) to express normative strength.
- For the initial spec, do not do extensive code exploration prior to generating the spec.
- When creating a new spec, questions for the user can be added to the bottom of the file in a
   section named "Open Questions".

After creating the spec, ask the user to review it. Proceed with implementing the spec only once
the user confirms that it is complete and correct.
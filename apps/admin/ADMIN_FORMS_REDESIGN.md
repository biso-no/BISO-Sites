# Admin Forms Redesign — Design Brief & Code Audit Spec

> Place this file at `apps/admin/ADMIN_FORMS_REDESIGN.md`.
> Claude Code must read this file at the start of every session touching the admin form pages.

---

## Your Role

You are a **Principal Frontend Engineer and Design Engineer** performing a full audit and redesign of admin content-creation forms. You are **not here to validate the existing code**. You are here to find everything wrong with it and fix it. Assume problems exist — your job is to find them, name them, and resolve them.

You bring the same standards you would bring to a Vercel, Linear, or Stripe codebase. You have a strong aesthetic eye and refuse to ship interfaces that feel unpolished or amateur.

---

## Phase 1 — Audit First, Code Second

Before touching a single line of code, you must complete an audit.

### Code Audit Checklist

Read every page file and its dependencies. For each item below, record your finding explicitly — do not skip, do not assume it's fine.

**Architecture & Decomposition**
- [ ] Is the form a single god-component or properly decomposed into field groups, sections, and shared primitives?
- [ ] Are API calls abstracted into hooks or server actions, or are they raw `fetch` calls inside components?
- [ ] Is there shared infrastructure between the four form pages, or is logic duplicated across them?
- [ ] Are types defined and strict, or scattered `any`s and missing interfaces?

**Form Implementation**
- [ ] Is a form library used (react-hook-form, etc.) or is everything manual `useState`?
- [ ] Is validation schema-driven (Zod) or scattered imperative checks?
- [ ] Is validation only triggered on submit, or does it give inline real-time feedback?
- [ ] Are loading, saving, error, and success states explicitly handled?
- [ ] Can the user lose work due to missing autosave / dirty-state warnings?

**Accessibility**
- [ ] Do all inputs have associated `<label>` elements with correct `htmlFor`?
- [ ] Are `aria-describedby` attributes used for help text and error messages?
- [ ] Is the form keyboard navigable (logical tab order, no focus traps)?
- [ ] Are required fields communicated beyond just a visual asterisk?

**UX Quality**
- [ ] Are error messages helpful ("Title must be at least 3 characters") or generic ("Invalid")?
- [ ] Are there character counts on length-constrained fields?
- [ ] Is there visual feedback while saving?
- [ ] Does the page communicate what will happen when the user submits?
- [ ] Is the submit button always visible or does the user have to scroll to find it?

**Consistency**
- [ ] Are spacing values from the design system or hardcoded magic numbers?
- [ ] Are color values from CSS variables or hardcoded hex?
- [ ] Are the four form pages consistent in layout and interaction patterns?

**Deliver your audit as a written report** in the conversation before writing any code. Do not soften findings. If something is poorly implemented, say so clearly and explain why it matters.

---

## Phase 2 — Redesign

### Who Uses This

**Users:** Non-technical business students at BI Norwegian Business School who manage content for their student organisation. They are smart but not developers. They expect software that feels as polished as the tools they use in their daily lives (Notion, Linear, Figma). They will be discouraged by forms that feel clunky or unclear.

**Content types they create:**
- Products (items for sale)
- Events (student events with dates, locations, registration)
- Job Positions (job listings from partner companies)
- News Posts (editorial content)

### Design Direction

**Aesthetic:** Refined editorial minimalism. Think Vercel dashboard meets a Scandinavian newspaper. Clean, confident, premium. Not corporate. Not playful. Serious but approachable.

**Specific requirements:**

**Layout**
- Two-column layout on desktop: primary fields (left, ~65%) + sidebar metadata panel (right, ~35%)
- Sidebar contains: status toggle (Draft / Published), publish date, cover image upload, category/tags, and quick actions
- Single column on mobile with sidebar collapsed/reordered
- Sticky save bar at the bottom of the viewport — always visible, shows save status + primary action

**Form Structure**
- Group fields into named sections with clear visual dividers (not one endless scroll)
- Each section has a title and optional subtitle explaining what it's for
- Use progressive disclosure — optional/advanced fields are collapsed by default

**Field UX**
- Floating labels or clear above-field labels — never placeholder-as-label
- Inline validation: show field-level errors as soon as the user leaves a field (onBlur), not only on submit
- Helpful error messages — "Event title must be at least 5 characters" not "Required"
- Character counts on: title fields (max visible), description/summary fields
- Rich text editor for long-form content fields (news body, job description)
- Drag-and-drop cover image upload with preview

**Saving & State**
- Autosave drafts every 30 seconds with a subtle indicator ("Saved 12s ago")
- Dirty state warning before navigation away from unsaved changes
- Optimistic submit: show success state immediately, revert on failure
- Distinct states: idle → saving → saved → error (all visible in the sticky bar)

**Navigation**
- Breadcrumb at top: `Admin / Products / New Product`
- Cancel button that respects dirty state
- After successful save, offer "View live" and "Create another" actions

**Typography & Color**
- Use the monorepo's existing design tokens from the shared component library
- If tokens don't cover something, define new ones — do not hardcode values
- Font hierarchy: clear distinction between page title, section headers, field labels, help text
- Use color purposefully: muted for help text, strong for labels, brand color only for primary actions and active states

### Component Architecture

Produce this file structure for each form page:

```
apps/admin/app/(dashboard)/[content-type]/new/
├── page.tsx                    # Server component, data fetching, metadata
├── _components/
│   ├── [ContentType]Form.tsx   # Root form component, react-hook-form setup
│   ├── sections/
│   │   ├── CoreFieldsSection.tsx
│   │   ├── ContentSection.tsx
│   │   └── MetadataSection.tsx
│   ├── sidebar/
│   │   ├── StatusPanel.tsx
│   │   ├── CoverImagePanel.tsx
│   │   └── PublishPanel.tsx
│   └── SaveBar.tsx             # Sticky save bar
└── _hooks/
    ├── use[ContentType]Form.ts # Form logic, validation schema, submit handler
    └── useAutosave.ts          # Shared autosave hook
```

**Shared across all four pages** (place in `packages/ui` or `apps/admin/components/forms/`):
- `FormSection` — titled section wrapper with divider
- `FieldWrapper` — label + input + error message + help text
- `CharacterCount` — live character count display
- `SaveBar` — sticky save/status bar
- `CoverImageUpload` — drag-and-drop image field
- `RichTextEditor` — long-form content editor
- `useAutosave` — autosave hook

### Validation

Use **Zod** for all schema definitions. Co-locate schema with the form hook. Example structure:

```ts
// use[ContentType]Form.ts
const schema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(100),
  slug: z.string().regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and dashes'),
  // ...
})
```

Errors must surface at the field level via react-hook-form's `formState.errors`.

### TypeScript

- No `any` types. If a type is unknown, use `unknown` and narrow it.
- All props interfaces explicitly defined.
- API response types defined and imported from the shared packages if they exist there already.

---

## Phase 3 — Verify

After implementation:
1. Walk through each form as if you are a non-technical BI student publishing content for the first time.
2. Check that every error state renders correctly by simulating validation failures.
3. Confirm the sticky save bar is visible at all scroll positions.
4. Confirm the layout is correct on a narrow viewport (375px).
5. Run TypeScript compiler — zero errors.

---

## Constraints

- Do not remove any existing API wiring unless it is broken. Redesign the UI layer only unless you find a code quality issue so significant that it must be fixed (and you documented it in the audit).
- Do not add new dependencies without flagging them first in the conversation with a brief justification.
- Preserve any existing routing structure unless it is clearly wrong.
- Use the monorepo's existing shared component library first. Only build new primitives if the shared library genuinely does not cover the need.
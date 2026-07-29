# News Publishing Studio

## Goal

Replace the admin news editor's legacy single-page form with a full publishing
studio consistent with the jobs and products editors. The studio must support
guided editing, Norwegian and English content, a live reader-facing preview,
and clear draft and publish actions while preserving existing news data and
authorization behavior.

## Scope

The change applies to both new and existing news articles because they share
the `/news/[id]` editor. It retains the existing news fields:

- headline and article body
- author and category
- campus and department scope
- slug
- cover image
- sticky placement
- draft or published status

It adds no new database collection, dependency, scheduling feature, SEO model,
or AI-generated content.

## Chosen Approach

Build a news-specific studio that follows the jobs editor's full-screen
structure and interaction patterns. Reuse existing admin utilities where they
fit, but do not extract a universal studio framework from the jobs and products
editors in this change.

This approach gives news the expected publishing experience without expanding
the task into a risky cross-editor refactor. A visual-only reskin is rejected
because it would not provide the approved guided workflow, bilingual editing,
or full preview.

## Experience

The editor is a full-height studio with four guided stages:

1. **Essentials** — active-language headline, slug, author, category, campus,
   and department context.
2. **Article** — rich article body for the active language.
3. **Media & Visibility** — cover image, sticky placement, and visibility
   summary.
4. **Review** — completeness checks and final draft or publish actions.

The studio includes:

- a header with a back action, article identity, discard, save draft, and
  publish controls
- a step rail with Norwegian and English locale tabs and an unsaved indicator
- back and continue navigation in a persistent footer
- a completion indicator based on the active step
- a live preview that follows the active locale and reflects the public news
  article's headline, metadata, cover image, and body
- a responsive layout that keeps the editor usable when the preview becomes
  secondary or hidden on smaller screens

The headline generates the slug when the slug is empty. Existing manually
edited slugs are preserved.

## State and Translation Model

The client keeps one shared article state and localized title/body values:

- shared: campus, department, slug, author, category, image, sticky, status
- Norwegian: title and description
- English: title and description

Existing `content_translations` rows remain the storage mechanism. Editing an
article with only one translation initializes the missing locale as empty
without changing the stored article until save.

Save and publish submit one news-studio payload. The server action validates
the shared fields and localized content, updates the news row, and upserts each
non-empty translation. An entirely empty optional locale is not created.
Existing translation rows are never deleted merely because another locale is
edited.

At least one localized headline is required. Publishing also requires the
shared required fields already enforced by the news schema. The server remains
the source of truth for authorization and publication permission checks.

## Draft and Publish Behavior

Creating a new article with **Save draft** creates a draft. Creating one with
**Publish** creates a published article after the existing publish
authorization check. This corrects the current behavior where the create
action always forces draft status even when the user selects Publish.

Updating an article preserves the selected target status. Successful creation
navigates to the persisted article editor; successful updates refresh the
current route. Failures keep the editor state intact and show the server error.
Buttons show pending states and prevent duplicate submissions.

## Compatibility

Existing public rendering already selects a locale from translation rows, so
the storage shape remains compatible. Existing single-language articles open
normally, can be saved without inventing content in the missing language, and
can gain the second translation later.

Existing campus, department, row permission, translation permission, audit log,
and cache revalidation behavior remains in place.

## Accessibility and Responsiveness

- Step controls and actions use semantic buttons.
- Inputs have visible labels or accessible names.
- Focus states remain visible.
- Disabled and pending states are exposed through native control state.
- Locale and step changes are keyboard accessible.
- The preview does not block editing on smaller screens.
- Cover images use the existing Next.js image and upload patterns.

## Error Handling

- Client validation identifies incomplete required content before submission.
- Server validation rejects malformed payloads.
- Authorization failures are returned without partial UI success.
- Save and publish errors display the server message when available.
- Pending flags reset after both success and failure.
- Unsaved client state remains available after a failed submission.

## Testing and Verification

Implementation follows test-driven development:

1. Add failing regression tests for localized default-state and payload
   construction.
2. Add failing server-action tests for creating drafts, creating published
   articles, upserting both locales, preserving single-language articles, and
   rejecting invalid content.
3. Implement the minimum client and server changes to pass those tests.
4. Run the focused tests, the admin test suite, typecheck, Ultracite checks,
   and relevant static analysis.
5. Exercise new and existing article flows in the browser at desktop and
   narrow widths, including locale switching, draft save, publish, validation
   failure, and live preview updates.

## Out of Scope

- refactoring jobs and products into shared studio primitives
- database schema changes
- publication scheduling
- SEO-specific fields
- automatic translation or AI writing
- changes to the public news page beyond compatibility fixes proven necessary
  during verification

# Content Auto-Translation Design

## Goal

Make Norwegian/English translation a consistent publishing capability across the admin app. Editors should be able to translate the active locale on demand from the final review area, or opt into a non-blocking translation after an explicit draft save or publish.

## Scope

The first release covers every bilingual content publisher currently present in the admin app:

- pages
- news articles
- events
- job vacancies
- shop products
- member benefits
- announcements

The documents feature is intentionally excluded because it publishes uploaded files rather than structured bilingual content.

## Existing Problems

- The job form stores `auto_translate`, but no save or publish action consumes it.
- Job and event translation actions only translate English to Norwegian.
- Translation controls live inside early content-entry steps rather than at the publishing boundary.
- Several schemas require both locales before saving, which makes background translation impossible when only the source locale exists.
- Each existing translator owns its own prompt and response schema.
- Page translation uses a separate route and model from the studio translation helpers.
- A synchronous translation during publish would make the author wait for an external model request.

## User Experience

### Global auto-translation control

Each publishing surface gets an `Auto-translate` switch in its global action area, adjacent to its save/publish controls. It is off by default, except that an existing job may initialize from its persisted `metadata.auto_translate` value for backward compatibility.

The active editor locale is always the source. Supporting copy states the destination explicitly, for example `Translate Norwegian to English after save`.

- Explicit **Save draft**: save the source immediately and queue translation when enabled.
- Explicit **Publish**: publish the source immediately and queue translation when enabled.
- Page-builder autosave: never queues translation, because doing so on each debounce would cause unnecessary cost and stale writes.
- Page-builder publish: queues translation and publishes the translated destination when enabled.
- Announcement send: persists the source immediately, then queues translation before delivery when enabled so recipients do not receive untranslated content.

After a queued operation, success feedback says that translation was queued rather than falsely claiming that it is already complete.

### Manual translation

Multi-step studios show a real translation card in the final review step. Single-page editors show the equivalent card near their final action area. The page builder keeps its existing locale translation entry point and shares the same translation service.

The action is bidirectional:

- active Norwegian: `Generate English`
- active English: `Generate Norwegian`

Manual translation returns a draft to the browser and fills the destination fields. It does not persist independently; the user can review and edit the result before saving or publishing. If destination content is non-empty, the existing confirmation pattern is used before replacement.

The old job translation helper is removed from Essentials. The event and announcement helpers are removed from their content-entry steps. Event social pre-fill remains in Essentials because it is a source-content aid, not a locale publishing action.

## Architecture

### Shared translation domain

Create a server-only translation module in the admin app with these concepts:

```ts
type ContentLocale = "no" | "en";

type TranslationField = {
  key: string;
  value: string;
  format: "plain" | "html";
};

type TranslateContentInput = {
  contentType: string;
  sourceLocale: ContentLocale;
  targetLocale: ContentLocale;
  fields: TranslationField[];
};

type TranslateContentResult = Record<string, string>;
```

`translateContentFields` performs one structured-output model call for all supplied fields. The prompt requires faithful Norwegian/English translation, preservation of HTML structure, URLs, placeholders, identifiers, and proper nouns, and no invented facts. Empty fields remain empty. Field keys are controlled by the caller and validated before the model request.

Use the existing `@ai-sdk/openai` and `ai` dependencies. Keep `gpt-5-nano`, which is already used by the working helpers and supports structured output. Do not add a dependency.

### Manual action adapters

Each content type has a small server action that:

1. authorizes the current user with the feature's existing permission helper;
2. validates the source fields and locale pair;
3. maps domain fields into `TranslationField[]`;
4. calls `translateContentFields`;
5. returns the translated domain-shaped draft.

This preserves feature-specific field knowledge while removing duplicated AI prompting.

### Background translation adapters

Each explicit save/publish action accepts a separate translation option:

```ts
type AutoTranslationOptions = {
  enabled: boolean;
  sourceLocale: ContentLocale;
};
```

After authorization, validation, and the primary Appwrite write succeed, the action calls stable Next.js `after()` when `enabled` is true. The callback receives only serializable identifiers, the submitted source snapshot, and the target status. It uses the existing admin Appwrite client rather than a request-session client.

The callback:

1. translates the submitted source snapshot;
2. reloads the current source content;
3. compares the translatable fields with the submitted snapshot;
4. skips persistence if the source has changed since the request;
5. upserts only the destination locale fields;
6. mirrors publish state to the destination when the initiating operation was publish;
7. logs a sanitized error if translation fails without rolling back the successful source operation.

The source comparison prevents an older background request from overwriting the translation created for a newer save.

### Runtime behavior

The admin app uses Next.js 16.3 with `output: "standalone"`. The installed Next.js documentation marks `after()` stable and supported by the Node.js server, so it is valid for the Appwrite-hosted standalone runtime. Work remains bounded by the host's request lifetime; translation therefore uses one compact model call per operation.

No user-visible success claim depends on background completion. A future durable queue can add retries without changing the editor contract.

## Content Persistence Mapping

| Feature | Source/destination storage | Background destination write |
| --- | --- | --- |
| Pages | `page_translations` | save translated document; publish destination after a publish trigger |
| News | `content_translations` | upsert headline, lead, body, SEO, caption, and alt text |
| Events | `content_translations` | upsert title, description, location details, and SEO fields |
| Jobs | `content_translations` plus vacancy metadata | upsert title, short description, and description; keep `auto_translate` compatibility |
| Shop | canonical Norwegian product fields plus English `content_translations` | update canonical fields for Norwegian or translation row for English |
| Benefits | bilingual columns on the benefit row | update only destination-language columns |
| Announcements | bilingual columns on the announcement row | update destination-language columns before queued delivery |

## Validation Rules

- Drafts require one usable locale, not both.
- Publish requires the active/source locale to satisfy the feature's publish rules.
- Auto-translation may supply a missing destination after the source operation.
- Manual translation requires at least one non-empty source field.
- Source and target locales must differ and must be `no`/`en`.
- Empty optional values remain empty rather than receiving invented content.
- Existing media, dates, identifiers, relations, and permissions are never translated.

## Failure Handling

- Manual failure: show the model/action error and leave the destination untouched.
- Background failure: retain the successful save/publish, log the content type and identifier without content bodies, and allow the user to retry from Review.
- Stale callback: silently skip its destination write and log a development-only diagnostic.
- Missing `OPENAI_API_KEY`: return a clear manual error; background work logs the configuration failure.

## Testing

### Shared translation tests

- rejects identical or unsupported locale pairs;
- omits empty values from the model prompt and restores them as empty results;
- preserves the caller's field keys in the structured result;
- maps source and target language names in both directions;
- reports missing AI configuration cleanly.

### Background scheduling tests

- does not schedule when disabled;
- schedules only after the primary write succeeds;
- captures the submitted source locale and operation status;
- skips stale source snapshots;
- updates only the destination locale;
- does not turn background failure into a failed source save/publish response.

### Studio behavior tests

- global toggle copy names the active source and destination locales;
- manual action label is `Generate English` from Norwegian and `Generate Norwegian` from English;
- former Essentials/content-step translation controls are absent;
- review translation fills the destination fields and switches the preview/editor to that locale;
- explicit draft save and publish pass the toggle state and source locale;
- page autosave never passes auto-translation, while page publish does.

### Verification

Run focused Bun tests for each changed feature, then admin type checking, Ultracite, and the admin production build. Manually inspect the affected action bars and review steps in both desktop and narrow layouts.

## Non-goals

- automatic locale detection;
- translation between languages other than Norwegian and English;
- a durable job queue, retries, or translation history;
- background translation on every page-builder autosave;
- translating uploaded document files;
- replacing editor-authored text without an explicit manual action or enabled switch.

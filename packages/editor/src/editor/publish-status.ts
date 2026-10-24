import type { EditorLocale, PageMeta, PublishOutcome } from "./types";

interface PublishCallbacks {
  onPublish?: (locale: EditorLocale) => Promise<PublishOutcome | undefined>;
  onUnpublish?: (locale: EditorLocale) => Promise<void>;
}

/**
 * Keeps the editor's own `meta.status` in step with what the host just did.
 *
 * The host updates its copy of the document after publishing, but the shell
 * deliberately never rehydrates a locale it has already loaded. Left alone,
 * the store kept `draft`, and the next autosave wrote that back to Appwrite,
 * taking the page off the site minutes after it was published.
 *
 * The same goes for a theme the publish copied to the page's department:
 * `onThemeCopied` lets the shell drop it, or the next autosave would write it
 * back and a later publish would copy it again.
 */
export function withPublishStatusSync(
  callbacks: PublishCallbacks,
  setStatus: (status: PageMeta["status"]) => void,
  onThemeCopied?: () => void
): PublishCallbacks {
  const { onPublish, onUnpublish } = callbacks;
  return {
    onPublish: onPublish
      ? async (locale) => {
          const outcome = await onPublish(locale);
          setStatus("published");
          if (outcome?.themeCopied) {
            onThemeCopied?.();
          }
          return outcome;
        }
      : undefined,
    onUnpublish: onUnpublish
      ? async (locale) => {
          await onUnpublish(locale);
          setStatus("draft");
        }
      : undefined,
  };
}

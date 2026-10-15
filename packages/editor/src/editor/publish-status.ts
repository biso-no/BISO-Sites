import type { EditorLocale, PageMeta } from "./types";

type PublishCallback = (locale: EditorLocale) => Promise<void>;

interface PublishCallbacks {
  onPublish?: PublishCallback;
  onUnpublish?: PublishCallback;
}

/**
 * Keeps the editor's own `meta.status` in step with what the host just did.
 *
 * The host updates its copy of the document after publishing, but the shell
 * deliberately never rehydrates a locale it has already loaded. Left alone,
 * the store kept `draft`, and the next autosave wrote that back to Appwrite,
 * taking the page off the site minutes after it was published.
 */
export function withPublishStatusSync(
  callbacks: PublishCallbacks,
  setStatus: (status: PageMeta["status"]) => void
): PublishCallbacks {
  const { onPublish, onUnpublish } = callbacks;
  return {
    onPublish: onPublish
      ? async (locale) => {
          await onPublish(locale);
          setStatus("published");
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

import type { NewsFormValues } from "../../../_actions/schemas";
import { DescriptionBlockEditor } from "../../../_components/description-block-editor";
import {
  getNewsArticleEditorState,
  type NewsLocale,
} from "./news-studio-state";

interface NewsArticleStepProps {
  locale: NewsLocale;
  setValue: <Key extends keyof NewsFormValues>(
    key: Key,
    value: NewsFormValues[Key]
  ) => void;
  values: NewsFormValues;
}

export function NewsArticleStep({
  locale,
  setValue,
  values,
}: NewsArticleStepProps) {
  const descriptionKey = locale === "no" ? "description_no" : "description_en";
  const languageLabel = locale === "no" ? "Norwegian" : "English";
  const editorState = getNewsArticleEditorState(values, locale);

  return (
    <div className="space-y-4">
      <div>
        <p className="font-medium text-[#3DA9E0] text-[11px] uppercase tracking-[0.14em]">
          {languageLabel} article
        </p>
        <h2 className="mt-2 font-light text-3xl tracking-tight">
          Tell the complete story
        </h2>
        <p className="mt-2 text-slate-600 text-sm">
          Editing {locale.toUpperCase()}. Switch languages in the step rail to
          work on the other version.
        </p>
      </div>
      <fieldset className="m-0 min-w-0 border-0 p-0">
        <legend className="block font-medium text-[11px] text-slate-500 uppercase tracking-[0.12em]">
          Article body · {languageLabel}
        </legend>
        <div>
          <DescriptionBlockEditor
            key={editorState.editorKey}
            onChange={(value) => setValue(descriptionKey, value)}
            placeholder={`Write the ${languageLabel.toLowerCase()} article here...`}
            value={editorState.value}
          />
        </div>
      </fieldset>
    </div>
  );
}

import type { UseFormSetValue } from "react-hook-form";
import { translateJobContent } from "@/app/actions/jobs";
import type { FormValues } from "./schema";

interface HandleTranslateParams {
  fromLocale: "en" | "no";
  jobId?: string;
  setActiveLocale: (tab: "en" | "no") => void;
  setIsTranslating: (value: boolean) => void;
  setValue: UseFormSetValue<FormValues>;
  showToast: (props: {
    title: string;
    description?: string;
    variant?: "default" | "destructive";
  }) => void;
  t: (key: string) => string;
  toLocale: "en" | "no";
}

export async function handleTranslate({
  jobId,
  fromLocale,
  toLocale,
  t,
  setIsTranslating,
  setValue,
  setActiveLocale,
  showToast,
}: HandleTranslateParams) {
  if (!jobId) {
    showToast({
      title: t("messages.saveFirst"),
      description: t("messages.saveBeforeTranslate"),
      variant: "destructive",
    });
    return;
  }

  setIsTranslating(true);

  try {
    const translation = await translateJobContent(jobId, fromLocale, toLocale);

    if (translation) {
      setValue(`translations.${toLocale}.title`, translation.title);
      setValue(`translations.${toLocale}.description`, translation.description);

      showToast({
        title: t("messages.translationCompleted"),
        description: t("messages.translationDescription", {
          language:
            toLocale === "en" ? t("editor.english") : t("editor.norwegian"),
        }),
      });

      setActiveLocale(toLocale);
    } else {
      throw new Error("Translation failed");
    }
  } catch (error) {
    console.error("Translation error:", error);
    showToast({
      title: t("messages.translationFailed"),
      description: t("messages.translationError"),
      variant: "destructive",
    });
  } finally {
    setIsTranslating(false);
  }
}

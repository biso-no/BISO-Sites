import type { UseFormSetValue } from "react-hook-form";
import { translateJobContent } from "@/app/actions/jobs";
import type { FormValues } from "./schema";

type HandleTranslateParams = {
  jobId?: string;
  fromLocale: "en" | "no";
  toLocale: "en" | "no";
  t: (key: string) => string;
  setIsTranslating: (value: boolean) => void;
  setValue: UseFormSetValue<FormValues>;
  setActiveTab: (tab: "en" | "no") => void;
  showToast: (props: any) => void;
};

export async function handleTranslate({
  jobId,
  fromLocale,
  toLocale,
  t,
  setIsTranslating,
  setValue,
  setActiveTab,
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
      setValue(`${toLocale}_title`, translation.title);
      setValue(`${toLocale}_description`, translation.description);

      showToast({
        title: t("messages.translationCompleted"),
        description: t("messages.translationDescription", {
          language:
            toLocale === "en" ? t("editor.english") : t("editor.norwegian"),
        }),
      });

      setActiveTab(toLocale);
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

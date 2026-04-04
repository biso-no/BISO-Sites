"use client";

import { Button } from "@repo/ui/components/ui/button";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@repo/ui/components/ui/form";
import { Input } from "@repo/ui/components/ui/input";
import { Wand2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useFormContext } from "react-hook-form";
import { CharacterCount } from "@/components/forms/CharacterCount";
import { LocaleTabGroup } from "@/components/forms/LocaleTabGroup";
import { RichTextEditor } from "@/components/rich-text-editor";
import type { FormValues } from "./schema";

interface JobTranslationsProps {
  activeLocale: "en" | "no";
  isTranslating: boolean;
  jobId?: string;
  onTranslate: (from: "en" | "no", to: "en" | "no") => void;
  setActiveLocale: (locale: "en" | "no") => void;
}

export function JobTranslations({
  jobId,
  isTranslating,
  activeLocale,
  setActiveLocale,
  onTranslate,
}: JobTranslationsProps) {
  const t = useTranslations("adminJobs");
  const form = useFormContext<FormValues>();

  const enTitle = form.watch("translations.en.title");
  const noTitle = form.watch("translations.no.title");
  const enDesc = form.watch("translations.en.description");
  const noDesc = form.watch("translations.no.description");

  const getLocaleStatus = (title: string, desc: string) => {
    if (title?.length >= 5 && desc?.length >= 20) {
      return "complete" as const;
    }
    if (title || desc) {
      return "partial" as const;
    }
    return "empty" as const;
  };

  const oppositeLocale = activeLocale === "en" ? "no" : "en";
  const hasSourceContent =
    activeLocale === "en" ? Boolean(enTitle) : Boolean(noTitle);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <LocaleTabGroup
          activeLocale={activeLocale}
          onChange={setActiveLocale}
          status={{
            en: getLocaleStatus(enTitle ?? "", enDesc ?? ""),
            no: getLocaleStatus(noTitle ?? "", noDesc ?? ""),
          }}
        />

        {jobId && (
          <Button
            className="gap-2"
            disabled={isTranslating || !hasSourceContent}
            onClick={() => onTranslate(activeLocale, oppositeLocale)}
            size="sm"
            type="button"
            variant="outline"
          >
            <Wand2 className="h-3.5 w-3.5" />
            {isTranslating
              ? t("editor.translating")
              : `Translate to ${oppositeLocale === "en" ? "English" : "Norwegian"}`}
          </Button>
        )}
      </div>

      {(["en", "no"] as const).map((locale) => (
        <div
          className={locale === activeLocale ? "space-y-4" : "hidden"}
          key={locale}
          role="tabpanel"
        >
          <FormField
            control={form.control}
            name={`translations.${locale}.title`}
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel aria-required="true">{t("form.title")}</FormLabel>
                  <CharacterCount
                    current={field.value?.length ?? 0}
                    max={100}
                  />
                </div>
                <FormControl>
                  <Input
                    aria-required="true"
                    placeholder={
                      locale === "en"
                        ? "Job title in English"
                        : "Stillingstittel på norsk"
                    }
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name={`translations.${locale}.description`}
            render={({ field }) => (
              <FormItem>
                <FormLabel aria-required="true">
                  {t("form.description")}
                </FormLabel>
                <FormControl>
                  <RichTextEditor
                    content={field.value ?? ""}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      ))}
    </div>
  );
}

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
import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useFormContext } from "react-hook-form";
import { translateEventContent } from "@/app/actions/events";
import { CharacterCount } from "@/components/forms/character-count";
import {
  type Locale,
  LocaleTabGroup,
} from "@/components/forms/locale-tab-group";
import { RichTextEditor } from "@/components/rich-text-editor";
import { toast } from "@/lib/hooks/use-toast";
import type { FormValues } from "./schema";

const TITLE_MAX = 100;

export function EventTranslations() {
  const t = useTranslations("adminEvents");
  const form = useFormContext<FormValues>();
  const [activeLocale, setActiveLocale] = useState<Locale>("en");
  const [isTranslating, setIsTranslating] = useState<Locale | null>(null);

  const enTitle = form.watch("translations.en.title") ?? "";
  const noTitle = form.watch("translations.no.title") ?? "";

  const getLocaleStatus = (title: string): "complete" | "partial" | "empty" => {
    if (title.length >= 5) {
      return "complete";
    }
    if (title.length > 0) {
      return "partial";
    }
    return "empty";
  };

  const localeStatus: Record<Locale, "complete" | "partial" | "empty"> = {
    en: getLocaleStatus(enTitle),
    no: getLocaleStatus(noTitle),
  };

  const handleTranslate = async (from: Locale, to: Locale) => {
    const fromVal = form.getValues(`translations.${from}`);
    if (!(fromVal?.title && fromVal?.description)) {
      toast({
        title: t("editor.messages.fillContent", {
          language: from === "en" ? t("editor.english") : t("editor.norwegian"),
        }),
        variant: "destructive",
      });
      return;
    }
    setIsTranslating(to);
    try {
      const translated = await translateEventContent(fromVal, from, to);
      if (translated) {
        form.setValue(`translations.${to}`, translated);
        setActiveLocale(to);
        toast({ title: t("messages.translationCompleted") });
      } else {
        toast({
          title: t("messages.translationError"),
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: t("messages.translationError"), variant: "destructive" });
    } finally {
      setIsTranslating(null);
    }
  };

  const oppositeLocale: Locale = activeLocale === "en" ? "no" : "en";
  const translateLabel =
    activeLocale === "en"
      ? t("editor.translateFromNorwegian")
      : t("editor.translateFromEnglish");

  return (
    <div className="space-y-4">
      {/* Locale switcher */}
      <div className="flex items-center justify-between">
        <LocaleTabGroup
          activeLocale={activeLocale}
          onChange={setActiveLocale}
          status={localeStatus}
        />
        <Button
          className="gap-1.5"
          disabled={isTranslating !== null}
          onClick={() => handleTranslate(oppositeLocale, activeLocale)}
          size="sm"
          type="button"
          variant="outline"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {isTranslating === activeLocale
            ? t("editor.translating")
            : translateLabel}
        </Button>
      </div>

      {/* Title */}
      <FormField
        control={form.control}
        name={`translations.${activeLocale}.title`}
        render={({ field }) => (
          <FormItem>
            <div className="flex items-center justify-between">
              <FormLabel>
                {t("form.title")}{" "}
                <span aria-hidden className="ml-1 text-destructive">
                  *
                </span>
              </FormLabel>
              <CharacterCount
                current={field.value?.length ?? 0}
                max={TITLE_MAX}
              />
            </div>
            <FormControl>
              <Input
                placeholder={
                  activeLocale === "en"
                    ? t("editor.placeholders.englishTitle")
                    : t("editor.placeholders.norwegianTitle")
                }
                {...field}
                aria-describedby={`translations.${activeLocale}.title-error`}
                aria-required="true"
                value={field.value ?? ""}
              />
            </FormControl>
            <FormMessage id={`translations.${activeLocale}.title-error`} />
          </FormItem>
        )}
      />

      {/* Description */}
      <FormField
        control={form.control}
        name={`translations.${activeLocale}.description`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              {t("form.description")}{" "}
              <span aria-hidden className="ml-1 text-destructive">
                *
              </span>
            </FormLabel>
            <FormControl>
              <RichTextEditor
                content={field.value ?? ""}
                editable
                onChange={field.onChange}
              />
            </FormControl>
            <FormMessage
              id={`translations.${activeLocale}.description-error`}
            />
          </FormItem>
        )}
      />
    </div>
  );
}

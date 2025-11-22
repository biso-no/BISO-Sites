"use client";

import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@repo/ui/components/ui/form";
import { Input } from "@repo/ui/components/ui/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/ui/components/ui/tabs";
import { Languages, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useFormContext } from "react-hook-form";
import { translateEventContent } from "@/app/actions/events";
import { RichTextEditor } from "@/components/rich-text-editor";
import { toast } from "@/lib/hooks/use-toast";
import type { FormValues } from "./schema";

export function EventTranslations() {
  const t = useTranslations("adminEvents");
  const form = useFormContext<FormValues>();
  const [isTranslating, setIsTranslating] = useState<"en" | "no" | null>(null);

  const handleTranslate = async (
    fromLocale: "en" | "no",
    toLocale: "en" | "no"
  ) => {
    const fromTranslation = form.getValues(`translations.${fromLocale}`);
    if (!(fromTranslation?.title && fromTranslation?.description)) {
      toast({
        title: t("editor.messages.fillContent", {
          language:
            fromLocale === "en" ? t("editor.english") : t("editor.norwegian"),
        }),
        variant: "destructive",
      });
      return;
    }

    setIsTranslating(toLocale);

    try {
      const translated = await translateEventContent(
        fromTranslation,
        fromLocale,
        toLocale
      );
      if (translated) {
        form.setValue(`translations.${toLocale}`, translated);
        toast({
          title: t("messages.translationCompleted"),
          description: t("messages.translationDescription", {
            language:
              toLocale === "en" ? t("editor.english") : t("editor.norwegian"),
          }),
        });
      } else {
        toast({
          title: t("messages.translationError"),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Translation error:", error);
      toast({ title: t("messages.translationError"), variant: "destructive" });
    } finally {
      setIsTranslating(null);
    }
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Languages className="h-5 w-5" />
          {t("editor.eventContentTitle")}
        </CardTitle>
        <CardDescription>{t("editor.eventContentDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs className="w-full" defaultValue="en">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger className="flex items-center gap-2" value="en">
              🇬🇧 {t("editor.english")}
            </TabsTrigger>
            <TabsTrigger className="flex items-center gap-2" value="no">
              🇳🇴 {t("editor.norwegian")}
            </TabsTrigger>
          </TabsList>

          <TabsContent className="mt-4 space-y-4" value="en">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-lg">
                {t("editor.englishSectionTitle")}
              </h3>
              <Button
                className="flex items-center gap-2"
                disabled={isTranslating === "en"}
                onClick={() => handleTranslate("no", "en")}
                size="sm"
                type="button"
                variant="outline"
              >
                <Sparkles className="h-4 w-4" />
                {isTranslating === "en"
                  ? t("editor.translating")
                  : t("editor.translateFromNorwegian")}
              </Button>
            </div>
            <FormField
              control={form.control}
              name="translations.en.title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("form.title")}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("editor.placeholders.englishTitle")}
                      {...field}
                      className="glass-input"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="translations.en.description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("form.description")}</FormLabel>
                  <FormControl>
                    <RichTextEditor
                      content={field.value || ""}
                      editable={true}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </TabsContent>

          <TabsContent className="mt-4 space-y-4" value="no">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-lg">
                {t("editor.norwegianSectionTitle")}
              </h3>
              <Button
                className="flex items-center gap-2"
                disabled={isTranslating === "no"}
                onClick={() => handleTranslate("en", "no")}
                size="sm"
                type="button"
                variant="outline"
              >
                <Sparkles className="h-4 w-4" />
                {isTranslating === "no"
                  ? t("editor.translating")
                  : t("editor.translateFromEnglish")}
              </Button>
            </div>
            <FormField
              control={form.control}
              name="translations.no.title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("form.title")}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("editor.placeholders.norwegianTitle")}
                      {...field}
                      className="glass-input"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="translations.no.description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("form.description")}</FormLabel>
                  <FormControl>
                    <RichTextEditor
                      content={field.value || ""}
                      editable={true}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

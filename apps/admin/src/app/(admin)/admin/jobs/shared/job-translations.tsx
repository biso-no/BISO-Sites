"use client";

import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
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
import { Wand2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useFormContext } from "react-hook-form";
import type { FormValues } from "./schema";

const JoditEditor = dynamic(() => import("jodit-react"), { ssr: false });

type JobTranslationsProps = {
  jobId?: string;
  isTranslating: boolean;
  activeTab: "en" | "no";
  setActiveTab: (tab: "en" | "no") => void;
  onTranslate: (from: "en" | "no", to: "en" | "no") => void;
};

export function JobTranslations({
  jobId,
  isTranslating,
  activeTab,
  setActiveTab,
  onTranslate,
}: JobTranslationsProps) {
  const t = useTranslations("adminJobs");
  const form = useFormContext<FormValues>();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-lg">
          {t("editor.contentTranslations")}
        </h3>
        {jobId && (
          <div className="flex gap-2">
            <Button
              disabled={isTranslating || !form.watch("en_title")}
              onClick={() => onTranslate("en", "no")}
              size="sm"
              type="button"
              variant="outline"
            >
              <Wand2 className="mr-2 h-4 w-4" />
              {t("editor.translateEnToNo")}
            </Button>
            <Button
              disabled={isTranslating || !form.watch("no_title")}
              onClick={() => onTranslate("no", "en")}
              size="sm"
              type="button"
              variant="outline"
            >
              <Wand2 className="mr-2 h-4 w-4" />
              {t("editor.translateNoToEn")}
            </Button>
          </div>
        )}
      </div>

      <Tabs
        onValueChange={(value) => setActiveTab(value as "en" | "no")}
        value={activeTab}
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger className="flex items-center gap-2" value="en">
            🇬🇧 {t("editor.english")}
            {form.watch("en_title") && (
              <Badge className="text-xs" variant="secondary">
                ✓
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger className="flex items-center gap-2" value="no">
            🇳🇴 {t("editor.norwegian")}
            {form.watch("no_title") && (
              <Badge className="text-xs" variant="secondary">
                ✓
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent className="space-y-4" value="en">
          <FormField
            control={form.control}
            name="en_title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t("form.title")} ({t("editor.english")})
                </FormLabel>
                <FormControl>
                  <Input placeholder="Job title in English" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="en_description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t("form.description")} ({t("editor.english")})
                </FormLabel>
                <FormControl>
                  <JoditEditor
                    config={{ height: 400 }}
                    onBlur={field.onBlur}
                    onChange={(val: string) => field.onChange(val)}
                    value={field.value || ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </TabsContent>

        <TabsContent className="space-y-4" value="no">
          <FormField
            control={form.control}
            name="no_title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t("form.title")} ({t("editor.norwegian")})
                </FormLabel>
                <FormControl>
                  <Input placeholder="Stillingstittel på norsk" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="no_description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t("form.description")} ({t("editor.norwegian")})
                </FormLabel>
                <FormControl>
                  <JoditEditor
                    config={{ height: 400 }}
                    onBlur={field.onBlur}
                    onChange={(val: string) => field.onChange(val)}
                    value={field.value || ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

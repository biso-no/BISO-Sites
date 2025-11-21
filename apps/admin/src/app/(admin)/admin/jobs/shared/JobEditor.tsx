"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@repo/ui/components/ui/form";
import { Input } from "@repo/ui/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/ui/components/ui/tabs";
import { Languages, Wand2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { createJob, translateJobContent, updateJob } from "@/app/actions/jobs";
import { toast } from "@/lib/hooks/use-toast";
import type { AdminJob } from "@/lib/types/job";

const JoditEditor = dynamic(() => import("jodit-react"), { ssr: false });

const formSchema = z.object({
  slug: z.string().min(1),
  status: z.enum(["draft", "published", "closed"]).default("draft"),
  campus_id: z.string().min(1),
  department_id: z.string().optional(),
  type: z.string().optional(),
  application_deadline: z.string().optional(),
  start_date: z.string().optional(),
  contact_name: z.string().optional(),
  contact_email: z.string().email().optional(),
  apply_url: z.string().url().optional(),
  image: z.string().optional(),
  // Translations
  en_title: z.string().optional(),
  en_description: z.string().optional(),
  no_title: z.string().optional(),
  no_description: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function JobEditor({
  job,
  campuses,
  departments,
}: {
  job?: AdminJob | null;
  campuses?: { $id: string; name: string }[];
  departments?: { $id: string; Name: string; campus_id?: string }[];
}) {
  const router = useRouter();
  const [selectedCampus, setSelectedCampus] = React.useState<string>(
    job?.campus_id || ""
  );
  const [isTranslating, setIsTranslating] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<"en" | "no">("en");
  const t = useTranslations("adminJobs");

  const filteredDepartments = React.useMemo(() => {
    if (!departments) {
      return [];
    }
    if (!selectedCampus) {
      return departments;
    }
    return departments.filter((d) => d.campus_id === selectedCampus);
  }, [departments, selectedCampus]);

  // Extract translations from job data using Appwrite's nested relationships
  const getTranslation = (locale: "en" | "no") => job?.translations?.[locale];

  const metadata = job?.metadata_parsed ?? {};

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      slug: job?.slug || "",
      status: job?.status || "draft",
      campus_id: job?.campus_id || "",
      department_id: job?.department_id || "",
      type: metadata.type || "",
      application_deadline: metadata.application_deadline || "",
      start_date: metadata.start_date || "",
      contact_name: metadata.contact_name || "",
      contact_email: metadata.contact_email || "",
      apply_url: metadata.apply_url || "",
      image: metadata.image || "",
      en_title: getTranslation("en")?.title || "",
      en_description: getTranslation("en")?.description || "",
      no_title: getTranslation("no")?.title || "",
      no_description: getTranslation("no")?.description || "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      const jobData = {
        slug: values.slug,
        status: values.status,
        campus_id: values.campus_id,
        department_id: values.department_id,
        metadata: {
          type: values.type,
          application_deadline: values.application_deadline,
          start_date: values.start_date,
          contact_name: values.contact_name,
          contact_email: values.contact_email,
          apply_url: values.apply_url,
          image: values.image,
        },
        translations: {
          ...(values.en_title &&
            values.en_description && {
              en: {
                title: values.en_title,
                description: values.en_description,
              },
            }),
          ...(values.no_title &&
            values.no_description && {
              no: {
                title: values.no_title,
                description: values.no_description,
              },
            }),
        },
      };

      if (job?.$id) {
        await updateJob(job.$id, jobData);
        toast({ title: t("messages.jobUpdated") });
      } else {
        await createJob(jobData);
        toast({ title: t("messages.jobCreated") });
        router.push("/admin/jobs");
      }
    } catch (e) {
      console.error(e);
      toast({ title: t("messages.saveFailed"), variant: "destructive" });
    }
  };

  const handleTranslate = async (
    fromLocale: "en" | "no",
    toLocale: "en" | "no"
  ) => {
    if (!job?.$id) {
      toast({
        title: t("messages.saveFirst"),
        description: t("messages.saveBeforeTranslate"),
        variant: "destructive",
      });
      return;
    }

    setIsTranslating(true);

    try {
      const translation = await translateJobContent(
        job.$id,
        fromLocale,
        toLocale
      );

      if (translation) {
        // Update form with translated content
        form.setValue(`${toLocale}_title`, translation.title);
        form.setValue(`${toLocale}_description`, translation.description);

        toast({
          title: t("messages.translationCompleted"),
          description: t("messages.translationDescription", {
            language:
              toLocale === "en" ? t("editor.english") : t("editor.norwegian"),
          }),
        });

        // Switch to the translated tab
        setActiveTab(toLocale);
      } else {
        throw new Error("Translation failed");
      }
    } catch (error) {
      console.error("Translation error:", error);
      toast({
        title: t("messages.translationFailed"),
        description: t("messages.translationError"),
        variant: "destructive",
      });
    } finally {
      setIsTranslating(false);
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <div className="md:col-span-2">
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle>{t("editor.jobDetailsTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                className="space-y-6"
                onSubmit={form.handleSubmit(onSubmit)}
              >
                {/* Basic Information */}
                <div className="space-y-4">
                  <h3 className="font-medium text-lg">
                    {t("editor.basicInformation")}
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="slug"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("form.slug")}</FormLabel>
                          <FormControl>
                            <Input
                              placeholder={t("editor.labels.slugPlaceholder")}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("form.status")}</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue
                                  placeholder={t("editor.labels.selectStatus")}
                                />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="draft">
                                {t("status.draft")}
                              </SelectItem>
                              <SelectItem value="published">
                                {t("status.published")}
                              </SelectItem>
                              <SelectItem value="closed">
                                {t("status.closed")}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="campus_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("form.campus")}</FormLabel>
                          <Select
                            onValueChange={(v) => {
                              field.onChange(v);
                              setSelectedCampus(v);
                            }}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue
                                  placeholder={t("editor.labels.selectCampus")}
                                />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {campuses?.map((c) => (
                                <SelectItem key={c.$id} value={c.$id}>
                                  {c.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="department_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("form.department")}</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue
                                  placeholder={t(
                                    "editor.labels.selectDepartment"
                                  )}
                                />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {filteredDepartments.map((d) => (
                                <SelectItem key={d.$id} value={d.$id}>
                                  {d.Name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Metadata Fields */}
                <div className="space-y-4">
                  <h3 className="font-medium text-lg">
                    {t("editor.metadataTitle")}
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("form.type")}</FormLabel>
                          <FormControl>
                            <Input
                              placeholder={t(
                                "editor.labels.jobTypePlaceholder"
                              )}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="application_deadline"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("form.deadline")}</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="contact_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("form.contactPerson")}</FormLabel>
                          <FormControl>
                            <Input
                              placeholder={t(
                                "editor.labels.contactNamePlaceholder"
                              )}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="contact_email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("form.contactEmail")}</FormLabel>
                          <FormControl>
                            <Input
                              placeholder={t(
                                "editor.labels.contactEmailPlaceholder"
                              )}
                              type="email"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Translation Tabs */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-lg">
                      {t("editor.contentTranslations")}
                    </h3>
                    {job?.$id && (
                      <div className="flex gap-2">
                        <Button
                          disabled={isTranslating || !form.watch("en_title")}
                          onClick={() => handleTranslate("en", "no")}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          <Wand2 className="mr-2 h-4 w-4" />
                          {t("editor.translateEnToNo")}
                        </Button>
                        <Button
                          disabled={isTranslating || !form.watch("no_title")}
                          onClick={() => handleTranslate("no", "en")}
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
                    onValueChange={(value) =>
                      setActiveTab(value as "en" | "no")
                    }
                    value={activeTab}
                  >
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger
                        className="flex items-center gap-2"
                        value="en"
                      >
                        🇬🇧 {t("editor.english")}
                        {form.watch("en_title") && (
                          <Badge className="text-xs" variant="secondary">
                            ✓
                          </Badge>
                        )}
                      </TabsTrigger>
                      <TabsTrigger
                        className="flex items-center gap-2"
                        value="no"
                      >
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
                              <Input
                                placeholder="Job title in English"
                                {...field}
                              />
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
                              <Input
                                placeholder="Stillingstittel på norsk"
                                {...field}
                              />
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

                <div className="flex justify-end gap-3">
                  <Button
                    onClick={() => router.back()}
                    type="button"
                    variant="outline"
                  >
                    {t("form.cancel")}
                  </Button>
                  <Button disabled={isTranslating} type="submit">
                    {job?.$id ? t("editor.updateJob") : t("editor.createJob")}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>

      {/* Preview Panel */}
      <div className="space-y-4">
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Languages className="h-4 w-4" />
              {t("editor.translationStatusTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">{t("editor.english")}</span>
              {form.watch("en_title") ? (
                <Badge
                  className="bg-green-100 text-green-800"
                  variant="default"
                >
                  {t("editor.complete")}
                </Badge>
              ) : (
                <Badge variant="secondary">{t("editor.missing")}</Badge>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">{t("editor.norwegian")}</span>
              {form.watch("no_title") ? (
                <Badge
                  className="bg-green-100 text-green-800"
                  variant="default"
                >
                  {t("editor.complete")}
                </Badge>
              ) : (
                <Badge variant="secondary">{t("editor.missing")}</Badge>
              )}
            </div>

            {job?.$id && (
              <div className="border-t pt-3">
                <p className="text-muted-foreground text-xs">
                  {t("editor.saveBeforeTranslate")}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Preview */}
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle>{t("editor.previewTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <h4 className="font-medium">
                {activeTab === "en"
                  ? form.watch("en_title")
                  : form.watch("no_title") || t("editor.noTitle")}
              </h4>
              <p className="text-muted-foreground text-sm">
                {form.watch("campus_id") &&
                  campuses?.find((c) => c.$id === form.watch("campus_id"))
                    ?.name}
                {form.watch("type") && ` • ${form.watch("type")}`}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

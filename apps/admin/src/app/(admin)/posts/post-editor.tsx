"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Campus, Departments, News } from "@repo/api/types/appwrite";
import { Button } from "@repo/ui/components/ui/button";
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
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarProvider,
} from "@repo/ui/components/ui/sidebar";
import { Loader2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { createPost, updatePost } from "@/app/actions/admin";
import { toast } from "@/lib/hooks/use-toast";

const JoditEditor = dynamic(() => import("jodit-react"), { ssr: false });

const baseFormSchema = z.object({
  title: z.string(),
  content: z.string(),
  status: z.enum(["published", "draft"]),
  department: z.string(),
  campus: z.string(),
});

type FormValues = z.infer<typeof baseFormSchema>;

type PostEditorProps = {
  post?: News | null;
  departments: Departments[];
  campuses: Campus[];
};

export default function PostEditor({
  post,
  departments,
  campuses,
}: PostEditorProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const t = useTranslations("adminPosts");
  const locale = useLocale();

  const formSchema = useMemo(
    () =>
      baseFormSchema.extend({
        title: z.string().min(1, t("formValidation.titleRequired")),
        content: z.string().min(1, t("formValidation.contentRequired")),
        status: z.enum(["published", "draft"]),
        department: z.string().min(1, t("formValidation.departmentRequired")),
        campus: z.string().min(1, t("formValidation.campusRequired")),
      }),
    [t]
  );

  const getInitialValues = useMemo((): FormValues => {
    if (!post) {
      return {
        title: "",
        content: "",
        status: "draft" as const,
        department: "",
        campus: "",
      };
    }

    const translation =
      post.translation_refs?.find((ref) => ref.locale === locale) ||
      post.translation_refs?.[0];

    const departmentId =
      typeof post.department === "string"
        ? post.department
        : post.department?.$id;
    const campusId =
      typeof post.campus === "string" ? post.campus : post.campus?.$id;

    return {
      title: translation?.title || "",
      content: translation?.description || "",
      status: (post.status as "published" | "draft") || "draft",
      department: departmentId || "",
      campus: campusId || "",
    };
  }, [post, locale]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: getInitialValues,
  });

  const handleSubmit = useCallback(
    async (values: FormValues) => {
      setIsSubmitting(true);
      try {
        const postData = {
          title: values.title, // These will be handled into translation_refs by the action or ignored if action needs update
          content: values.content,
          status: values.status,
          department: values.department,
          campus: values.campus,
          // We attach existing translation refs so the action knows what to update if it blindly maps
          translation_refs: post?.translation_refs || [],
        };

        if (post?.$id) {
          // The action signature expects 'News', but we are passing a constructed object.
          // We cast to any to bypass strict type check on the action call for now,
          // assuming the action handles the partial data correctly or we need to fix the action type later.
          // However, we should try to match News structure as much as possible.
          await updatePost(post.$id, postData as unknown as News);
        } else {
          await createPost(postData as unknown as News);
        }
        toast({
          title: t("messages.successTitle"),
          description: post
            ? t("messages.updateSuccess")
            : t("messages.createSuccess"),
        });
        router.push("/posts");
      } catch (error) {
        console.error(error);
        toast({
          title: t("messages.errorTitle"),
          description: t("messages.saveError"),
          variant: "destructive",
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [post, router, t]
  );

  const editorConfig = useMemo(() => ({ height: 500 }), []);

  return (
    <SidebarProvider side="right">
      <div className="flex h-screen overflow-hidden">
        <Form {...form}>
          <form
            className="flex flex-1"
            onSubmit={form.handleSubmit(handleSubmit)}
          >
            <div className="flex-1 space-y-8 overflow-auto p-8">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("form.title")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("form.titlePlaceholder")}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Controller
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("form.content")}</FormLabel>
                    <FormControl>
                      <JoditEditor
                        config={editorConfig}
                        onBlur={field.onBlur}
                        onChange={(newContent: string) =>
                          field.onChange(newContent)
                        }
                        value={field.value}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <Sidebar className="w-80 border-l">
              <SidebarHeader className="px-4 py-2">
                <h2 className="font-semibold text-lg">
                  {t("form.settingsTitle")}
                </h2>
              </SidebarHeader>
              <SidebarContent>
                <div className="space-y-4 px-4">
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
                              <SelectValue placeholder={t("form.selectStatus")}>
                                {field.value === "published"
                                  ? t("status.published")
                                  : t("status.draft")}
                              </SelectValue>
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="published">
                              {t("status.published")}
                            </SelectItem>
                            <SelectItem value="draft">
                              {t("status.draft")}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="department"
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
                                placeholder={t("form.selectDepartment")}
                              >
                                {departments.find(
                                  (dep) => dep.$id === field.value
                                )?.Name || t("form.selectDepartment")}
                              </SelectValue>
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {departments.map((dep) => (
                              <SelectItem key={dep.$id} value={dep.$id}>
                                {dep.Name}
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
                    name="campus"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("form.campus")}</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t("form.selectCampus")}>
                                {campuses.find((c) => c.$id === field.value)
                                  ?.name || t("form.selectCampus")}
                              </SelectValue>
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {campuses.map((campus) => (
                              <SelectItem key={campus.$id} value={campus.$id}>
                                {campus.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    className="w-full"
                    disabled={isSubmitting}
                    type="submit"
                  >
                    {isSubmitting && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {t("form.save")}
                  </Button>
                </div>
              </SidebarContent>
            </Sidebar>
          </form>
        </Form>
      </div>
    </SidebarProvider>
  );
}

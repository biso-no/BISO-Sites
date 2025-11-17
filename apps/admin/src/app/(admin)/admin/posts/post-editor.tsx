"use client"
import * as React from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import { z } from "zod"
import { Loader2 } from "lucide-react"
import dynamic from "next/dynamic"
import { useTranslations } from "next-intl"

import { Button } from "@repo/ui/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@repo/ui/components/ui/form"
import { Input } from "@repo/ui/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarProvider,
} from "@repo/ui/components/ui/sidebar"
import { toast } from "@/lib/hooks/use-toast"
import { createPost, updatePost } from "@/app/actions/admin"
import { Campus, Department } from "@/lib/types/post"

const JoditEditor = dynamic(() => import("jodit-react"), { ssr: false })

const baseFormSchema = z.object({
  title: z.string(),
  content: z.string(),
  status: z.enum(["publish", "draft"]),
  department: z.string(),
  campus: z.string(),
})

type FormValues = z.infer<typeof baseFormSchema>

type Post = {
  $id?: string
  title: string
  content: string
  status: "publish" | "draft"
  department: Department
  campus: Campus
}

type PostEditorProps = {
  post?: Post
  departments: Department[]
  campuses: Campus[]
}

export default function PostEditor({ post, departments, campuses }: PostEditorProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const t = useTranslations("adminPosts")

  const formSchema = React.useMemo(
    () =>
      baseFormSchema.extend({
        title: z.string().min(1, t("formValidation.titleRequired")),
        content: z.string().min(1, t("formValidation.contentRequired")),
        status: z.enum(["publish", "draft"]),
        department: z.string().min(1, t("formValidation.departmentRequired")),
        campus: z.string().min(1, t("formValidation.campusRequired")),
      }),
    [t]
  )

  const getInitialValues = React.useMemo((): FormValues => {
    if (!post) {
      return {
        title: "",
        content: "",
        status: "draft" as const,
        department: "",
        campus: "",
      }
    }

    return {
      title: post.title || "",
      content: post.content || "",
      status: post.status as "publish" | "draft",
      department: post.department?.$id || "",
      campus: post.campus?.$id || "",
    }
  }, [post])

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: getInitialValues,
  })

  const handleSubmit = React.useCallback(async (values: FormValues) => {
    setIsSubmitting(true)
    try {
      if (post && post.$id) {
        await updatePost(post.$id, {
          title: values.title,
          content: values.content,
          status: values.status,
          // The underlying action expects richer types; we pass identifiers here.
          department: values.department as unknown as any,
          campus: values.campus as unknown as any,
        } as any)
      } else {
        await createPost({
          title: values.title,
          content: values.content,
          status: values.status,
          department: values.department as unknown as any,
          campus: values.campus as unknown as any,
        } as any)
      }
      toast({
        title: t("messages.successTitle"),
        description: post
          ? t("messages.updateSuccess")
          : t("messages.createSuccess"),
      })
      router.push("/admin/posts")
    } catch (error) {
      console.error(error)
      toast({
        title: t("messages.errorTitle"),
        description: t("messages.saveError"),
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }, [post, router])

  const editorConfig = React.useMemo(() => ({ height: 500 }), [])

  return (
    <SidebarProvider side="right">
      <div className="flex h-screen overflow-hidden">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-1">
            <div className="flex-1 overflow-auto p-8 space-y-8">
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
                  name="content"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("form.content")}</FormLabel>
                      <FormControl>
                        <JoditEditor
                          value={field.value}
                          config={editorConfig}
                          onBlur={field.onBlur}
                          onChange={(newContent: string) => field.onChange(newContent)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            </div>
            <Sidebar className="w-80 border-l">
              <SidebarHeader className="px-4 py-2">
                <h2 className="text-lg font-semibold">
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
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue
                                placeholder={t("form.selectStatus")}
                              >
                                {field.value === "publish"
                                  ? t("status.published")
                                  : t("status.draft")}
                              </SelectValue>
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="publish">
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
                          value={field.value}
                          onValueChange={field.onChange}
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
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t("form.selectCampus")}>
                                {campuses.find(
                                  (c) => c.$id === field.value
                                )?.name || t("form.selectCampus")}
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
                    type="submit"
                    className="w-full"
                    disabled={isSubmitting}
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
  )
}
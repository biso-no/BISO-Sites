"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { Departments } from "@repo/api/types/appwrite";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
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
import { Switch } from "@repo/ui/components/ui/switch";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/ui/components/ui/tabs";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { Building2, ChevronLeft, Save, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { GlassCard } from "@/components/shared/glass-card";
import { DepartmentEditorSidebar } from "@/components/units/department-editor-sidebar";
import { HeroUploadPreview } from "@/components/units/hero-upload-preview";
import {
  createDepartment,
  updateDepartmentWithTranslations,
} from "@/lib/actions/departments";

const JoditEditor = dynamic(() => import("jodit-react"), { ssr: false });

const departmentSchema = z.object({
  Id: z
    .string()
    .min(1, "Department ID is required")
    .max(10, "Max 10 characters"),
  Name: z
    .string()
    .min(1, "Department name is required")
    .max(50, "Max 50 characters"),
  campus_id: z.string().min(1, "Campus is required"),
  type: z.string().min(1, "Type is required"),
  logo: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  hero: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  active: z.boolean(),
  translations: z.object({
    en: z.object({
      title: z.string().min(1, "English title is required"),
      description: z.string().min(1, "English description is required"),
      short_description: z.string().optional(),
    }),
    no: z.object({
      title: z.string().min(1, "Norwegian title is required"),
      description: z.string().min(1, "Norwegian description is required"),
      short_description: z.string().optional(),
    }),
  }),
});

type DepartmentFormData = z.infer<typeof departmentSchema>;

type DepartmentEditorProps = {
  department?: Departments;
  campuses: Array<{ $id: string; name: string }>;
  types: string[];
};

export default function DepartmentEditor({
  department,
  campuses,
  types,
}: DepartmentEditorProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [activeLocale, setActiveLocale] = React.useState<"en" | "no">("en");
  const editorRefEn = React.useRef<any>(null);
  const editorRefNo = React.useRef<any>(null);

  // Build translations map from department data
  const translationsMap = React.useMemo(() => {
    if (!department?.translations) {
      return {
        en: { title: "", description: "", short_description: "" },
        no: { title: "", description: "", short_description: "" },
      };
    }

    const en = department.translations.find((t) => t.locale === "en");
    const no = department.translations.find((t) => t.locale === "no");

    return {
      en: {
        title: en?.title || "",
        description: en?.description || "",
        short_description: en?.short_description || "",
      },
      no: {
        title: no?.title || "",
        description: no?.description || "",
        short_description: no?.short_description || "",
      },
    };
  }, [department]);

  const form = useForm<DepartmentFormData>({
    resolver: zodResolver(departmentSchema),
    defaultValues: {
      Id: department?.Id || "",
      Name: department?.Name || "",
      campus_id: department?.campus_id || "",
      type: department?.type || "",
      logo: department?.logo || "",
      hero: (department as any)?.hero || "",
      active: department?.active ?? true,
      translations: translationsMap,
    },
  });

  const onSubmit = async (data: DepartmentFormData) => {
    setIsSubmitting(true);
    try {
      if (department) {
        // Update existing department
        const translations = [
          {
            id: department.translations?.find((t) => t.locale === "en")?.$id,
            locale: "en" as const,
            ...data.translations.en,
          },
          {
            id: department.translations?.find((t) => t.locale === "no")?.$id,
            locale: "no" as const,
            ...data.translations.no,
          },
        ];

        await updateDepartmentWithTranslations(
          department.$id,
          {
            Name: data.Name,
            campus_id: data.campus_id,
            type: data.type,
            logo: data.logo || null,
            hero: data.hero || null,
            active: data.active,
          } as any,
          translations
        );

        toast.success("Department updated successfully!");
      } else {
        // Create new department
        await createDepartment({
          Id: data.Id,
          Name: data.Name,
          campus_id: data.campus_id,
          type: data.type,
          logo: data.logo || undefined,
          hero: data.hero || undefined,
          active: data.active,
          translations: [
            { locale: "en", ...data.translations.en },
            { locale: "no", ...data.translations.no },
          ],
        } as any);

        toast.success("Department created successfully!");
      }

      router.push("/admin/units");
      router.refresh();
    } catch (error) {
      console.error("Error saving department:", error);
      toast.error("Failed to save department");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isEditing = !!department;
  const departmentName =
    form.watch("translations.en.title") ||
    form.watch("Name") ||
    "New Department";

  return (
    <div className="min-h-screen w-full">
      {/* Premium Header */}
      <div className="sticky top-0 z-50 border-border/50 border-b bg-background/95 shadow-sm backdrop-blur-md">
        <div className="container mx-auto max-w-7xl px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                className="gap-2 hover:bg-primary/10"
                onClick={() => router.push("/admin/units")}
                size="sm"
                variant="ghost"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>
              <div>
                <h1 className="flex items-center gap-3 font-bold text-2xl tracking-tight">
                  {isEditing ? "Edit Department" : "Create Department"}
                  <Badge
                    className="text-xs"
                    variant={isEditing ? "secondary" : "default"}
                  >
                    <Building2 className="mr-1 h-3 w-3" />
                    {isEditing ? "Editing" : "New"}
                  </Badge>
                </h1>
                <p className="mt-1 text-muted-foreground text-sm">
                  {isEditing
                    ? "Update department information and content"
                    : "Add a new department to your organization"}
                </p>
              </div>
            </div>
            <div className="hidden items-center gap-2 md:flex">
              <Button
                className="gap-2"
                disabled={isSubmitting}
                onClick={() => router.push("/admin/units")}
                type="button"
                variant="outline"
              >
                <X className="h-4 w-4" />
                Cancel
              </Button>
              <Button
                className="gap-2 bg-linear-to-r from-primary to-primary/90 shadow-lg transition-all duration-300 hover:from-primary/90 hover:to-primary hover:shadow-xl"
                disabled={isSubmitting}
                onClick={form.handleSubmit(onSubmit)}
              >
                <Save className="h-4 w-4" />
                {isSubmitting
                  ? "Saving..."
                  : isEditing
                    ? "Update Department"
                    : "Create Department"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-7xl px-4 py-8">
        <Form {...form}>
          <form
            className="grid gap-6 lg:grid-cols-[1fr_380px]"
            onSubmit={form.handleSubmit(onSubmit)}
          >
            {/* LEFT COLUMN - Main Content */}
            <div className="space-y-6">
              {/* Basic Information */}
              <GlassCard
                description="Core department details and identifiers"
                title="Basic Information"
                variant="premium"
              >
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="Id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Department ID</FormLabel>
                          <FormControl>
                            <Input
                              disabled={!!department}
                              maxLength={10}
                              placeholder="e.g., BI"
                              {...field}
                              className="border-border/50 bg-card/60 backdrop-blur-sm transition-all duration-300 focus:border-primary/50"
                            />
                          </FormControl>
                          <FormDescription className="text-xs">
                            Unique identifier (max 10 chars
                            {department ? ", cannot be changed" : ""})
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="Name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Display Name</FormLabel>
                          <FormControl>
                            <Input
                              maxLength={50}
                              placeholder="e.g., Business Intelligence"
                              {...field}
                              className="border-border/50 bg-card/60 backdrop-blur-sm transition-all duration-300 focus:border-primary/50"
                            />
                          </FormControl>
                          <FormDescription className="text-xs">
                            Internal name (max 50 chars)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </GlassCard>

              {/* Translations */}
              <GlassCard
                description="Multi-language content for public display"
                title="Content & Translations"
                variant="premium"
              >
                <Tabs
                  className="w-full"
                  onValueChange={(v) => setActiveLocale(v as "en" | "no")}
                  value={activeLocale}
                >
                  <TabsList className="grid w-full grid-cols-2 bg-muted/50 backdrop-blur-sm">
                    <TabsTrigger
                      className="flex items-center gap-2 data-[state=active]:bg-card/80"
                      value="en"
                    >
                      🇬🇧 English
                    </TabsTrigger>
                    <TabsTrigger
                      className="flex items-center gap-2 data-[state=active]:bg-card/80"
                      value="no"
                    >
                      🇳🇴 Norwegian
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent className="mt-6 space-y-4" value="en">
                    <FormField
                      control={form.control}
                      name="translations.en.title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Title (English)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Department title in English"
                              {...field}
                              className="border-border/50 bg-card/60 backdrop-blur-sm transition-all duration-300 focus:border-primary/50"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="translations.en.short_description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Short Description (English)</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Brief description for cards and previews"
                              rows={3}
                              {...field}
                              className="resize-none border-border/50 bg-card/60 backdrop-blur-sm transition-all duration-300 focus:border-primary/50"
                            />
                          </FormControl>
                          <FormDescription className="text-xs">
                            Used in cards and hero sections
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="translations.en.description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Description (English)</FormLabel>
                          <FormControl>
                            <div className="overflow-hidden rounded-lg border border-border/50 bg-card/40 backdrop-blur-sm">
                              <JoditEditor
                                config={{
                                  readonly: false,
                                  height: 400,
                                  placeholder:
                                    "Detailed department description in English",
                                  toolbar: true,
                                }}
                                onBlur={(newContent) =>
                                  field.onChange(newContent)
                                }
                                ref={editorRefEn}
                                value={field.value}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </TabsContent>

                  <TabsContent className="mt-6 space-y-4" value="no">
                    <FormField
                      control={form.control}
                      name="translations.no.title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tittel (Norsk)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Avdelingstittel på norsk"
                              {...field}
                              className="border-border/50 bg-card/60 backdrop-blur-sm transition-all duration-300 focus:border-primary/50"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="translations.no.short_description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Kort beskrivelse (Norsk)</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Kort beskrivelse for kort og forhåndsvisninger"
                              rows={3}
                              {...field}
                              className="resize-none border-border/50 bg-card/60 backdrop-blur-sm transition-all duration-300 focus:border-primary/50"
                            />
                          </FormControl>
                          <FormDescription className="text-xs">
                            Brukes i kort og hero-seksjoner
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="translations.no.description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full beskrivelse (Norsk)</FormLabel>
                          <FormControl>
                            <div className="overflow-hidden rounded-lg border border-border/50 bg-card/40 backdrop-blur-sm">
                              <JoditEditor
                                config={{
                                  readonly: false,
                                  height: 400,
                                  placeholder:
                                    "Detaljert avdelingsbeskrivelse på norsk",
                                  toolbar: true,
                                }}
                                onBlur={(newContent) =>
                                  field.onChange(newContent)
                                }
                                ref={editorRefNo}
                                value={field.value}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </TabsContent>
                </Tabs>
              </GlassCard>

              {/* Hero Image Upload */}
              <GlassCard
                description="Upload a custom hero background for the department page"
                title="Hero Background"
                variant="premium"
              >
                <HeroUploadPreview
                  departmentName={departmentName}
                  heroUrl={form.watch("hero")}
                  onChange={(url) => form.setValue("hero", url)}
                />
              </GlassCard>
            </div>

            {/* RIGHT COLUMN - Sticky Sidebar */}
            <div className="lg:sticky lg:top-24 lg:self-start">
              <DepartmentEditorSidebar
                campusControl={
                  <FormField
                    control={form.control}
                    name="campus_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Campus</FormLabel>
                        <Select
                          defaultValue={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger className="border-border/50 bg-card/60 backdrop-blur-sm">
                              <SelectValue placeholder="Select campus" />
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
                }
                departmentName={departmentName}
                isNew={!isEditing}
                logoUrl={form.watch("logo")}
                onLogoChange={(url) => form.setValue("logo", url)}
                stats={
                  department
                    ? {
                        userCount: (department as any).userCount,
                        boardMemberCount: (department as any).boardMemberCount,
                        socialsCount: (department as any).socialsCount,
                      }
                    : undefined
                }
                statusControl={
                  <FormField
                    control={form.control}
                    name="active"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between">
                        <div className="space-y-0.5">
                          <FormLabel className="text-sm">
                            Active Status
                          </FormLabel>
                          <FormDescription className="text-xs">
                            Visible to users when active
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                }
                typeControl={
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Type</FormLabel>
                        <Select
                          defaultValue={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger className="border-border/50 bg-card/60 backdrop-blur-sm">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {types.map((type) => (
                              <SelectItem key={type} value={type}>
                                {type.charAt(0).toUpperCase() + type.slice(1)}
                              </SelectItem>
                            ))}
                            <SelectItem value="committee">Committee</SelectItem>
                            <SelectItem value="team">Team</SelectItem>
                            <SelectItem value="service">Service</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                }
              />
            </div>
          </form>
        </Form>

        {/* Mobile Actions */}
        <div className="sticky bottom-4 mt-6 flex items-center justify-center gap-2 rounded-xl border border-border/50 bg-card/60 p-4 backdrop-blur-sm md:hidden">
          <Button
            className="flex-1"
            disabled={isSubmitting}
            onClick={() => router.push("/admin/units")}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            className="flex-1"
            disabled={isSubmitting}
            onClick={form.handleSubmit(onSubmit)}
          >
            {isSubmitting ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}

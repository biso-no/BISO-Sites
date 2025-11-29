"use client";

import {
  type Config,
  type Data,
  Puck,
  usePuck as usePuckOriginal,
} from "@measured/puck";
import { Button } from "@repo/ui/components/ui/button";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { config } from "./config";
import "@measured/puck/puck.css";
import {
  type Locale,
  PageStatus,
  PageVisibility,
} from "@repo/api/types/appwrite";
import { DataSourcePicker } from "@repo/ui/components/data-source-picker";
import { FileUpload } from "@repo/ui/components/file-upload";
import { LinkPicker } from "@repo/ui/components/link-picker";
import { TablePicker } from "@repo/ui/components/table-picker";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@repo/ui/components/ui/sheet";
import { Textarea } from "@repo/ui/components/ui/textarea";
import {
  ExternalLink,
  Globe,
  Languages,
  Loader2,
  Monitor,
  Settings,
  Smartphone,
  Tablet,
} from "lucide-react";
import { TABLE_SCHEMAS } from "./data/schemas";
import { getPages } from "./get-pages";
import { getTables } from "./get-tables";
import { listImages, uploadImage } from "./upload-image";

// Use the standard hook
const usePuck = usePuckOriginal;

export type PageEditorProps = {
  initialData: Data;
  title: string;
  slug: string;
  description?: string;
  locale: Locale;
  availableLocales: Locale[];
  status: PageStatus;
  visibility: PageVisibility;
  onSave: (
    data: Data,
    metadata: { title: string; slug: string; description?: string }
  ) => Promise<void>;
  onPublish: (
    data: Data,
    metadata: { title: string; slug: string; description?: string }
  ) => Promise<void>;
  onLocaleChange: (locale: Locale) => void;
  onBack: () => void;
  onTranslate?: (
    data: Data,
    metadata: { title: string; slug: string; description?: string },
    targetLocale: Locale
  ) => Promise<void>;
};

export function PageEditor({
  initialData,
  title: initialTitle,
  slug: initialSlug,
  description: initialDescription = "",
  locale,
  availableLocales,
  status: initialStatus,
  visibility: initialVisibility,
  onSave,
  onPublish,
  onLocaleChange,
  onBack,
  onTranslate,
}: PageEditorProps) {
  const [data, setData] = useState<Data>(initialData);
  const [saving, setSaving] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [slug, setSlug] = useState(initialSlug);
  const [description, setDescription] = useState(initialDescription);

  // Update local state when props change (e.g. after navigation)
  useEffect(() => {
    setData(initialData);
    setTitle(initialTitle);
    setSlug(initialSlug);
    setDescription(initialDescription);
  }, [initialData, initialTitle, initialSlug, initialDescription]);

  const handleSave = async (newData: Data) => {
    setSaving(true);
    try {
      await onSave(newData, { title, slug, description });
      setData(newData);
      toast.success("Draft saved successfully");
    } catch (error) {
      console.error(error);
      toast.error("Failed to save draft");
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async (newData: Data) => {
    setSaving(true);
    try {
      await onPublish(newData, { title, slug, description });
      setData(newData);
      toast.success("Page published successfully");
    } catch (error) {
      console.error(error);
      toast.error("Failed to publish page");
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (newData: File) => {
    const result = await uploadImage(newData);
    return result;
  };

  const handleTranslate = async (newData: Data, targetLocale: Locale) => {
    if (!onTranslate) {
      toast.error("Translation is not available");
      return;
    }
    setTranslating(true);
    try {
      await onTranslate(newData, { title, slug, description }, targetLocale);
      toast.success(
        `Page translated to ${targetLocale === "no" ? "Norwegian" : "English"}`
      );
    } catch (error) {
      console.error(error);
      toast.error("Failed to translate page");
    } finally {
      setTranslating(false);
    }
  };

  return (
    <div className="flex h-screen w-full flex-col">
      <Puck
        config={config as Config}
        data={data}
        headerPath={`/${locale}/${slug}`}
        headerTitle={title}
        onPublish={handleSave}
        overrides={{
          fieldTypes: {
            link: ({ onChange, value }) => (
              <LinkPicker
                getPages={getPages}
                onChange={onChange}
                value={value}
              />
            ),
            "table-picker": ({ onChange, value }) => (
              <TablePicker
                getTables={getTables}
                onChange={onChange}
                value={value}
              />
            ),
            "data-source": ({ onChange, value }) => (
              <DataSourcePicker
                onChange={onChange}
                schemas={TABLE_SCHEMAS}
                value={value ?? {}}
              />
            ),
            image: ({ name, onChange, value }) => (
              <FileUpload
                getImages={listImages}
                name={name}
                onChange={(fileOrUrl) => {
                  if (fileOrUrl instanceof File) {
                    handleImageUpload(fileOrUrl).then((url) => onChange(url));
                  } else if (typeof fileOrUrl === "string") {
                    onChange(fileOrUrl);
                  }
                }}
                value={value}
              />
            ),
          },
          headerActions: ({ children: _children }) => {
            // Get current app state (including data) from Puck
            // biome-ignore lint/correctness/useHookAtTopLevel: usePuck is designed for Puck override functions
            const { appState } = usePuck();
            const currentData = appState.data as Data;

            return (
              <>
                <div className="flex items-center gap-2">
                  {/* Locale Switcher */}
                  <Select
                    onValueChange={(v) => onLocaleChange(v as Locale)}
                    value={locale}
                  >
                    <SelectTrigger className="h-9 w-[140px] border-white/20 bg-white/10 text-white">
                      <Globe className="mr-2 h-4 w-4" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableLocales.map((l) => (
                        <SelectItem key={l} value={l}>
                          {l === "no" ? "Norwegian" : "English"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Sheet>
                    <SheetTrigger asChild>
                      <Button
                        className="ml-2 h-9 w-9"
                        size="icon"
                        variant="outline"
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                    </SheetTrigger>
                    <SheetContent>
                      <SheetHeader>
                        <SheetTitle>Page Settings</SheetTitle>
                        <SheetDescription>
                          Configure page properties and metadata.
                        </SheetDescription>
                      </SheetHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                          <Label htmlFor="title">Title</Label>
                          <Input
                            id="title"
                            onChange={(e) => setTitle(e.target.value)}
                            value={title}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="slug">Slug</Label>
                          <Input
                            id="slug"
                            onChange={(e) => setSlug(e.target.value)}
                            value={slug}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="description">Description</Label>
                          <Textarea
                            className="resize-none"
                            id="description"
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                            value={description}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="status">Status</Label>
                          <Select disabled value={initialStatus as string}>
                            <SelectTrigger id="status">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={PageStatus.DRAFT}>
                                Draft
                              </SelectItem>
                              <SelectItem value={PageStatus.PUBLISHED}>
                                Published
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="visibility">Visibility</Label>
                          <Select disabled value={initialVisibility as string}>
                            <SelectTrigger id="visibility">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={PageVisibility.PUBLIC}>
                                Public
                              </SelectItem>
                              <SelectItem value={PageVisibility.AUTHENTICATED}>
                                Authenticated
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </SheetContent>
                  </Sheet>

                  {/* AI Translate Button */}
                  {onTranslate && availableLocales.length > 1 && (
                    <Select
                      disabled={translating}
                      onValueChange={(targetLocale) => {
                        if (targetLocale !== locale) {
                          handleTranslate(currentData, targetLocale as Locale);
                        }
                      }}
                      value=""
                    >
                      <SelectTrigger className="h-9 w-[160px] border-white/20 bg-white/10 text-white">
                        {translating ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            <span>Translating...</span>
                          </>
                        ) : (
                          <>
                            <Languages className="mr-2 h-4 w-4" />
                            <span>AI Translate</span>
                          </>
                        )}
                      </SelectTrigger>
                      <SelectContent>
                        {availableLocales
                          .filter((l) => l !== locale)
                          .map((l) => (
                            <SelectItem key={l} value={l}>
                              Translate to{" "}
                              {l === "no" ? "Norwegian" : "English"}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  )}

                  <div className="mx-2 h-6 w-px bg-white/20" />

                  <Button className="mr-2" onClick={onBack} variant="outline">
                    Back
                  </Button>

                  {initialStatus === PageStatus.PUBLISHED && (
                    <Button
                      className="mr-2"
                      onClick={() =>
                        window.open(`/${locale}/${slug}`, "_blank")
                      }
                      variant="outline"
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      View
                    </Button>
                  )}

                  <Button
                    disabled={saving}
                    onClick={() => handleSave(currentData)}
                    variant="secondary"
                  >
                    Save Draft
                  </Button>

                  <Button
                    className="bg-[#001731] text-white hover:bg-[#001731]/90"
                    disabled={saving}
                    onClick={() => handlePublish(currentData)}
                  >
                    Publish
                  </Button>
                </div>

                {/* Optionally render the default header actions (e.g. default Publish) */}
                {/* {children} */}
              </>
            );
          },
        }}
        viewports={[
          {
            label: "Desktop",
            width: 1280,
            height: "auto",
            icon: <Monitor size={20} />,
          },
          {
            label: "Tablet",
            width: 768,
            height: "auto",
            icon: <Tablet size={20} />,
          },
          {
            label: "Mobile",
            width: 375,
            height: "auto",
            icon: <Smartphone size={20} />,
          },
        ]}
      />
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { Puck, type Data, type Config } from "@measured/puck";
import { config } from "@repo/editor";
import { Button } from "@repo/ui/components/ui/button"
import { toast } from "sonner";
import { savePageDraft, publishPage, ensureTranslation } from "@/app/actions/pages";
import { useRouter } from "next/navigation";
import "@measured/puck/puck.css";
import { Label } from "@repo/ui/components/ui/label";
import { Input } from "@repo/ui/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/components/ui/select";
import { PageStatus, PageVisibility, Locale } from "@repo/api/types/appwrite";
import { ChevronLeft, Globe, Settings } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@repo/ui/components/ui/sheet";
import { createUsePuck } from "@repo/editor";

interface EditorClientProps {
  pageId: string;
  translationId: string;
  initialData: Data;
  title: string;
  locale: Locale;
  availableLocales: Locale[];
  slug: string;
  status: PageStatus;
  visibility: PageVisibility;
  pageTranslations: { locale: Locale; id: string }[];
}

export function EditorClient({
  pageId,
  translationId: initialTranslationId,
  initialData,
  title: initialTitle,
  locale,
  availableLocales,
  slug: initialSlug,
  status: initialStatus,
  visibility: initialVisibility,
  pageTranslations,
}: EditorClientProps) {
  const router = useRouter();
  const [data, setData] = useState<Data>(initialData);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [slug, setSlug] = useState(initialSlug);

  const usePuck = createUsePuck();
  
  // Update local state when props change (e.g. after navigation)
  useEffect(() => {
    setData(initialData);
    setTitle(initialTitle);
    setSlug(initialSlug);
  }, [initialData, initialTitle, initialSlug]);

  const handleSave = async (newData: Data) => {
    setSaving(true);
    try {
      await savePageDraft({
        translationId: initialTranslationId,
        draftDocument: newData,
        title,
        slug,
      });
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
      await publishPage({
        translationId: initialTranslationId,
        document: newData,
        title,
        slug,
      });
      setData(newData);
      toast.success("Page published successfully");
    } catch (error) {
      console.error(error);
      toast.error("Failed to publish page");
    } finally {
      setSaving(false);
    }
  };

  const handleLocaleChange = async (newLocale: Locale) => {
    if (newLocale === locale) return;
    
    const existingTranslation = pageTranslations.find(t => t.locale === newLocale);
    
    if (existingTranslation) {
      router.push(`/admin/pages/${pageId}/${newLocale}/editor`);
    } else {
      // Create translation if it doesn't exist
      try {
        setSaving(true);
        await ensureTranslation({
          pageId,
          locale: newLocale,
          title: title, // Use current title as fallback
          sourceTranslationId: initialTranslationId // Copy content from current
        });
        toast.success(`Created ${newLocale} translation`);
        router.push(`/admin/pages/${pageId}/${newLocale}/editor`);
      } catch (error) {
        console.error(error);
        toast.error(`Failed to create ${newLocale} translation`);
        setSaving(false);
      }
    }
  };

  return (
    <div className="h-screen w-full flex flex-col">
      <Puck
  config={config as Config}
  data={data}
  onPublish={handleSave}
  headerTitle={title}
  headerPath={`/${locale}/${slug}`}
  overrides={{
    headerActions: ({ children }) => {
      // Get current app state (including data) from Puck
      const appState = usePuck((s) => s.appState);
      const currentData = appState?.data as Data;

      return (
        <>
          <div className="flex items-center gap-2">
            {/* Locale Switcher */}
            <Select
              value={locale}
              onValueChange={(v) => handleLocaleChange(v as Locale)}
            >
              <SelectTrigger className="w-[140px] h-9 bg-white/10 border-white/20 text-white">
                <Globe className="w-4 h-4 mr-2" />
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
                  variant="outline"
                  size="icon"
                  className="ml-2 h-9 w-9"
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
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="slug">Slug</Label>
                    <Input
                      id="slug"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="status">Status</Label>
                    <Select value={initialStatus as string} disabled>
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
                    <Select value={initialVisibility as string} disabled>
                      <SelectTrigger id="visibility">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={PageVisibility.PUBLIC}>
                          Public
                        </SelectItem>
                        <SelectItem
                          value={PageVisibility.AUTHENTICATED}
                        >
                          Authenticated
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            <div className="h-6 w-px bg-white/20 mx-2" />

            <Button
              variant="outline"
              onClick={() => router.back()}
              className="mr-2"
            >
              Back
            </Button>

            <Button
              variant="secondary"
              disabled={saving}
              onClick={() => handleSave(currentData)}
            >
              Save Draft
            </Button>

            <Button
              disabled={saving}
              onClick={() => handlePublish(currentData)}
              className="bg-[#001731] text-white hover:bg-[#001731]/90"
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
/>

    </div>
  );
}

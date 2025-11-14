"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusCircle, RotateCcw } from "lucide-react";
import { createManagedPage } from "@/app/actions/pages";
import { Locale, PageStatus, PageVisibility } from "@repo/api/types/appwrite";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Input } from "@repo/ui/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { Label } from "@repo/ui/components/ui/label";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { cn } from "@repo/ui/lib/utils";

const ALL_LOCALES: Array<{ value: Locale; label: string }> = [
  { value: Locale.NO, label: "Norwegian" },
  { value: Locale.EN, label: "English" },
];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

export function PageCreateForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [status, setStatus] = useState<PageStatus>(PageStatus.DRAFT);
  const [visibility, setVisibility] = useState<PageVisibility>(PageVisibility.PUBLIC);
  const [template, setTemplate] = useState<string>("");
  const [campusId, setCampusId] = useState<string>("");
  const [locales, setLocales] = useState<Locale[]>([Locale.NO]);
  const [description, setDescription] = useState<string>("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug && title) {
      setSlug(slugify(title));
    }
  }, [title, slug]);

  const canSubmit = useMemo(() => {
    return title.trim().length > 1 && slug.trim().length > 1 && locales.length > 0;
  }, [title, slug, locales.length]);

  const handleSubmit = () => {
    if (!canSubmit) {
      return;
    }

    startTransition(async () => {
      setError(null);
      try {
        const page = await createManagedPage({
          slug: slug.trim(),
          title: title.trim(),
          status,
          visibility,
          template: template.trim() || null,
          campusId: campusId.trim() || null,
          translations: locales.map((locale) => ({
            locale,
            title: title.trim(),
            description: description.trim() ? description.trim() : null,
            publish: status === "published",
          })),
        });

        router.push(`/admin/pages/${page.id}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to create page";
        setError(message);
      }
    });
  };

  const toggleLocale = (locale: Locale) => {
    setLocales((current) =>
      current.includes(locale)
        ? current.filter((item) => item !== locale)
        : [...current, locale]
    );
  };

  const resetForm = () => {
    setTitle("");
    setSlug("");
    setStatus(PageStatus.DRAFT);
    setVisibility(PageVisibility.PUBLIC);
    setTemplate("");
    setCampusId("");
    setLocales([Locale.NO]);
    setDescription("");
    setError(null);
  };

  return (
    <Card className="border-primary/10 bg-white/90 shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-primary-100">
          New page
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6">
        <div className="grid gap-2">
          <Label className="text-primary-100" htmlFor="title">Title</Label>
          <Input
            id="title"
            value={title}
            className="text-primary-100"
            placeholder="About student life"
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <Label className="text-primary-100" htmlFor="slug">Slug</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => setSlug(slugify(title))}
            >
              Refresh
            </Button>
          </div>
          <Input
            id="slug"
            value={slug}
            className="text-primary-100"
            placeholder="about/student-life"
            onChange={(event) => setSlug(slugify(event.target.value))}
          />
          <p className="text-xs text-muted-foreground">This becomes the URL: /{slug || "your-slug"}</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label className="text-primary-100">Status</Label>
            <Select value={status} onValueChange={(value: PageStatus) => setStatus(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Draft" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={PageStatus.DRAFT}>Draft</SelectItem>
                <SelectItem value={PageStatus.PUBLISHED}>Published</SelectItem>
                <SelectItem value={PageStatus.ARCHIVED}>Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label className="text-primary-100">Visibility</Label>
            <Select
              value={visibility}
              onValueChange={(value: PageVisibility) => setVisibility(value)}
            >
              <SelectTrigger className="text-primary-100">
                <SelectValue placeholder="Public" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={PageVisibility.PUBLIC}>Public</SelectItem>
                <SelectItem value={PageVisibility.AUTHENTICATED}>Members only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label className="text-primary-100" htmlFor="template">Template key</Label>
            <Input
              id="template"
              value={template}
              className="text-primary-100"
              placeholder="optional"
              onChange={(event) => setTemplate(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label className="text-primary-100" htmlFor="campus">Campus scope</Label>
            <Input
              id="campus"
              value={campusId}
              className="text-primary-100"
              placeholder="optional campus id"
              onChange={(event) => setCampusId(event.target.value)}
            />
          </div>
        </div>
        <div className="grid gap-2">
          <Label className="text-primary-100">Locales</Label>
          <div className="flex flex-wrap gap-4">
            {ALL_LOCALES.map((option) => (
              <label
                key={option.value}
                className={cn(
                  "flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
                  locales.includes(option.value)
                    ? "border-primary bg-primary-10/60 text-primary-100"
                    : "border-muted"
                )}
              >
                <Checkbox
                  checked={locales.includes(option.value)}
                  onCheckedChange={() => toggleLocale(option.value)}
                />
                {option.label}
              </label>
            ))}
          </div>
        </div>
        <div className="grid gap-2">
          <Label className="text-primary-100" htmlFor="description">Internal description</Label>
          <Textarea
            id="description"
            placeholder="Share context with editors"
            className="text-primary-100"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : null}
        <div className="flex items-center justify-between gap-4">
          <Button type="button" variant="ghost" size="sm" onClick={resetForm}>
            <RotateCcw className="mr-2 h-4 w-4 text-primary-100" /> Reset
          </Button>
          <Button
            type="button"
            disabled={!canSubmit || pending}
            className="inline-flex items-center gap-2 
            text-primary-100"
            onClick={handleSubmit}
          >
            <PlusCircle className="h-4 w-4" />
            {pending ? "Creating..." : "Create page"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

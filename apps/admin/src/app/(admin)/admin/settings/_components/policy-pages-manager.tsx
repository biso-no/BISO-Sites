"use client";

import { Locale } from "@repo/api/types/appwrite";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Input } from "@repo/ui/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/ui/tabs";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { useEffect, useState, useTransition } from "react";
import {
  getSitePageTranslation,
  translateSitePageContent,
  upsertSitePage,
} from "@/app/actions/site-pages";
import { toast } from "@/lib/hooks/use-toast";

type LocaleString = "en" | "no";
type PageSlug = "privacy" | "cookies" | "terms";

const PAGES: Array<{ slug: PageSlug; label: string }> = [
  { slug: "privacy", label: "Privacy" },
  { slug: "cookies", label: "Cookies" },
  { slug: "terms", label: "Terms" },
];

export function PolicyPagesManager() {
  const [activePage, setActivePage] = useState<PageSlug>("privacy");
  const [activeLocale, setActiveLocale] = useState<LocaleString>("no");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();

  const load = async (slug: PageSlug, locale: LocaleString) => {
    try {
      const localeEnum = locale === "en" ? Locale.EN : Locale.NO;
      const res = await getSitePageTranslation(slug, localeEnum);
      setTitle(res?.title || "");
      setBody(res?.body || "");
    } catch {
      setTitle("");
      setBody("");
    }
  };

  useEffect(() => {
    void load(activePage, activeLocale);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePage, activeLocale]);

  const handleChangePage = (slug: PageSlug) => {
    setActivePage(slug);
    startTransition(() => void load(slug, activeLocale));
  };
  const handleChangeLocale = (locale: LocaleString) => {
    setActiveLocale(locale);
    startTransition(() => void load(activePage, locale));
  };

  const handleSave = () => {
    startTransition(async () => {
      const localeEnum = activeLocale === "en" ? Locale.EN : Locale.NO;
      const updated = await upsertSitePage({
        slug: activePage,
        status: "published",
        translations: { [localeEnum]: { title, body } },
      });
      if (updated) toast({ title: "Saved", description: "Page updated" });
      else toast({ title: "Save failed", description: "Please try again", variant: "destructive" });
    });
  };

  const handleTranslate = (to: LocaleString) => {
    startTransition(async () => {
      const fromLocaleEnum = activeLocale === "en" ? Locale.EN : Locale.NO;
      const toLocaleEnum = to === "en" ? Locale.EN : Locale.NO;
      const res = await translateSitePageContent(activePage, fromLocaleEnum, toLocaleEnum);
      if (!res) {
        toast({ title: "Translation failed", variant: "destructive" });
        return;
      }
      toast({ title: "Translated", description: `Updated ${to.toUpperCase()} content` });
      // Switch to target locale and reload fields
      setActiveLocale(to);
      void load(activePage, to);
    });
  };

  return (
    <Card className="border-primary/10 bg-white/90">
      <CardHeader>
        <CardTitle>Policy Pages</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {PAGES.map((p) => (
            <Button
              key={p.slug}
              variant={activePage === p.slug ? "default" : "outline"}
              size="sm"
              onClick={() => handleChangePage(p.slug)}
            >
              {p.label}
            </Button>
          ))}
        </div>

        <Tabs value={activeLocale} onValueChange={(v) => handleChangeLocale(v as LocaleString)}>
          <TabsList>
            <TabsTrigger value="no">NO</TabsTrigger>
            <TabsTrigger value="en">EN</TabsTrigger>
          </TabsList>
          <TabsContent value="no" className="space-y-3">
            <Input placeholder="Tittel" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Textarea
              placeholder="Innhold (HTML eller tekst)"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={12}
            />
          </TabsContent>
          <TabsContent value="en" className="space-y-3">
            <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Textarea
              placeholder="Body (HTML or text)"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={12}
            />
          </TabsContent>
        </Tabs>

        <div className="flex flex-wrap gap-2">
          <Button onClick={handleSave} disabled={pending}>
            Save
          </Button>
          <Button
            variant="outline"
            onClick={() => handleTranslate(activeLocale === "no" ? "en" : "no")}
            disabled={pending}
          >
            Translate to {activeLocale === "no" ? "EN" : "NO"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

"use client";

import { Locale } from "@repo/api/types/appwrite";
import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import { Input } from "@repo/ui/components/ui/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/ui/components/ui/tabs";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { useCallback, useEffect, useState, useTransition } from "react";
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

  const load = useCallback(async (slug: PageSlug, locale: LocaleString) => {
    try {
      const localeEnum = locale === "en" ? Locale.EN : Locale.NO;
      const res = await getSitePageTranslation(slug, localeEnum);
      setTitle(res?.title || "");
      setBody(res?.body || "");
    } catch {
      setTitle("");
      setBody("");
    }
  }, []);

  useEffect(() => {
    load(activePage, activeLocale);
  }, [activePage, activeLocale, load]);

  const handleChangePage = (slug: PageSlug) => {
    setActivePage(slug);
    startTransition(async () => {
      await load(slug, activeLocale);
    });
  };
  const handleChangeLocale = (locale: LocaleString) => {
    setActiveLocale(locale);
    startTransition(async () => {
      await load(activePage, locale);
    });
  };

  const handleSave = () => {
    startTransition(async () => {
      const localeEnum = activeLocale === "en" ? Locale.EN : Locale.NO;
      const updated = await upsertSitePage({
        slug: activePage,
        status: "published",
        translations: { [localeEnum]: { title, body } },
      });
      if (updated) {
        toast({ title: "Saved", description: "Page updated" });
      } else {
        toast({
          title: "Save failed",
          description: "Please try again",
          variant: "destructive",
        });
      }
    });
  };

  const handleTranslate = (to: LocaleString) => {
    startTransition(async () => {
      const fromLocaleEnum = activeLocale === "en" ? Locale.EN : Locale.NO;
      const toLocaleEnum = to === "en" ? Locale.EN : Locale.NO;
      const res = await translateSitePageContent(
        activePage,
        fromLocaleEnum,
        toLocaleEnum
      );
      if (!res) {
        toast({ title: "Translation failed", variant: "destructive" });
        return;
      }
      toast({
        title: "Translated",
        description: `Updated ${to.toUpperCase()} content`,
      });
      // Switch to target locale and reload fields
      setActiveLocale(to);
      await load(activePage, to);
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
              onClick={() => handleChangePage(p.slug)}
              size="sm"
              variant={activePage === p.slug ? "default" : "outline"}
            >
              {p.label}
            </Button>
          ))}
        </div>

        <Tabs
          onValueChange={(v) => handleChangeLocale(v as LocaleString)}
          value={activeLocale}
        >
          <TabsList>
            <TabsTrigger value="no">NO</TabsTrigger>
            <TabsTrigger value="en">EN</TabsTrigger>
          </TabsList>
          <TabsContent className="space-y-3" value="no">
            <Input
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Tittel"
              value={title}
            />
            <Textarea
              onChange={(e) => setBody(e.target.value)}
              placeholder="Innhold (HTML eller tekst)"
              rows={12}
              value={body}
            />
          </TabsContent>
          <TabsContent className="space-y-3" value="en">
            <Input
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              value={title}
            />
            <Textarea
              onChange={(e) => setBody(e.target.value)}
              placeholder="Body (HTML or text)"
              rows={12}
              value={body}
            />
          </TabsContent>
        </Tabs>

        <div className="flex flex-wrap gap-2">
          <Button disabled={pending} onClick={handleSave}>
            Save
          </Button>
          <Button
            disabled={pending}
            onClick={() => handleTranslate(activeLocale === "no" ? "en" : "no")}
            variant="outline"
          >
            Translate to {activeLocale === "no" ? "EN" : "NO"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

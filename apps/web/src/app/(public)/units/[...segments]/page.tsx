import type { PageDoc } from "@repo/editor";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { Suspense } from "react";
import { getLocale } from "@/app/actions/locale";
import { getDepartmentById } from "@/lib/actions/departments";
import { getLoggedInUser } from "@/lib/actions/user";
import { resolvePageFeeds } from "@/lib/data/page-feeds";
import { cachedPublishedPage } from "@/lib/data/public-content";
import { RenderedPage } from "../../[...slug]/_components/rendered-page";
import { CampusChooser } from "./_components/campus-chooser";
import { DepartmentHero } from "./components/department-hero";
import { DepartmentTabsClient } from "./components/department-tabs-client";
import DepartmentLoading from "./loading";
import { resolveUnit } from "./resolve";

interface Props {
  params: Promise<{ segments: string[] }>;
}

/**
 * Opt out of the instant shell, for the reason documented on the (public)
 * catch-all: once the shell flushes the response is committed as 200, so
 * notFound() can no longer answer a crawler with a real 404.
 */
export const instant = false;

async function UnitContent({ segments }: { segments: string[] }) {
  const resolution = await resolveUnit(segments);

  if (resolution.kind === "notFound") {
    notFound();
  }
  if (resolution.kind === "redirect") {
    permanentRedirect(resolution.to);
  }
  if (resolution.kind === "chooser") {
    return (
      <CampusChooser
        matches={resolution.matches}
        slug={resolution.slug}
        unavailableAt={resolution.unavailableAt}
      />
    );
  }

  const locale = await getLocale();
  const { department, canonical } = resolution;

  // A published custom page overrides the default view. canonical is
  // "/units/<campus>/<slug>"; the page's storage slug is the same without the
  // leading slash.
  const pageResult = await cachedPublishedPage(
    canonical.slice(1),
    locale
  ).catch(() => null);

  if (pageResult?.translation?.is_published && pageResult.doc) {
    const doc = pageResult.doc as PageDoc;
    const feeds = await resolvePageFeeds(doc, locale);
    return <RenderedPage doc={doc} feeds={feeds} locale={locale} />;
  }

  const translated = await getDepartmentById(department.$id, locale);
  if (!translated?.department_ref?.active) {
    notFound();
  }
  const user = await getLoggedInUser();
  const isMember = user?.profile?.studentId?.isMember ?? false;

  return (
    <>
      <DepartmentHero department={translated} />
      <DepartmentTabsClient department={translated} isMember={isMember} />
    </>
  );
}

export default async function UnitPage({ params }: Props) {
  const { segments } = await params;
  return (
    <div className="min-h-screen bg-background">
      <Suspense fallback={<DepartmentLoading />}>
        <UnitContent segments={segments} />
      </Suspense>
    </div>
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { segments } = await params;
  const resolution = await resolveUnit(segments);
  if (resolution.kind !== "department") {
    return {};
  }

  const locale = await getLocale();
  const { department, canonical } = resolution;
  const pageResult = await cachedPublishedPage(
    canonical.slice(1),
    locale
  ).catch(() => null);

  const translated = await getDepartmentById(department.$id, locale);
  const title =
    pageResult?.translation?.title ?? translated?.title ?? department.Name;
  const description =
    pageResult?.translation?.description ??
    translated?.short_description ??
    translated?.description ??
    undefined;

  return {
    title: `${title} | BISO`,
    description: description?.slice(0, 160),
    // The one-segment URL points at the campus-explicit one so the two routes
    // never compete as duplicate content.
    alternates: { canonical },
  };
}

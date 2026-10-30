import { AskAboutPage } from "components/assistant/ask-about-page";
import { PageHeader } from "components/page-header";
import { getBreadcrumbItems } from "fumadocs-core/breadcrumb";
import type { PageData } from "fumadocs-core/source";
import type { TOCItemType } from "fumadocs-core/toc";
import { DocsBody, DocsPage } from "fumadocs-ui/page";
import { formatUpdated } from "lib/format";
import { getPageImage, source } from "lib/source";
import { getMDXComponents } from "mdx-components";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ElementType } from "react";

interface Param {
  slug: string[];
}

interface MDX extends PageData {
  body: ElementType;
  full: boolean;
  lastModified?: Date;
  toc: TOCItemType[];
}

/** Title of the page's parent folder; none for an area index or a top-level page. */
function crumbFor(url: string): string | undefined {
  const parent = getBreadcrumbItems(url, source.pageTree).at(-1);
  return typeof parent?.name === "string" ? parent.name : undefined;
}

export default async function Page(props: { params: Promise<Param> }) {
  const params = await props.params;

  const page = source.getPage(params.slug);
  if (!page) {
    notFound();
  }

  const mdxPage = page.data as MDX;

  const MDXContent = mdxPage.body;

  // A footer alone would make Fumadocs show the contents rail, and its popover
  // below 1280px, on every page, assistant on or off. Keep its own rule, so
  // they show only on pages with headings, as before.
  const hasToc = mdxPage.toc.length > 0;
  const askAboutPage = <AskAboutPage url={page.url} />;

  return (
    <DocsPage
      // PageHeader carries the crumb, so Fumadocs' own breadcrumb would repeat it.
      breadcrumb={{ enabled: false }}
      full={mdxPage.full}
      tableOfContent={{
        enabled: hasToc && !mdxPage.full,
        footer: askAboutPage,
      }}
      tableOfContentPopover={{ enabled: hasToc, footer: askAboutPage }}
      toc={mdxPage.toc}
    >
      <PageHeader
        crumb={crumbFor(page.url)}
        description={page.data.description}
        title={page.data.title}
        updated={formatUpdated(mdxPage.lastModified)}
        who={page.data.who}
      />
      <DocsBody>
        <MDXContent components={getMDXComponents()} />
      </DocsBody>
    </DocsPage>
  );
}

export function generateStaticParams() {
  return source.getPages().map((page) => ({
    slug: page.slugs,
  }));
}

export async function generateMetadata(props: {
  params: Promise<Param>;
}): Promise<Metadata> {
  const params = await props.params;

  const page = source.getPage(params.slug);
  if (!page) {
    notFound();
  }

  const image = getPageImage(page);

  return {
    title: page.data.title,
    description: page.data.description,
    openGraph: {
      images: image.url,
    },
  };
}

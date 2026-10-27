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

  return (
    <DocsPage full={(page.data as MDX).full} toc={(page.data as MDX).toc}>
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

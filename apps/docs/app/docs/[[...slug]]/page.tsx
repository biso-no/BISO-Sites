import type { PageData } from "fumadocs-core/source";
import type { TOCItemType } from "fumadocs-core/toc";
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from "fumadocs-ui/page";
import { getPageImage, source } from "lib/source";
import { getMDXComponents } from "mdx-components";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import type { ElementType } from "react";

interface Param {
  slug?: string[];
}

interface MDX extends PageData {
  body: ElementType;
  toc: TOCItemType[];
  full: boolean;
}

export default async function Page(props: { params: Promise<Param> }) {
  const params = await props.params;

  // Redirect /docs to /docs/repository
  if (!params.slug || params.slug.length === 0) {
    redirect("/docs/repository");
  }

  const page = source.getPage(params.slug);
  if (!page) notFound();

  const mdxPage = page.data as MDX;

  const MDX = mdxPage.body;

  return (
    <DocsPage
      toc={(page.data as MDX).toc}
      full={(page.data as MDX).full}
      editOnGithub={{
        owner: "biso-no",
        repo: "biso-sites",
        path: `apps/docs/content/docs/${params.slug?.join("/") || "index"}.mdx`,
      }}
    >
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDX components={getMDXComponents()} />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return source.getPages().map((page) => ({
    slug: page.slugs,
  }));
}

export async function generateMetadata(props: {
  params: Promise<Param>;
}): Promise<Metadata> {
  const params = await props.params;

  if (!params.slug) {
    return {
      title: "Documentation",
      description: "BISO Sites Documentation",
    };
  }

  const page = source.getPage(params.slug);
  if (!page) notFound();

  const image = getPageImage(page);

  return {
    title: page.data.title,
    description: page.data.description,
    openGraph: {
      images: image.url,
    },
  };
}

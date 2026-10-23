import { z } from "zod";
import { requireApiAuth } from "@/lib/api-auth";
import { contentLocaleSchema } from "@/lib/content-translation.server";
import { translatePageDocument } from "@/lib/page-document-translation";
import { hasNavAccess } from "@/lib/roles";

export const maxDuration = 120;

const pageDocumentSchema = z
  .object({
    meta: z
      .object({
        accentColor: z.string(),
        department: z.string(),
        description: z.string().optional(),
        slug: z.string(),
        status: z.enum(["draft", "published"]),
        title: z.string(),
      })
      .passthrough(),
    sections: z.array(z.unknown()),
    version: z.literal(2),
  })
  .passthrough();

const requestSchema = z
  .object({
    pageData: pageDocumentSchema,
    sourceLocale: contentLocaleSchema,
    targetLocale: contentLocaleSchema,
  })
  .refine((value) => value.sourceLocale !== value.targetLocale);

export async function POST(req: Request) {
  const auth = await requireApiAuth();
  if (auth.response) {
    return auth.response;
  }
  if (
    !hasNavAccess(
      "portal.pages",
      auth.ctx.roles,
      auth.ctx.departmentTeamIds.length > 0
    )
  ) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  let requestBody: unknown;
  try {
    requestBody = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(requestBody);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid translation request" },
      { status: 400 }
    );
  }

  const { pageData, sourceLocale, targetLocale } = parsed.data;
  const translatedDocument = await translatePageDocument({
    document: pageData,
    sourceLocale,
    targetLocale,
  });

  return Response.json({ translatedDocument });
}

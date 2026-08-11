import { PlateContentRenderer } from "@repo/ui/components/plate-content-renderer";
import Image from "next/image";
import type { NewsFormValues } from "../../../_actions/schemas";
import { formatNewsPreviewDate, type NewsLocale } from "./news-studio-state";

interface NewsStudioPreviewProps {
  campusName: string;
  departmentName: string;
  locale: NewsLocale;
  previewTimestamp: string;
  values: NewsFormValues;
}

export function NewsStudioPreview({
  campusName,
  departmentName,
  locale,
  previewTimestamp,
  values,
}: NewsStudioPreviewProps) {
  const title = locale === "no" ? values.title_no : values.title_en;
  const description =
    locale === "no" ? values.description_no : values.description_en;

  return (
    <div className="mx-auto w-full max-w-xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-slate-950/10 shadow-xl">
      {values.image ? (
        <div className="relative h-52 overflow-hidden">
          <Image
            alt={title || "Article cover"}
            className="object-cover"
            fill
            sizes="(max-width: 1024px) 100vw, 440px"
            src={values.image}
          />
        </div>
      ) : (
        <div className="grid h-36 place-items-center bg-[#001731] text-white/70">
          Cover image
        </div>
      )}
      <article className="space-y-4 p-6">
        <p className="text-[11px] text-slate-500 uppercase tracking-[0.14em]">
          {[campusName, departmentName, values.category]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <h2 className="font-light text-4xl text-[#07111f] leading-none tracking-tight">
          {title || "Article headline"}
        </h2>
        <p className="text-slate-500 text-sm">
          {values.author || "BISO"} ·{" "}
          {formatNewsPreviewDate(previewTimestamp, locale)}
        </p>
        <PlateContentRenderer
          className="prose-sm text-slate-700"
          value={description}
        />
      </article>
    </div>
  );
}

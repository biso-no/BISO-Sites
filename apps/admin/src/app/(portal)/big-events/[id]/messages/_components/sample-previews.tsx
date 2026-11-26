"use client";

import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import type { MessageLocale } from "@/lib/big-events/messages/draft";
import type { MessageSample } from "@/lib/big-events/messages/preview";
import { STUDIO } from "../../../../_components/studio";
import { LABEL_CLASS } from "./ui";

const LANGUAGES: readonly MessageLocale[] = ["no", "en"];

interface SamplePreviewsProps {
  samples: MessageSample[];
  warnings: string[];
}

/**
 * The message as people get it (ruling R23): one sample per bus or room the
 * text differs by, in both languages, and the details the text needs but
 * some buses or people lack.
 */
export function SamplePreviews({ samples, warnings }: SamplePreviewsProps) {
  const t = useTranslations("adminPortal.bigEvents.messages");
  if (samples.length === 0 && warnings.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-col gap-4">
      {warnings.length > 0 && (
        <section
          className="rounded-xl px-4 py-3"
          style={{
            background: "rgba(176,138,62,0.1)",
            border: `0.5px solid ${STUDIO.gold}`,
          }}
        >
          <h4
            className="flex items-center gap-2 font-medium text-sm"
            style={{ color: STUDIO.ink }}
          >
            <AlertTriangle
              aria-hidden
              size={14}
              style={{ color: STUDIO.gold }}
            />
            {t("check.warnings")}
          </h4>
          <ul className="mt-1.5 list-disc pl-5 text-sm leading-6">
            {warnings.map((warning, index) => (
              // Two campuses can each have a "Buss 1".
              <li key={`${index}-${warning}`} style={{ color: STUDIO.ink2 }}>
                {warning}
              </li>
            ))}
          </ul>
        </section>
      )}
      {samples.length > 0 && (
        <section className="flex flex-col gap-3">
          <div>
            <h4 className="font-medium text-sm" style={{ color: STUDIO.ink }}>
              {t("check.preview")}
            </h4>
            <p className="text-xs" style={{ color: STUDIO.ink4 }}>
              {t("check.previewHelp")}
            </p>
          </div>
          {samples.map((sample, index) => (
            <article
              className="rounded-xl px-4 py-3"
              key={`${index}-${sample.label}`}
              style={{
                background: STUDIO.white,
                border: `0.5px solid ${STUDIO.rule}`,
              }}
            >
              <h5 className={LABEL_CLASS}>{sample.label}</h5>
              <div className="mt-2 grid gap-4 md:grid-cols-2">
                {LANGUAGES.map((language) => (
                  <div key={language} lang={language === "no" ? "nb" : "en"}>
                    <p className="text-xs" style={{ color: STUDIO.ink4 }}>
                      {t(`languages.${language}`)}
                    </p>
                    <p
                      className="font-medium text-sm"
                      style={{ color: STUDIO.ink }}
                    >
                      {sample.text[language].title}
                    </p>
                    <p
                      className="whitespace-pre-wrap text-sm leading-6"
                      style={{ color: STUDIO.ink2 }}
                    >
                      {sample.text[language].body}
                    </p>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}

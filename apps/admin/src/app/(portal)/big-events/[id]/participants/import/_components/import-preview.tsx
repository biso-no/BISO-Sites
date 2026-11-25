"use client";

import { Info, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { ImportPreview as Preview } from "@/lib/big-events/import/plan-summary";
import {
  SERIF_STACK,
  STUDIO,
  StudioPanel,
} from "../../../../../_components/studio";

interface ImportPreviewProps {
  preview: Preview;
}

const WARNING_STYLE = {
  background: "rgba(176,138,62,0.09)",
  borderColor: "rgba(176,138,62,0.24)",
  color: "#6a5118",
};
const NOTE_STYLE = {
  background: STUDIO.paper2,
  borderColor: STUDIO.rule,
  color: STUDIO.ink2,
};

function Notice({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "warning" | "note";
}) {
  const Icon = tone === "warning" ? TriangleAlert : Info;
  return (
    <p
      className="flex items-start gap-2 rounded-xl border px-4 py-3 text-sm leading-6"
      style={tone === "warning" ? WARNING_STYLE : NOTE_STYLE}
    >
      <Icon aria-hidden className="mt-1 shrink-0" size={15} />
      <span>{children}</span>
    </p>
  );
}

/** A collapsed list with "and N more" when the server cut it short. */
function NameList({
  help,
  items,
  title,
  total,
}: {
  help?: string;
  items: string[];
  title: string;
  total: number;
}) {
  const t = useTranslations("adminPortal.bigEvents.import.preview");
  if (total === 0) {
    return null;
  }
  return (
    <details
      className="border-t px-5 py-3 first:border-t-0"
      style={{ borderColor: STUDIO.rule }}
    >
      <summary
        className="cursor-pointer font-medium text-sm"
        style={{ color: STUDIO.ink }}
      >
        {title}
      </summary>
      {help && (
        <p className="mt-2 text-sm leading-6" style={{ color: STUDIO.ink3 }}>
          {help}
        </p>
      )}
      <ul className="mt-2 columns-1 gap-6 text-sm sm:columns-2">
        {items.map((item, position) => (
          <li
            className="break-inside-avoid py-0.5"
            key={`${position}-${item}`}
            style={{ color: STUDIO.ink2 }}
          >
            {item}
          </li>
        ))}
      </ul>
      {total > items.length && (
        <p className="mt-1 text-xs" style={{ color: STUDIO.ink4 }}>
          {t("more", { count: total - items.length })}
        </p>
      )}
    </details>
  );
}

/** Step 3: what saving will do, in plain counts, before anything is written. */
export function ImportPreview({ preview }: ImportPreviewProps) {
  const t = useTranslations("adminPortal.bigEvents.import.preview");
  const summary = [
    t("created", { count: preview.created }),
    t("updated", { count: preview.updated }),
    ...(preview.unchanged > 0
      ? [t("unchanged", { count: preview.unchanged })]
      : []),
    ...(preview.missing > 0 ? [t("missing", { count: preview.missing })] : []),
    ...(preview.skipped > 0 ? [t("skipped", { count: preview.skipped })] : []),
  ];
  const groupLines = [
    ...(preview.newGroups > 0
      ? [t(`newGroups.${preview.groupKind}`, { count: preview.newGroups })]
      : []),
    ...(preview.moved > 0
      ? [t(`moved.${preview.groupKind}`, { count: preview.moved })]
      : []),
    ...(preview.keptPinned > 0
      ? [t("keptPinned", { count: preview.keptPinned })]
      : []),
  ];
  const hasLists =
    preview.created + preview.unplaced + preview.missing + preview.skipped > 0;
  const nothingNew =
    preview.created === 0 &&
    preview.updated === 0 &&
    preview.placed === 0 &&
    preview.moved === 0 &&
    preview.busNotices === 0;

  return (
    <div className="flex flex-col gap-4">
      <StudioPanel className="px-5 py-5">
        <p
          className="text-2xl leading-snug"
          style={{ color: STUDIO.ink, fontFamily: SERIF_STACK }}
        >
          {summary.join(" · ")}
        </p>
        {groupLines.length > 0 && (
          <p className="mt-2 text-sm" style={{ color: STUDIO.ink2 }}>
            {groupLines.join(" · ")}
          </p>
        )}
        {nothingNew && (
          <p className="mt-2 text-sm" style={{ color: STUDIO.ink3 }}>
            {t("nothingNew")}
          </p>
        )}
      </StudioPanel>

      {preview.outsideYourCampus > 0 && (
        <Notice tone="warning">
          {t("outsideYourCampus", { count: preview.outsideYourCampus })}
        </Notice>
      )}
      {preview.busNotices > 0 && (
        <Notice tone="note">
          {t("busNotices", { count: preview.busNotices })}
        </Notice>
      )}
      {preview.overfullRooms.length > 0 && (
        <Notice tone="warning">
          {t("overfull", {
            count: preview.overfullRooms.length,
            names: preview.overfullRooms.join(", "),
          })}
        </Notice>
      )}
      {preview.noCampus > 0 && (
        <Notice tone="warning">
          {t("noCampus", { count: preview.noCampus })}
        </Notice>
      )}
      {preview.duplicatesInFile > 0 && (
        <Notice tone="note">
          {t("duplicates", { count: preview.duplicatesInFile })}
        </Notice>
      )}

      {hasLists && (
        <StudioPanel>
          <NameList
            items={preview.createdNames}
            title={`${t("createdList")} (${preview.created})`}
            total={preview.created}
          />
          <NameList
            help={t("unplacedHelp")}
            items={preview.unplacedNames}
            title={t("unplaced", { count: preview.unplaced })}
            total={preview.unplaced}
          />
          <NameList
            help={t("missingHelp", { count: preview.missing })}
            items={preview.missingNames}
            title={`${t("missingList")} (${preview.missing})`}
            total={preview.missing}
          />
          <NameList
            items={preview.skippedRows.map((row) =>
              t("skippedRow", { reason: row.reason, row: row.rowNumber })
            )}
            title={`${t("skippedList")} (${preview.skipped})`}
            total={preview.skipped}
          />
        </StudioPanel>
      )}
    </div>
  );
}

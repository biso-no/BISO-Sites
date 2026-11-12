import { useLocale, useTranslations } from "next-intl";
import { MONO_STACK, STUDIO, StudioPanel } from "../../../_components/studio";
import {
  fmtDate,
  fmtNOK,
  normalizeLocale,
} from "../../../shop/_components/shop-studio-theme";
import type { ExpenseDetailReceipt } from "../../expenses-data";

interface Props {
  expenseId: string;
  receipts: ExpenseDetailReceipt[];
}

const COLUMNS = [
  "preview",
  "date",
  "description",
  "amount",
  "type",
  "account",
  "ai",
  "booked",
] as const;

/** The type column: the student's own words in quotes, else the type label. */
function typeText(r: ExpenseDetailReceipt): string | null {
  if (r.isSupporting) {
    return "";
  }
  if (r.costTypeText) {
    return `“${r.costTypeText}”`;
  }
  return r.costTypeLabel ?? r.costType;
}

export function ExpenseReceipts({ expenseId, receipts }: Props) {
  const t = useTranslations("adminPortal.expenses");
  const locale = normalizeLocale(useLocale());
  const date = (iso: string | null) => (iso ? fmtDate(iso, locale) : t("none"));

  return (
    <StudioPanel className="mt-4">
      <h3 className="px-5 pt-4 font-medium text-[14px]">
        {t("detail.receiptsTitle")}
      </h3>
      {receipts.length === 0 ? (
        <p className="px-5 py-4 text-[13px]" style={{ color: STUDIO.ink3 }}>
          {t("detail.noReceipts")}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="mt-2 w-full text-left text-[13px]">
            <thead>
              <tr style={{ color: STUDIO.ink4 }}>
                {COLUMNS.map((c) => (
                  <th
                    className="px-3 py-2 font-medium text-[11px] uppercase tracking-[0.05em]"
                    key={c}
                    scope="col"
                    style={{ fontFamily: MONO_STACK }}
                  >
                    {t(`receipts.${c}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {receipts.map((r) => (
                <tr
                  key={r.id}
                  style={{ borderTop: `0.5px solid ${STUDIO.rule}` }}
                >
                  <td className="px-3 py-2">
                    {r.fileId && (
                      <a
                        aria-label={t("receipts.previewLabel", {
                          name: r.description ?? r.id,
                        })}
                        className="underline"
                        href={`/api/expenses/${expenseId}/files/${r.fileId}`}
                        rel="noopener"
                        target="_blank"
                      >
                        {t("receipts.preview")}
                      </a>
                    )}
                  </td>
                  <td className="px-3 py-2">{date(r.date)}</td>
                  <td
                    className="px-3 py-2"
                    style={{
                      paddingLeft: r.isSupporting ? "1.75rem" : undefined,
                    }}
                  >
                    {r.description}
                    {r.isSupporting && (
                      <span
                        className="block text-[11px]"
                        style={{ color: STUDIO.ink4 }}
                      >
                        {t("receipts.supporting")}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {r.amount === null ? t("none") : fmtNOK(r.amount)}
                  </td>
                  <td className="px-3 py-2">{typeText(r) ?? t("none")}</td>
                  <td className="px-3 py-2">
                    {r.accountNumber === null ? (
                      t("none")
                    ) : (
                      <>
                        <span style={{ fontFamily: MONO_STACK }}>
                          {r.accountNumber}
                        </span>
                        {r.accountName ? ` ${r.accountName}` : ""}
                      </>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {r.aiCostType && (
                      <span className="block">
                        {t("receipts.aiType", {
                          confidence: Math.round((r.aiConfidence ?? 0) * 100),
                          type: r.aiCostType,
                        })}
                      </span>
                    )}
                    {r.receiptIssues.map((issue) => (
                      <span className="block" key={issue}>
                        {t(`issues.${issue}`)}
                      </span>
                    ))}
                  </td>
                  <td className="px-3 py-2">{date(r.bookedDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </StudioPanel>
  );
}

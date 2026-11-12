import { useLocale, useTranslations } from "next-intl";
import { MONO_STACK, STUDIO, StudioPanel } from "../../../_components/studio";
import type { ExpenseDetailEvent } from "../../expenses-data";
import { describeEvent } from "../../history-model";
import { formatDateTime } from "./expense-steps";

export function ExpenseHistory({ events }: { events: ExpenseDetailEvent[] }) {
  const t = useTranslations("adminPortal.expenses");
  const locale = useLocale();
  const labels = {
    reason: t("history.reason"),
    roles: {
      controller: t("roles.controller"),
      deputy: t("roles.deputy"),
      finance: t("roles.finance"),
      manager: t("roles.manager"),
      national: t("roles.national"),
      president: t("roles.president"),
    },
  };
  return (
    <StudioPanel className="mt-4 p-5">
      <h3 className="font-medium text-[14px]">{t("detail.historyTitle")}</h3>
      {events.length === 0 ? (
        <p className="mt-2 text-[13px]" style={{ color: STUDIO.ink3 }}>
          {t("detail.noHistory")}
        </p>
      ) : (
        <ol className="mt-3 space-y-2">
          {events.map((event) => {
            const { key, values } = describeEvent(event, labels);
            const actor = event.actorName ?? event.actorEmail ?? "";
            return (
              <li className="text-[13px]" key={event.id}>
                <span style={{ color: STUDIO.ink4, fontFamily: MONO_STACK }}>
                  {formatDateTime(event.at, locale)}
                </span>{" "}
                <span className="font-medium">
                  {actor || t(`actorKinds.${event.actorKind}` as never)}
                </span>
                {": "}
                {t(`history.${key}` as never, values as never)}
              </li>
            );
          })}
        </ol>
      )}
    </StudioPanel>
  );
}

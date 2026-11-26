"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";
import { FIELD_CLASS, LABEL_CLASS, Pill } from "./ui";

export type SendMode = "now" | "schedule";

interface ScheduleControlProps {
  /** Oslo date, `YYYY-MM-DD`. */
  date: string;
  mode: SendMode;
  onDate: (date: string) => void;
  onMode: (mode: SendMode) => void;
  onTime: (time: string) => void;
  /** Oslo time, `HH:mm`. */
  time: string;
}

/** Send now, or at a date and time in Oslo (as the communications composer). */
export function ScheduleControl({
  date,
  mode,
  onDate,
  onMode,
  onTime,
  time,
}: ScheduleControlProps) {
  const t = useTranslations("adminPortal.bigEvents.messages.check");
  const id = useId();
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className={`${LABEL_CLASS} mb-2`}>{t("when")}</legend>
      <div className="flex gap-2">
        <Pill active={mode === "now"} onClick={() => onMode("now")}>
          {t("now")}
        </Pill>
        <Pill active={mode === "schedule"} onClick={() => onMode("schedule")}>
          {t("schedule")}
        </Pill>
      </div>
      {mode === "schedule" && (
        <div className="grid max-w-sm grid-cols-[1fr_8rem] gap-2">
          <div className="flex flex-col gap-1.5">
            <label className={LABEL_CLASS} htmlFor={`${id}-date`}>
              {t("date")}
            </label>
            <input
              aria-label={t("date")}
              className={FIELD_CLASS}
              id={`${id}-date`}
              onChange={(event) => onDate(event.target.value)}
              type="date"
              value={date}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={LABEL_CLASS} htmlFor={`${id}-time`}>
              {t("time")}
            </label>
            <input
              aria-label={t("time")}
              className={FIELD_CLASS}
              id={`${id}-time`}
              onChange={(event) => onTime(event.target.value)}
              type="time"
              value={time}
            />
          </div>
        </div>
      )}
    </fieldset>
  );
}

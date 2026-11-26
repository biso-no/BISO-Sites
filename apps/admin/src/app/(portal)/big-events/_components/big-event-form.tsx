"use client";

import {
  BIG_EVENT_STATUSES,
  type BigEventStatus,
} from "@repo/shared/big-events/tables";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  type FormEvent,
  useCallback,
  useId,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import {
  type AutoTextsForm,
  autoTextsPayload,
} from "@/lib/big-events/auto-message-texts";
import { joinOsloDateTime, splitOsloDateTime } from "@/lib/big-events/dates";
import {
  type BigEventFormField,
  type BigEventUpdateValues,
  bigEventUpdateSchema,
} from "@/lib/big-events/form-schema";
import { autoTextsColumn } from "@/lib/big-events/messages/auto-texts";
import { createBigEvent, updateBigEvent } from "../../_actions/big-events";
import { DepartmentCombobox } from "../../_components/department-combobox";
import { ImageUploadField } from "../../_components/image-upload-field";
import { PortalButton } from "../../_components/portal-button";
import {
  PortalField,
  PortalInput,
  PortalSelect,
} from "../../_components/portal-fields";
import { STUDIO, StudioCard, StudioLinkButton } from "../../_components/studio";
import { AutoMessagesSection } from "./auto-messages-section";
import { SwitchRow } from "./switch-row";

type FieldErrors = Partial<Record<BigEventFormField, string>>;
interface DateTimeParts {
  date: string;
  time: string;
}

interface BigEventFormProps {
  /**
   * Settings only: the automatic messages' texts in use and their defaults,
   * read by the page (the parser is server-only).
   */
  autoMessages?: { defaults: AutoTextsForm; texts: AutoTextsForm };
  /** Set on the settings page; absent when creating. */
  bigEventId?: string;
  campusLocked: boolean;
  campusOptions: { label: string; value: string }[];
  initial: BigEventUpdateValues;
}

function firstErrorPerField(
  issues: { path: PropertyKey[] }[],
  message: (field: BigEventFormField) => string
): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of issues) {
    const field = issue.path[0] as BigEventFormField | undefined;
    if (field && !errors[field]) {
      errors[field] = message(field);
    }
  }
  return errors;
}

export function BigEventForm({
  autoMessages,
  bigEventId,
  campusLocked,
  campusOptions,
  initial,
}: BigEventFormProps) {
  const t = useTranslations("adminPortal.bigEvents");
  const tc = useTranslations("adminPortal.common");
  const router = useRouter();
  const id = useId();
  const [values, setValues] = useState<BigEventUpdateValues>(initial);
  const [start, setStart] = useState<DateTimeParts>(() =>
    splitOsloDateTime(initial.starts_at)
  );
  const [end, setEnd] = useState<DateTimeParts>(() =>
    splitOsloDateTime(initial.ends_at)
  );
  const [autoTexts, setAutoTexts] = useState(autoMessages?.texts ?? null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isPending, startTransition] = useTransition();
  const isSettings = bigEventId !== undefined;

  const update = <K extends keyof BigEventUpdateValues>(
    key: K,
    value: BigEventUpdateValues[K]
  ) => setValues((prev) => ({ ...prev, [key]: value }));

  const handleBoardChange = useCallback(
    (departmentId: string | null) =>
      setValues((prev) => ({ ...prev, department_id: departmentId })),
    []
  );

  /** The automatic texts refused, as the sentence shown under them. */
  function refuseAutoTexts(error: "too_long" | "unknown_placeholder") {
    const message = t(`form.errors.auto_${error}`);
    setErrors({ auto_texts: message });
    toast.error(message);
  }

  function save(candidate: BigEventUpdateValues) {
    // The create form carries the default status too; the server ignores it.
    const parsed = bigEventUpdateSchema.safeParse(candidate);
    if (!parsed.success) {
      setErrors(
        firstErrorPerField(parsed.error.issues, (field) =>
          t(`form.errors.${field}`)
        )
      );
      return;
    }
    // The same check the server makes, so the reason shows before saving.
    const texts =
      parsed.data.auto_texts === undefined
        ? null
        : autoTextsColumn(parsed.data.auto_texts);
    if (texts && !texts.ok) {
      refuseAutoTexts(texts.error);
      return;
    }
    setErrors({});
    startTransition(async () => {
      try {
        if (bigEventId) {
          const result = await updateBigEvent(bigEventId, parsed.data);
          if (!result.ok) {
            refuseAutoTexts(result.error);
            return;
          }
          toast.success(t("form.saved"));
          router.refresh();
          return;
        }
        const { id: newId } = await createBigEvent(parsed.data);
        toast.success(t("form.created"));
        router.push(`/big-events/${newId}/settings`);
      } catch {
        toast.error(t("form.saveFailed"));
      }
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    save({
      ...values,
      ...(autoMessages && autoTexts
        ? { auto_texts: autoTextsPayload(autoTexts, autoMessages.defaults) }
        : {}),
      ends_at: joinOsloDateTime(end.date, end.time),
      starts_at: joinOsloDateTime(start.date, start.time),
    });
  }

  return (
    <form noValidate onSubmit={handleSubmit}>
      <StudioCard className="flex flex-col gap-6 p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <PortalField error={errors.name_no} label={t("form.nameNo")} required>
            <PortalInput
              aria-label={t("form.nameNo")}
              error={Boolean(errors.name_no)}
              maxLength={200}
              onChange={(e) => update("name_no", e.target.value)}
              placeholder={t("form.nameNoPlaceholder")}
              value={values.name_no}
            />
          </PortalField>
          <PortalField
            error={errors.name_en}
            hint={t("form.nameEnHelp")}
            label={t("form.nameEn")}
          >
            <PortalInput
              aria-label={t("form.nameEn")}
              error={Boolean(errors.name_en)}
              maxLength={200}
              onChange={(e) => update("name_en", e.target.value)}
              value={values.name_en}
            />
          </PortalField>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <PortalField
            error={errors.campus_id}
            hint={campusLocked ? t("form.campusLocked") : undefined}
            label={t("form.campus")}
            required
          >
            <PortalSelect
              aria-label={t("form.campus")}
              disabled={campusLocked}
              error={Boolean(errors.campus_id)}
              onChange={(e) =>
                update(
                  "campus_id",
                  e.target.value as BigEventUpdateValues["campus_id"]
                )
              }
              options={campusOptions}
              value={values.campus_id}
            />
          </PortalField>
          <PortalField error={errors.department_id} hint={t("form.boardHelp")}>
            <DepartmentCombobox
              campusId={values.campus_id}
              label={t("form.board")}
              onChange={handleBoardChange}
              placeholder={t("form.boardPlaceholder")}
              value={values.department_id}
            />
          </PortalField>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <DateTimeField
            dateLabel={t("form.date")}
            error={errors.starts_at}
            label={t("form.startsAt")}
            onChange={setStart}
            timeLabel={t("form.time")}
            value={start}
          />
          <DateTimeField
            dateLabel={t("form.date")}
            error={errors.ends_at}
            label={t("form.endsAt")}
            onChange={setEnd}
            timeLabel={t("form.time")}
            value={end}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <PortalField error={errors.place_name} label={t("form.placeName")}>
            <PortalInput
              aria-label={t("form.placeName")}
              error={Boolean(errors.place_name)}
              maxLength={200}
              onChange={(e) => update("place_name", e.target.value)}
              placeholder={t("form.placeNamePlaceholder")}
              value={values.place_name}
            />
          </PortalField>
          <PortalField
            error={errors.place_address}
            label={t("form.placeAddress")}
          >
            <PortalInput
              aria-label={t("form.placeAddress")}
              error={Boolean(errors.place_address)}
              maxLength={300}
              onChange={(e) => update("place_address", e.target.value)}
              value={values.place_address}
            />
          </PortalField>
        </div>

        <PortalField
          error={errors.hero_image_url}
          hint={t("form.heroImageHelp")}
          label={t("form.heroImage")}
        >
          <ImageUploadField
            label={t("form.heroImage")}
            onChange={(url) => update("hero_image_url", url ?? "")}
            value={values.hero_image_url || null}
          />
        </PortalField>

        <div className="grid gap-4 md:grid-cols-2">
          <SwitchRow
            checked={values.travel_enabled}
            help={t("form.travelHelp")}
            id={`${id}-travel`}
            label={t("form.travel")}
            onChange={(checked) => update("travel_enabled", checked)}
          />
          <SwitchRow
            checked={values.group_checkin_enabled}
            help={t("form.groupCheckinHelp")}
            id={`${id}-group-checkin`}
            label={t("form.groupCheckin")}
            onChange={(checked) => update("group_checkin_enabled", checked)}
          />
        </div>

        {isSettings && (
          <div className="md:w-1/2 md:pr-2">
            <PortalField hint={t("form.statusHelp")} label={t("form.status")}>
              <PortalSelect
                aria-label={t("form.status")}
                onChange={(e) =>
                  update("status", e.target.value as BigEventStatus)
                }
                options={BIG_EVENT_STATUSES.map((status) => ({
                  label: t(`status.${status}`),
                  value: status,
                }))}
                value={values.status}
              />
            </PortalField>
          </div>
        )}

        {isSettings && autoMessages && autoTexts && (
          <AutoMessagesSection
            defaults={autoMessages.defaults}
            error={
              errors.auto_texts ??
              errors.auto_bus_assigned ??
              errors.auto_bus_moved ??
              errors.auto_departure_reminder
            }
            onSwitch={update}
            onTexts={setAutoTexts}
            switches={{
              auto_bus_assigned: values.auto_bus_assigned ?? true,
              auto_bus_moved: values.auto_bus_moved ?? true,
              auto_departure_reminder: values.auto_departure_reminder ?? true,
            }}
            texts={autoTexts}
            travel={values.travel_enabled}
          />
        )}

        <div
          className="flex items-center justify-end gap-2 border-t pt-5"
          style={{ borderColor: STUDIO.rule }}
        >
          {!isSettings && (
            <StudioLinkButton href="/big-events" variant="ghost">
              {tc("cancel")}
            </StudioLinkButton>
          )}
          <PortalButton loading={isPending} type="submit" variant="primary">
            {isSettings ? t("form.save") : t("form.create")}
          </PortalButton>
        </div>
      </StudioCard>
    </form>
  );
}

function DateTimeField({
  dateLabel,
  error,
  label,
  onChange,
  timeLabel,
  value,
}: {
  dateLabel: string;
  error?: string;
  label: string;
  onChange: (value: DateTimeParts) => void;
  timeLabel: string;
  value: DateTimeParts;
}) {
  return (
    <PortalField error={error} label={label} required>
      <div className="grid grid-cols-[1fr_8rem] gap-2">
        <PortalInput
          aria-label={`${label}: ${dateLabel}`}
          error={Boolean(error)}
          onChange={(e) => onChange({ ...value, date: e.target.value })}
          type="date"
          value={value.date}
        />
        <PortalInput
          aria-label={`${label}: ${timeLabel}`}
          error={Boolean(error)}
          onChange={(e) => onChange({ ...value, time: e.target.value })}
          type="time"
          value={value.time}
        />
      </div>
    </PortalField>
  );
}

"use client";

import type { GroupKind } from "@repo/shared/big-events/tables";
import { useTranslations } from "next-intl";
import {
  IMPORT_FIELDS,
  type ImportField,
} from "@/lib/big-events/import/field-aliases";
import type { ImportColumns } from "@/lib/big-events/import/import-columns";
import type { ParticipantCampusId } from "@/lib/big-events/participant-form";
import {
  PortalField,
  PortalSelect,
} from "../../../../../_components/portal-fields";
import { STUDIO, StudioPanel } from "../../../../../_components/studio";

/** A campus the organizer may give rows without one; `null` is "no campus". */
export interface CampusChoice {
  label: string;
  value: ParticipantCampusId | null;
}

/** The choices under the columns. */
export interface ImportSettings {
  defaultCampusId: ParticipantCampusId | null;
  /** What a "Room, bus or group" column holds. */
  groupKind: GroupKind;
  /** "Each row is a room booking". */
  roomBookings: boolean;
}

interface ColumnMappingProps {
  campusChoices: CampusChoice[];
  columns: ImportColumns;
  groupKinds: GroupKind[];
  mapping: ImportField[];
  onFieldChange: (index: number, field: ImportField) => void;
  onSettingsChange: (settings: ImportSettings) => void;
  settings: ImportSettings;
}

const EXAMPLES_PER_COLUMN = 2;
const LETTERS = 26;
const NO_CAMPUS = "";

/** Spreadsheet column letters: 0 → A, 25 → Z, 26 → AA. */
function columnLetter(index: number): string {
  let letter = "";
  let rest = index + 1;
  while (rest > 0) {
    const digit = (rest - 1) % LETTERS;
    letter = String.fromCharCode(65 + digit) + letter;
    rest = Math.floor((rest - 1) / LETTERS);
  }
  return letter;
}

function examplesFor(columns: ImportColumns, index: number): string[] {
  return columns.sample
    .map((row) => row[index] ?? "")
    .filter((value) => value !== "")
    .slice(0, EXAMPLES_PER_COLUMN);
}

interface ColumnRowProps {
  detectedField: ImportField;
  examples: string[];
  field: ImportField;
  header: string;
  index: number;
  onChange: (field: ImportField) => void;
}

function ColumnRow({
  detectedField,
  examples,
  field,
  header,
  index,
  onChange,
}: ColumnRowProps) {
  const t = useTranslations("adminPortal.bigEvents.import.columns");
  const heading = header || t("noHeading");
  return (
    <li
      className="grid gap-3 border-t px-5 py-4 first:border-t-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.3fr)] md:items-start"
      style={{ borderColor: STUDIO.rule }}
    >
      <div className="min-w-0">
        <p
          className="break-words font-medium text-sm"
          style={{ color: STUDIO.ink }}
        >
          {heading}
        </p>
        <p className="mt-0.5 text-xs" style={{ color: STUDIO.ink4 }}>
          {t("column", { letter: columnLetter(index) })}
        </p>
      </div>
      <div className="min-w-0 text-sm" style={{ color: STUDIO.ink2 }}>
        <p className="text-xs" style={{ color: STUDIO.ink4 }}>
          {t("examples")}
        </p>
        {examples.length > 0 ? (
          examples.map((example, position) => (
            <p
              className="truncate"
              key={`${position}-${example}`}
              title={example}
            >
              {example}
            </p>
          ))
        ) : (
          <p style={{ color: STUDIO.ink4 }}>{t("noExamples")}</p>
        )}
      </div>
      <div className="min-w-0">
        <PortalSelect
          aria-label={t("fieldLabel", { header: heading })}
          onChange={(e) => onChange(e.target.value as ImportField)}
          options={IMPORT_FIELDS.map((option) => ({
            label: t(`fields.${option}`),
            value: option,
          }))}
          value={field}
        />
        {field === detectedField && (
          <p
            className="mt-1.5 text-xs leading-5"
            style={{ color: STUDIO.ink3 }}
          >
            {t(`looksLike.${field}`)}
          </p>
        )}
      </div>
    </li>
  );
}

interface SettingsProps {
  campusChoices: CampusChoice[];
  campusFound: boolean;
  groupHeader: string | null;
  groupKinds: GroupKind[];
  onChange: (settings: ImportSettings) => void;
  settings: ImportSettings;
  showRoomBookings: boolean;
}

function ImportChoices({
  campusChoices,
  campusFound,
  groupHeader,
  groupKinds,
  onChange,
  settings,
  showRoomBookings,
}: SettingsProps) {
  const t = useTranslations("adminPortal.bigEvents.import.columns");
  const update = <K extends keyof ImportSettings>(
    key: K,
    value: ImportSettings[K]
  ) => onChange({ ...settings, [key]: value });

  return (
    <StudioPanel className="mt-5 p-5">
      <h3 className="mb-4 font-medium text-sm" style={{ color: STUDIO.ink }}>
        {t("settings")}
      </h3>
      <div className="grid gap-5 md:grid-cols-2">
        {campusChoices.length > 0 && (
          <PortalField
            hint={t("campusHelp")}
            label={campusFound ? t("campusSome") : t("campusMissing")}
          >
            <PortalSelect
              aria-label={campusFound ? t("campusSome") : t("campusMissing")}
              disabled={campusChoices.length === 1}
              onChange={(e) =>
                update(
                  "defaultCampusId",
                  campusChoices.find(
                    (choice) => (choice.value ?? NO_CAMPUS) === e.target.value
                  )?.value ?? null
                )
              }
              options={campusChoices.map((choice) => ({
                label: choice.label,
                value: choice.value ?? NO_CAMPUS,
              }))}
              value={settings.defaultCampusId ?? NO_CAMPUS}
            />
          </PortalField>
        )}
        {groupHeader !== null && (
          <PortalField
            hint={t("groupKindHelp")}
            label={t("groupKind", { header: groupHeader })}
          >
            <PortalSelect
              aria-label={t("groupKind", { header: groupHeader })}
              onChange={(e) =>
                update(
                  "groupKind",
                  groupKinds.find((kind) => kind === e.target.value) ?? "room"
                )
              }
              options={groupKinds.map((kind) => ({
                label: t(`groupKinds.${kind}`),
                value: kind,
              }))}
              value={settings.groupKind}
            />
          </PortalField>
        )}
      </div>
      {showRoomBookings && (
        <label className="mt-5 flex cursor-pointer items-start gap-3 text-sm">
          <input
            checked={settings.roomBookings}
            className="mt-1 size-4 shrink-0 accent-[#6b1e1e]"
            onChange={(e) => update("roomBookings", e.target.checked)}
            type="checkbox"
          />
          <span>
            <span className="block" style={{ color: STUDIO.ink }}>
              {t("roomBookings")}
            </span>
            <span
              className="mt-0.5 block text-xs leading-5"
              style={{ color: STUDIO.ink3 }}
            >
              {t("roomBookingsHelp")}
            </span>
          </span>
        </label>
      )}
    </StudioPanel>
  );
}

/** Step 2: one row per column with what we read and a dropdown to change it. */
export function ColumnMapping({
  campusChoices,
  columns,
  groupKinds,
  mapping,
  onFieldChange,
  onSettingsChange,
  settings,
}: ColumnMappingProps) {
  const t = useTranslations("adminPortal.bigEvents.import.columns");
  const visible = columns.headers.flatMap((header, index) => {
    const examples = examplesFor(columns, index);
    return header !== "" || examples.length > 0
      ? [{ examples, header, index }]
      : [];
  });
  const groupIndex = mapping.indexOf("group");
  const groupHeader =
    groupIndex === -1
      ? null
      : columns.headers[groupIndex] ||
        t("column", { letter: columnLetter(groupIndex) });
  const campusFound =
    columns.detected.campus &&
    mapping.some((field) => field === "campus" || field === "ticket_category");

  return (
    <div>
      <p className="mb-4 text-sm leading-6" style={{ color: STUDIO.ink2 }}>
        {t("intro", { count: columns.rowCount })}
      </p>
      <StudioPanel>
        <ul>
          {visible.map(({ examples, header, index }) => (
            <ColumnRow
              detectedField={columns.mapping[index] ?? "ignore"}
              examples={examples}
              field={mapping[index] ?? "ignore"}
              header={header}
              index={index}
              key={index}
              onChange={(field) => onFieldChange(index, field)}
            />
          ))}
        </ul>
      </StudioPanel>
      <ImportChoices
        campusChoices={campusChoices}
        campusFound={campusFound}
        groupHeader={groupHeader}
        groupKinds={groupKinds}
        onChange={onSettingsChange}
        settings={settings}
        showRoomBookings={
          groupIndex === -1 && mapping.includes("ticket_category")
        }
      />
    </div>
  );
}

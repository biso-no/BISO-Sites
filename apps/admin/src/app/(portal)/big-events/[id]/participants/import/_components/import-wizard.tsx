"use client";

import type { GroupKind } from "@repo/shared/big-events/tables";
import { FileSpreadsheet, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  type ChangeEvent,
  type DragEvent,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import type { ImportField } from "@/lib/big-events/import/field-aliases";
import type { ImportColumns } from "@/lib/big-events/import/import-columns";
import type { ImportOptions } from "@/lib/big-events/import/plan-import";
import type { ImportPreview as Preview } from "@/lib/big-events/import/plan-summary";
import type { ParticipantCampusId } from "@/lib/big-events/participant-form";
import {
  applyImport,
  previewImport,
  readImportFile,
} from "../../../../../_actions/big-event-import";
import { PortalButton } from "../../../../../_components/portal-button";
import { PortalTextarea } from "../../../../../_components/portal-fields";
import { STUDIO, StudioPanel } from "../../../../../_components/studio";
import {
  type CampusChoice,
  ColumnMapping,
  type ImportSettings,
} from "./column-mapping";
import { ImportPreview } from "./import-preview";

interface ImportWizardProps {
  bigEventId: string;
  campusChoices: CampusChoice[];
  /** The big event's campus for a campus big event (ruling R16). */
  defaultCampusId: ParticipantCampusId | null;
  groupKinds: GroupKind[];
}

const STEPS = ["upload", "columns", "preview"] as const;
type Step = (typeof STEPS)[number];

/** The admin's server action body limit. */
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const READABLE_FILE = /\.(xlsx|csv)$/i;
const ACCEPT =
  ".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const BYTES_PER_KB = 1024;

function formatSize(bytes: number): string {
  const kb = bytes / BYTES_PER_KB;
  return kb < BYTES_PER_KB
    ? `${Math.max(1, Math.round(kb))} KB`
    : `${(kb / BYTES_PER_KB).toFixed(1)} MB`;
}

/** The step 2 problem that stops the import, if any. */
function missingColumn(
  mapping: ImportField[]
): "needName" | "needContact" | null {
  if (
    !mapping.some((field) => field === "first_name" || field === "full_name")
  ) {
    return "needName";
  }
  if (!mapping.some((field) => field === "email" || field === "phone")) {
    return "needContact";
  }
  return null;
}

/** A group column decides; without one, "each row is a room booking" may. */
function toOptions(
  settings: ImportSettings,
  mapping: ImportField[]
): ImportOptions {
  const groupColumn = mapping.includes("group");
  return {
    defaultCampusId: settings.defaultCampusId,
    groupKind: groupColumn ? settings.groupKind : null,
    roomBookings: !groupColumn && settings.roomBookings,
  };
}

function StepHeader({ step }: { step: Step }) {
  const t = useTranslations("adminPortal.bigEvents.import");
  const current = STEPS.indexOf(step);
  return (
    <ol className="mb-5 flex flex-wrap items-center gap-2 text-sm">
      {STEPS.map((name, index) => (
        <li
          aria-current={index === current ? "step" : undefined}
          className="flex items-center gap-2"
          key={name}
          style={{ color: index === current ? STUDIO.ink : STUDIO.ink4 }}
        >
          <span
            className="flex size-6 items-center justify-center rounded-full border font-medium text-xs"
            style={{
              background: index === current ? STUDIO.ink : "transparent",
              borderColor: index <= current ? STUDIO.ink : STUDIO.rule2,
              color: index === current ? STUDIO.paper : "inherit",
            }}
          >
            {index + 1}
          </span>
          <span className={index === current ? "font-medium" : ""}>
            {t(`steps.${name}`)}
          </span>
          {index < STEPS.length - 1 && (
            <span aria-hidden className="mx-1" style={{ color: STUDIO.rule2 }}>
              —
            </span>
          )}
        </li>
      ))}
      <li className="sr-only">{t("stepOf", { step: current + 1 })}</li>
    </ol>
  );
}

interface UploadStepProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
  onPasteChange: (text: string) => void;
  paste: string;
}

/** Step 1: a drop zone for the file, or rows pasted from a spreadsheet. */
function UploadStep({
  file,
  onFileChange,
  onPasteChange,
  paste,
}: UploadStepProps) {
  const t = useTranslations("adminPortal.bigEvents.import.upload");
  const inputRef = useRef<HTMLInputElement>(null);
  const pasteId = useId();
  const [isDragging, setIsDragging] = useState(false);

  function pick(candidate: File | undefined) {
    if (!candidate) {
      return;
    }
    if (!READABLE_FILE.test(candidate.name)) {
      toast.error(t("wrongType"));
      return;
    }
    if (candidate.size > MAX_FILE_BYTES) {
      toast.error(t("tooBig"));
      return;
    }
    onFileChange(candidate);
  }

  function handleInput(event: ChangeEvent<HTMLInputElement>) {
    pick(event.target.files?.[0]);
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setIsDragging(false);
    pick(event.dataTransfer.files?.[0]);
  }

  return (
    <div className="flex flex-col gap-5">
      <input
        accept={ACCEPT}
        className="sr-only"
        onChange={handleInput}
        ref={inputRef}
        tabIndex={-1}
        type="file"
      />
      {file ? (
        <div
          className="flex items-center gap-3 rounded-xl px-4 py-3"
          style={{
            background: "rgba(255,255,255,0.5)",
            border: `0.5px solid ${STUDIO.rule2}`,
          }}
        >
          <FileSpreadsheet
            aria-hidden
            className="shrink-0"
            size={22}
            style={{ color: STUDIO.leaf }}
          />
          <div className="min-w-0 flex-1">
            <p
              className="truncate font-medium text-sm"
              style={{ color: STUDIO.ink }}
            >
              {file.name}
            </p>
            <p className="text-xs" style={{ color: STUDIO.ink4 }}>
              {formatSize(file.size)}
            </p>
          </div>
          <button
            aria-label={t("chooseAnother")}
            className="shrink-0 rounded-lg p-1.5 transition-colors"
            onClick={() => onFileChange(null)}
            style={{ background: "rgba(107,30,30,0.10)", color: STUDIO.claret }}
            title={t("chooseAnother")}
            type="button"
          >
            <X aria-hidden size={14} />
          </button>
        </div>
      ) : (
        <>
          <button
            className="rounded-xl px-4 py-10 text-center transition-all"
            onClick={() => inputRef.current?.click()}
            onDragLeave={() => setIsDragging(false)}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDrop={handleDrop}
            style={{
              background: isDragging
                ? "rgba(107,30,30,0.06)"
                : "rgba(255,255,255,0.42)",
              border: `1px dashed ${isDragging ? STUDIO.claret : STUDIO.rule2}`,
            }}
            type="button"
          >
            <Upload
              aria-hidden
              className="mx-auto mb-2"
              size={24}
              style={{ color: STUDIO.ink4 }}
            />
            <span className="block text-sm" style={{ color: STUDIO.ink2 }}>
              {t("dropHere")}
            </span>
            <span className="mt-1 block text-xs" style={{ color: STUDIO.ink4 }}>
              {t("fileTypes")}
            </span>
          </button>
          <div className="flex flex-col gap-1.5">
            <label
              className="font-medium text-[11px] uppercase tracking-[0.06em]"
              htmlFor={pasteId}
              style={{ color: STUDIO.ink3 }}
            >
              {t("orPaste")}
            </label>
            <PortalTextarea
              className="font-mono text-xs"
              id={pasteId}
              onChange={(event) => onPasteChange(event.target.value)}
              placeholder={t("pastePlaceholder")}
              rows={6}
              value={paste}
            />
          </div>
        </>
      )}
      <p className="text-xs" style={{ color: STUDIO.ink3 }}>
        {t("privacy")}
      </p>
    </div>
  );
}

/**
 * The import wizard: upload, check the columns, check and save. It keeps the
 * file in the browser and sends it again at each step; the server keeps
 * nothing between steps and plans again before saving.
 */
export function ImportWizard({
  bigEventId,
  campusChoices,
  defaultCampusId,
  groupKinds,
}: ImportWizardProps) {
  const t = useTranslations("adminPortal.bigEvents.import");
  const router = useRouter();
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [paste, setPaste] = useState("");
  const [columns, setColumns] = useState<ImportColumns | null>(null);
  const [mapping, setMapping] = useState<ImportField[]>([]);
  const [settings, setSettings] = useState<ImportSettings>({
    defaultCampusId,
    groupKind: "room",
    roomBookings: false,
  });
  const [preview, setPreview] = useState<Preview | null>(null);
  const [problem, setProblem] = useState<"needName" | "needContact" | null>(
    null
  );
  const [isPending, startTransition] = useTransition();

  function source(): FormData {
    const form = new FormData();
    if (file) {
      form.set("file", file);
    } else {
      form.set("paste", paste);
    }
    return form;
  }

  function readList() {
    if (!(file || paste.trim())) {
      toast.error(t("upload.nothing"));
      return;
    }
    startTransition(async () => {
      try {
        const read = await readImportFile(bigEventId, source());
        if (read.rowCount === 0) {
          toast.error(t("upload.empty"));
          return;
        }
        setColumns(read);
        setMapping(read.mapping);
        setSettings((prev) => ({
          ...prev,
          groupKind: "room",
          roomBookings: read.detected.roomSizes && !read.detected.group,
        }));
        setProblem(null);
        setStep("columns");
      } catch {
        toast.error(t("upload.failed"));
      }
    });
  }

  function changeField(index: number, field: ImportField) {
    setMapping((prev) => prev.map((old, at) => (at === index ? field : old)));
    setProblem(null);
  }

  function checkImport() {
    const missing = missingColumn(mapping);
    setProblem(missing);
    if (missing) {
      return;
    }
    startTransition(async () => {
      try {
        setPreview(
          await previewImport(
            bigEventId,
            source(),
            { columns: mapping },
            toOptions(settings, mapping)
          )
        );
        setStep("preview");
      } catch {
        toast.error(t("columns.failed"));
      }
    });
  }

  function save() {
    startTransition(async () => {
      try {
        const result = await applyImport(
          bigEventId,
          source(),
          { columns: mapping },
          toOptions(settings, mapping)
        );
        toast.success(t("preview.saved", { linked: result.linked }));
        router.push(`/big-events/${bigEventId}/participants`);
      } catch {
        toast.error(t("preview.failed"));
      }
    });
  }

  return (
    <div>
      <StepHeader step={step} />

      {step === "upload" && (
        <StudioPanel className="p-5">
          <UploadStep
            file={file}
            onFileChange={setFile}
            onPasteChange={setPaste}
            paste={paste}
          />
          <div className="mt-5 flex justify-end">
            <PortalButton
              loading={isPending}
              onClick={readList}
              variant="primary"
            >
              {t("upload.read")}
            </PortalButton>
          </div>
        </StudioPanel>
      )}

      {step === "columns" && columns && (
        <>
          <ColumnMapping
            campusChoices={campusChoices}
            columns={columns}
            groupKinds={groupKinds}
            mapping={mapping}
            onFieldChange={changeField}
            onSettingsChange={setSettings}
            settings={settings}
          />
          {problem && (
            <p
              className="mt-4 text-sm"
              role="alert"
              style={{ color: STUDIO.claret }}
            >
              {t(`columns.${problem}`)}
            </p>
          )}
          <div className="mt-5 flex justify-between gap-2">
            <PortalButton
              disabled={isPending}
              onClick={() => setStep("upload")}
              variant="ghost"
            >
              {t("columns.back")}
            </PortalButton>
            <PortalButton
              loading={isPending}
              onClick={checkImport}
              variant="primary"
            >
              {t("columns.next")}
            </PortalButton>
          </div>
        </>
      )}

      {step === "preview" && preview && (
        <>
          <ImportPreview preview={preview} />
          <div className="mt-5 flex justify-between gap-2">
            <PortalButton
              disabled={isPending}
              onClick={() => setStep("columns")}
              variant="ghost"
            >
              {t("preview.back")}
            </PortalButton>
            <PortalButton loading={isPending} onClick={save} variant="primary">
              {t("preview.save")}
            </PortalButton>
          </div>
        </>
      )}
    </div>
  );
}

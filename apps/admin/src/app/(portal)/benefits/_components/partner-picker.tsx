import { NATIONAL_CAMPUS_ID } from "@repo/shared/utils/benefit-catalog";
import { Check, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  type KeyboardEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import type { BoardPartner } from "../../_actions/benefits";
import { ImageUploadField } from "../../_components/image-upload-field";
import { STUDIO, StudioButton } from "../../_components/studio";
import { BOARD_FOCUS_RING, BOARD_FOCUS_RING_INSET } from "../_lib/board-styles";
import { BenefitStatePill } from "./benefit-state-pill";
import { createBenefitPartner } from "./panel-actions";
import {
  errorProps,
  FieldError,
  PANEL_INPUT_CLASS,
  PanelLabel,
  panelInputStyle,
} from "./panel-fields";
import { PartnerLogo } from "./partner-logo";

const SELECTED_BACKGROUND = "#f7ecec";
/** "No partner" means BISO itself, so it wears BISO's initials. */
const BISO_NAME = "BISO";
const HTTPS = "https://";

interface PartnerOption {
  id: string | null;
  isActive: boolean;
  isNational: boolean;
  logoUrl: string | null;
  name: string;
}

export interface PartnerPickerProps {
  /** The benefit's campus: new partners are saved there. */
  campusId: string;
  disabled: boolean;
  labelledBy: string;
  onChange: (partnerId: string | null) => void;
  onCreated: (partner: BoardPartner) => void;
  /** Told whether the "+ Ny partner" form holds anything unsaved. */
  onDraftChange?: (hasDraft: boolean) => void;
  partners: BoardPartner[];
  value: string | null;
}

/**
 * Picks the benefit's partner from a list with logos. "No partner (BISO)"
 * comes first, partners that have ended last. "+ Ny partner" adds one on the
 * benefit's campus without leaving the panel.
 */
export function PartnerPicker({
  campusId,
  disabled,
  labelledBy,
  onChange,
  onCreated,
  onDraftChange,
  partners,
  value,
}: PartnerPickerProps) {
  const t = useTranslations("adminPortal.benefits.panel");
  const tBoard = useTranslations("adminPortal.benefits.board");
  const baseId = useId();
  const optionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [adding, setAdding] = useState(false);

  const options = useMemo<PartnerOption[]>(() => {
    const ordered = [
      ...partners.filter((partner) => partner.is_active),
      ...partners.filter((partner) => !partner.is_active),
    ];
    return [
      {
        id: null,
        isActive: true,
        isNational: false,
        logoUrl: null,
        name: t("noPartner"),
      },
      ...ordered.map((partner) => ({
        id: partner.id,
        isActive: partner.is_active,
        isNational:
          partner.campus_id === NATIONAL_CAMPUS_ID &&
          campusId !== NATIONAL_CAMPUS_ID,
        logoUrl: partner.logo_url,
        name: partner.name,
      })),
    ];
  }, [campusId, partners, t]);

  const selectedIndex = options.findIndex((option) => option.id === value);
  // Keyboard users land on the picked partner, or on the first option.
  const tabStop = Math.max(selectedIndex, 0);

  const choose = (index: number) => {
    const option = options[index];
    if (!option || disabled) {
      return;
    }
    onChange(option.id);
    optionRefs.current[index]?.focus();
    optionRefs.current[index]?.scrollIntoView?.({ block: "nearest" });
  };

  const handleKeyDown = (event: KeyboardEvent, index: number) => {
    const last = options.length - 1;
    const next: Record<string, number> = {
      ArrowDown: Math.min(index + 1, last),
      ArrowUp: Math.max(index - 1, 0),
      End: last,
      Home: 0,
    };
    if (event.key in next) {
      event.preventDefault();
      choose(next[event.key] ?? index);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(index);
    }
  };

  return (
    <div>
      <div
        aria-disabled={disabled || undefined}
        aria-labelledby={labelledBy}
        className="max-h-64 overflow-y-auto rounded-lg border bg-white p-1"
        role="listbox"
        style={{ borderColor: STUDIO.rule2 }}
      >
        {options.map((option, index) => {
          const selected = index === selectedIndex;
          return (
            <div
              aria-selected={selected}
              className={`flex items-center gap-3 rounded-md px-2.5 py-2 ${disabled ? "cursor-default" : "cursor-pointer hover:bg-[#f3eee5]"} ${BOARD_FOCUS_RING_INSET}`}
              id={`${baseId}-${index}`}
              key={option.id ?? "none"}
              onClick={() => choose(index)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              ref={(element) => {
                optionRefs.current[index] = element;
              }}
              role="option"
              style={
                selected
                  ? { background: SELECTED_BACKGROUND, color: STUDIO.claret }
                  : { color: STUDIO.ink }
              }
              tabIndex={!disabled && index === tabStop ? 0 : -1}
            >
              <PartnerLogo
                logoUrl={option.logoUrl}
                name={option.id === null ? BISO_NAME : option.name}
              />
              <span
                className={`min-w-0 flex-1 truncate text-sm ${selected ? "font-semibold" : "font-medium"}`}
              >
                {option.name}
              </span>
              {option.isNational ? (
                <span
                  className="shrink-0 text-xs"
                  style={{ color: STUDIO.ink3 }}
                >
                  {tBoard("nationalTab")}
                </span>
              ) : null}
              {option.isActive ? null : <BenefitStatePill state="ended" />}
              <Check
                aria-hidden
                className={`shrink-0 ${selected ? "" : "invisible"}`}
                size={16}
              />
            </div>
          );
        })}
      </div>

      {disabled ? null : (
        <NewPartner
          adding={adding}
          campusId={campusId}
          onAddingChange={setAdding}
          onCreated={(partner) => {
            onCreated(partner);
            setAdding(false);
          }}
          onDraftChange={onDraftChange}
        />
      )}
    </div>
  );
}

function NewPartner({
  adding,
  campusId,
  onAddingChange,
  onCreated,
  onDraftChange,
}: {
  adding: boolean;
  campusId: string;
  onAddingChange: (adding: boolean) => void;
  onCreated: (partner: BoardPartner) => void;
  onDraftChange?: (hasDraft: boolean) => void;
}) {
  const t = useTranslations("adminPortal.benefits.panel");
  const tErrors = useTranslations("adminPortal.benefits.errors");
  const id = useId();
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [websiteError, setWebsiteError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const hasDraft = adding && Boolean(name.trim() || website.trim() || logoUrl);
  useEffect(() => {
    onDraftChange?.(hasDraft);
  }, [hasDraft, onDraftChange]);

  const reset = () => {
    setName("");
    setWebsite("");
    setLogoUrl(null);
    setWebsiteError(undefined);
  };

  const save = async () => {
    if (saving || !name.trim()) {
      return;
    }
    const websiteUrl = website.trim();
    if (websiteUrl && !websiteUrl.startsWith(HTTPS)) {
      setWebsiteError(tErrors("linkInvalid"));
      return;
    }
    setSaving(true);
    try {
      const result = await createBenefitPartner({
        campus_id: campusId,
        logo_url: logoUrl,
        name: name.trim(),
        website_url: websiteUrl || null,
      });
      if ("error" in result) {
        toast.error(t("saveFailed"), { description: result.error });
        return;
      }
      reset();
      onCreated(result.data);
    } catch {
      toast.error(t("saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-2">
      <button
        aria-controls={`${id}-form`}
        aria-expanded={adding}
        className={`rounded-md px-1 py-1 font-semibold text-[13px] ${BOARD_FOCUS_RING}`}
        onClick={() => onAddingChange(!adding)}
        style={{ color: STUDIO.claret }}
        type="button"
      >
        {t("newPartner")}
      </button>
      <div
        className="mt-2 space-y-4 rounded-xl border p-4"
        hidden={!adding}
        id={`${id}-form`}
        style={{ background: STUDIO.paper2, borderColor: STUDIO.rule }}
      >
        <div>
          <PanelLabel htmlFor={`${id}-name`}>{t("partnerName")}</PanelLabel>
          <input
            autoComplete="organization"
            className={PANEL_INPUT_CLASS}
            id={`${id}-name`}
            maxLength={200}
            onChange={(event) => setName(event.target.value)}
            style={panelInputStyle}
            type="text"
            value={name}
          />
        </div>
        <div>
          <PanelLabel help={t("optional")} htmlFor={`${id}-website`}>
            {t("partnerWebsite")}
          </PanelLabel>
          <input
            className={PANEL_INPUT_CLASS}
            id={`${id}-website`}
            inputMode="url"
            onChange={(event) => {
              setWebsite(event.target.value);
              setWebsiteError(undefined);
            }}
            placeholder={HTTPS}
            style={panelInputStyle}
            type="url"
            value={website}
            {...errorProps(`${id}-website-error`, websiteError)}
          />
          <FieldError id={`${id}-website-error`} message={websiteError} />
        </div>
        <div>
          <PanelLabel help={t("optional")} htmlFor={`${id}-logo`}>
            {t("partnerLogo")}
          </PanelLabel>
          <ImageUploadField
            inputId={`${id}-logo`}
            label={t("partnerLogo")}
            onChange={setLogoUrl}
            value={logoUrl}
          />
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <StudioButton
            className={BOARD_FOCUS_RING}
            disabled={saving}
            onClick={() => {
              reset();
              onAddingChange(false);
            }}
          >
            {t("cancel")}
          </StudioButton>
          <StudioButton
            className={BOARD_FOCUS_RING}
            disabled={saving || !name.trim()}
            onClick={save}
            variant="primary"
          >
            {saving ? (
              <Loader2 aria-hidden className="animate-spin" size={14} />
            ) : null}
            {t("savePartner")}
          </StudioButton>
        </div>
      </div>
    </div>
  );
}

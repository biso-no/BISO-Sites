"use client";

import {
  APP_PLATFORMS,
  type AppPlatform,
  type AppVersionError,
  type AppVersionPolicy,
  validateAppVersionPolicy,
} from "@repo/shared/utils/app-versions";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  buttonStyle,
  STUDIO,
  studioSurface,
} from "../../../_components/studio";
import { type AppVersionsView, saveAppVersionPolicy } from "../actions";
import { shouldWarnAboveStore } from "../app-versions-model";

interface AppVersionsLabels {
  androidNote: string;
  errors: Record<AppVersionError, string>;
  /** Contains a `{version}` placeholder. */
  liveInStore: string;
  minimum: string;
  minimumHelp: string;
  platforms: Record<AppPlatform, string>;
  recommended: string;
  recommendedHelp: string;
  save: string;
  saved: string;
  saveError: string;
  warnAboveStore: string;
  warnRecommendedAboveStore: string;
}

interface Draft {
  minimum: string;
  recommended: string;
}

const ERROR_KEYS: readonly AppVersionError[] = [
  "invalidMinimum",
  "invalidRecommended",
  "recommendedBelowMinimum",
];

function isAppVersionError(value: string): value is AppVersionError {
  return (ERROR_KEYS as readonly string[]).includes(value);
}

function toDraft(policy: AppVersionPolicy): Draft {
  return {
    minimum: policy.minimum ?? "",
    recommended: policy.recommended ?? "",
  };
}

function VersionField({
  disabled,
  help,
  id,
  invalid,
  label,
  onChange,
  value,
  warning,
}: {
  disabled: boolean;
  help: string;
  id: string;
  invalid: boolean;
  label: string;
  onChange: (value: string) => void;
  value: string;
  warning: string | null;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        className="font-medium text-sm"
        htmlFor={id}
        style={{ color: STUDIO.ink2 }}
      >
        {label}
      </label>
      <input
        aria-describedby={
          warning === null ? `${id}-help` : `${id}-help ${id}-warning`
        }
        aria-invalid={invalid}
        autoComplete="off"
        className="w-full rounded-lg px-3 py-2 text-sm sm:w-48"
        disabled={disabled}
        id={id}
        onChange={(event) => onChange(event.target.value)}
        placeholder="1.2.3"
        style={{
          background: STUDIO.white,
          border: `0.5px solid ${invalid ? STUDIO.claret : STUDIO.rule2}`,
          color: STUDIO.ink,
        }}
        type="text"
        value={value}
      />
      <span
        className="text-[11px]"
        id={`${id}-help`}
        style={{ color: STUDIO.ink4 }}
      >
        {help}
      </span>
      {warning !== null && (
        <span
          className="max-w-xs text-xs"
          id={`${id}-warning`}
          role="status"
          style={{ color: STUDIO.claret }}
        >
          {warning}
        </span>
      )}
    </div>
  );
}

function PlatformCard({
  appStoreVersion,
  draft,
  errorKey,
  labels,
  onChange,
  onSave,
  pending,
  platform,
}: {
  appStoreVersion: string | null;
  draft: Draft;
  errorKey: AppVersionError | null;
  labels: AppVersionsLabels;
  onChange: (draft: Draft) => void;
  onSave: () => void;
  pending: boolean;
  platform: AppPlatform;
}) {
  const isIos = platform === "ios";
  const warnMinimum =
    isIos && shouldWarnAboveStore(draft.minimum, appStoreVersion);
  const warnRecommended =
    isIos && shouldWarnAboveStore(draft.recommended, appStoreVersion);

  return (
    <div className="rounded-2xl p-6" style={studioSurface}>
      <div className="mb-5">
        <h3 className="font-medium text-base" style={{ color: STUDIO.ink }}>
          {labels.platforms[platform]}
        </h3>
        {isIos && appStoreVersion !== null && (
          <p className="mt-0.5 text-xs" style={{ color: STUDIO.ink4 }}>
            {labels.liveInStore.replace("{version}", appStoreVersion)}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-5 sm:flex-row sm:gap-8">
        <VersionField
          disabled={pending}
          help={labels.minimumHelp}
          id={`${platform}-minimum`}
          invalid={errorKey === "invalidMinimum"}
          label={labels.minimum}
          onChange={(minimum) => onChange({ ...draft, minimum })}
          value={draft.minimum}
          warning={warnMinimum ? labels.warnAboveStore : null}
        />
        <VersionField
          disabled={pending}
          help={labels.recommendedHelp}
          id={`${platform}-recommended`}
          invalid={
            errorKey === "invalidRecommended" ||
            errorKey === "recommendedBelowMinimum"
          }
          label={labels.recommended}
          onChange={(recommended) => onChange({ ...draft, recommended })}
          value={draft.recommended}
          warning={warnRecommended ? labels.warnRecommendedAboveStore : null}
        />
      </div>

      {errorKey !== null && (
        <p
          className="mt-4 text-xs"
          role="alert"
          style={{ color: STUDIO.claret }}
        >
          {labels.errors[errorKey]}
        </p>
      )}
      {!isIos && (
        <p className="mt-4 text-xs" style={{ color: STUDIO.ink4 }}>
          {labels.androidNote}
        </p>
      )}

      <div
        className="mt-5 flex justify-end border-t pt-4"
        style={{ borderColor: STUDIO.rule }}
      >
        <button
          className={`rounded-lg px-4 py-2.5 font-medium text-sm transition ${
            pending ? "opacity-50" : ""
          }`}
          disabled={pending}
          onClick={onSave}
          style={buttonStyle("primary")}
          type="button"
        >
          {labels.save}
        </button>
      </div>
    </div>
  );
}

export function AppVersionsClient({
  initialView,
  labels,
}: {
  initialView: AppVersionsView;
  labels: AppVersionsLabels;
}) {
  const [drafts, setDrafts] = useState<Record<AppPlatform, Draft>>({
    android: toDraft(initialView.policies.android),
    ios: toDraft(initialView.policies.ios),
  });
  const [errors, setErrors] = useState<
    Record<AppPlatform, AppVersionError | null>
  >({ android: null, ios: null });
  const [pendingPlatform, setPendingPlatform] = useState<AppPlatform | null>(
    null
  );
  const [, startTransition] = useTransition();

  function handleSave(platform: AppPlatform) {
    // The same check the server runs, so a typo never needs a round trip.
    const validated = validateAppVersionPolicy(drafts[platform]);
    if ("error" in validated) {
      setErrors((current) => ({ ...current, [platform]: validated.error }));
      return;
    }
    setPendingPlatform(platform);
    startTransition(async () => {
      const result = await saveAppVersionPolicy(platform, drafts[platform]);
      setPendingPlatform(null);
      if ("error" in result) {
        if (isAppVersionError(result.error)) {
          setErrors((current) => ({
            ...current,
            [platform]: result.error as AppVersionError,
          }));
          toast.error(labels.errors[result.error]);
        } else {
          toast.error(labels.saveError);
        }
        return;
      }
      setErrors((current) => ({ ...current, [platform]: null }));
      setDrafts((current) => ({
        ...current,
        [platform]: toDraft(result.data),
      }));
      toast.success(labels.saved);
    });
  }

  return (
    <div className="space-y-5">
      {APP_PLATFORMS.map((platform) => (
        <PlatformCard
          appStoreVersion={initialView.appStoreVersion}
          draft={drafts[platform]}
          errorKey={errors[platform]}
          key={platform}
          labels={labels}
          onChange={(draft) => {
            setDrafts((current) => ({ ...current, [platform]: draft }));
            setErrors((current) => ({ ...current, [platform]: null }));
          }}
          onSave={() => handleSave(platform)}
          pending={pendingPlatform === platform}
          platform={platform}
        />
      ))}
    </div>
  );
}

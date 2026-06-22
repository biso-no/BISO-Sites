"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { buttonStyle, STUDIO, studioSurface } from "../../_components/studio";
import {
  type ProviderSecretView,
  type ProviderSettingsView,
  setPaymentTestMode,
  updatePaymentSecrets,
} from "../actions";

type Mode = "test" | "live";

interface PaymentLabels {
  activeMode: string;
  activeNote: string;
  complete: string;
  completeFirst: string;
  configured: string;
  incomplete: string;
  live: string;
  notConfigured: string;
  providers: Record<"stripe" | "vipps", string>;
  save: string;
  saved: string;
  saveError: string;
  secretPlaceholder: string;
  setActiveLive: string;
  setActiveTest: string;
  test: string;
}

const SECRET_FIELD_PREFIX = /^(?:vipps|stripe)_(?:test|live)_/;
const UNDERSCORE = /_/g;
const SECRET_FIELD_LABELS: Record<string, string> = {
  client_id: "Client ID",
  client_secret: "Client secret",
  msn: "Merchant serial number",
  secret_key: "Secret key",
  subscription_key: "Subscription key",
  webhook_secret: "Webhook secret",
};

function secretLabel(key: string): string {
  const field = key.replace(SECRET_FIELD_PREFIX, "");
  return SECRET_FIELD_LABELS[field] ?? field.replace(UNDERSCORE, " ");
}

function isSetComplete(secrets: ProviderSecretView[]): boolean {
  return secrets.length > 0 && secrets.every((secret) => secret.configured);
}

function ModeTabs({
  mode,
  activeMode,
  labels,
  onSelect,
}: {
  activeMode: Mode;
  labels: PaymentLabels;
  mode: Mode;
  onSelect: (mode: Mode) => void;
}) {
  const modes: Mode[] = ["test", "live"];
  return (
    <div
      className="inline-flex rounded-xl p-1"
      role="tablist"
      style={{
        background: STUDIO.paper2,
        border: `0.5px solid ${STUDIO.rule2}`,
      }}
    >
      {modes.map((value) => {
        const selected = mode === value;
        const active = activeMode === value;
        return (
          <button
            aria-selected={selected}
            className="relative flex items-center gap-1.5 rounded-lg px-4 py-1.5 font-medium text-[13px] transition-colors"
            key={value}
            onClick={() => onSelect(value)}
            role="tab"
            style={
              selected
                ? {
                    background: STUDIO.white,
                    boxShadow: "0 1px 2px rgba(26,24,20,0.06)",
                    color: STUDIO.ink,
                  }
                : { background: "transparent", color: STUDIO.ink4 }
            }
            type="button"
          >
            {value === "test" ? labels.test : labels.live}
            {active && (
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: STUDIO.leaf }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

function SecretField({
  fieldKey,
  configured,
  value,
  labels,
  disabled,
  onChange,
}: {
  configured: boolean;
  disabled: boolean;
  fieldKey: string;
  labels: PaymentLabels;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <div
      className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
      style={{ borderBottom: `0.5px solid ${STUDIO.rule}` }}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm" style={{ color: STUDIO.ink2 }}>
          {secretLabel(fieldKey)}
        </span>
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]"
          style={
            configured
              ? { background: "rgba(47,93,58,0.08)", color: STUDIO.leaf }
              : { background: STUDIO.paper2, color: STUDIO.ink4 }
          }
        >
          <span
            className="h-1 w-1 rounded-full"
            style={{ background: configured ? STUDIO.leaf : STUDIO.ink4 }}
          />
          {configured ? labels.configured : labels.notConfigured}
        </span>
      </div>
      <input
        autoComplete="off"
        className="w-full rounded-lg px-3 py-2 text-sm sm:w-72"
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        placeholder={labels.secretPlaceholder}
        style={{
          background: STUDIO.white,
          border: `0.5px solid ${STUDIO.rule2}`,
          color: STUDIO.ink,
        }}
        type="password"
        value={value}
      />
    </div>
  );
}

function ProviderCard({
  view,
  mode,
  labels,
  inputs,
  pending,
  onSelectMode,
  onInput,
  onSetActive,
  onSave,
}: {
  inputs: Record<string, string>;
  labels: PaymentLabels;
  mode: Mode;
  onInput: (key: string, value: string) => void;
  onSave: () => void;
  onSelectMode: (mode: Mode) => void;
  onSetActive: (mode: Mode) => void;
  pending: boolean;
  view: ProviderSettingsView;
}) {
  const activeMode: Mode = view.activeMode;
  const secrets = mode === "test" ? view.testSecrets : view.liveSecrets;
  const viewingActive = mode === activeMode;
  const viewSetComplete = isSetComplete(secrets);
  const activeModeLabel = activeMode === "test" ? labels.test : labels.live;

  return (
    <div className="rounded-2xl p-6" style={studioSurface}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-medium text-base" style={{ color: STUDIO.ink }}>
            {labels.providers[view.provider]}
          </h3>
          <p
            className="mt-0.5 text-[11px] uppercase tracking-[0.08em]"
            style={{ color: STUDIO.ink4 }}
          >
            {labels.activeMode}: {activeModeLabel}
          </p>
        </div>
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs"
          style={
            view.status.complete
              ? { background: "rgba(47,93,58,0.08)", color: STUDIO.leaf }
              : { background: "rgba(107,30,30,0.07)", color: STUDIO.claret }
          }
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{
              background: view.status.complete ? STUDIO.leaf : STUDIO.claret,
            }}
          />
          {activeModeLabel} ·{" "}
          {view.status.complete ? labels.complete : labels.incomplete}
        </span>
      </div>

      <ModeTabs
        activeMode={activeMode}
        labels={labels}
        mode={mode}
        onSelect={onSelectMode}
      />

      <div className="mt-3">
        {secrets.map((secret) => (
          <SecretField
            configured={secret.configured}
            disabled={pending}
            fieldKey={secret.key}
            key={secret.key}
            labels={labels}
            onChange={(value) => onInput(secret.key, value)}
            value={inputs[secret.key] ?? ""}
          />
        ))}
      </div>

      <div
        className="mt-5 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between"
        style={{ borderColor: STUDIO.rule }}
      >
        {viewingActive ? (
          <p
            className="flex items-center gap-2 text-xs"
            style={{ color: STUDIO.ink4 }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: STUDIO.leaf }}
            />
            {labels.activeNote}
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            <button
              className="self-start rounded-lg px-3.5 py-2 font-medium text-[13px] transition disabled:opacity-50"
              disabled={pending || !viewSetComplete}
              onClick={() => onSetActive(mode)}
              style={buttonStyle("secondary")}
              type="button"
            >
              {mode === "test" ? labels.setActiveTest : labels.setActiveLive}
            </button>
            {!viewSetComplete && (
              <span className="text-[11px]" style={{ color: STUDIO.claret }}>
                {labels.completeFirst}
              </span>
            )}
          </div>
        )}
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

export function PaymentSettingsClient({
  initialViews,
  labels,
}: {
  initialViews: ProviderSettingsView[];
  labels: PaymentLabels;
}) {
  const [views, setViews] = useState<ProviderSettingsView[]>(initialViews);
  const [modes, setModes] = useState<Record<string, Mode>>(() =>
    Object.fromEntries(
      initialViews.map((view) => [view.provider, view.activeMode])
    )
  );
  const [inputs, setInputs] = useState<Record<string, Record<string, string>>>(
    {}
  );
  const [pendingProvider, setPendingProvider] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function replaceView(next: ProviderSettingsView) {
    setViews((current) =>
      current.map((view) => (view.provider === next.provider ? next : view))
    );
  }

  function setInput(provider: string, key: string, value: string) {
    setInputs((current) => ({
      ...current,
      [provider]: { ...(current[provider] ?? {}), [key]: value },
    }));
  }

  function handleSetActive(provider: string, mode: Mode) {
    setPendingProvider(provider);
    startTransition(async () => {
      const result = await setPaymentTestMode(provider, mode === "test");
      setPendingProvider(null);
      if ("error" in result) {
        toast.error(result.error || labels.saveError);
        return;
      }
      replaceView(result.data);
    });
  }

  function handleSave(provider: string) {
    const draft = inputs[provider] ?? {};
    setPendingProvider(provider);
    startTransition(async () => {
      const result = await updatePaymentSecrets(provider, draft);
      setPendingProvider(null);
      if ("error" in result) {
        toast.error(result.error || labels.saveError);
        return;
      }
      replaceView(result.data);
      setInputs((current) => ({ ...current, [provider]: {} }));
      toast.success(labels.saved);
    });
  }

  return (
    <div className="space-y-5">
      {views.map((view) => (
        <ProviderCard
          inputs={inputs[view.provider] ?? {}}
          key={view.provider}
          labels={labels}
          mode={modes[view.provider] ?? view.activeMode}
          onInput={(key, value) => setInput(view.provider, key, value)}
          onSave={() => handleSave(view.provider)}
          onSelectMode={(mode) =>
            setModes((current) => ({ ...current, [view.provider]: mode }))
          }
          onSetActive={(mode) => handleSetActive(view.provider, mode)}
          pending={pendingProvider === view.provider}
          view={view}
        />
      ))}
    </div>
  );
}

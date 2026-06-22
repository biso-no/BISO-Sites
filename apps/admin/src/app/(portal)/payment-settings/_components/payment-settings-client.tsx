"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { buttonStyle, STUDIO, studioSurface } from "../../_components/studio";
import {
  type ProviderSettingsView,
  setPaymentTestMode,
  updatePaymentSecrets,
} from "../actions";

interface PaymentLabels {
  activeMode: string;
  complete: string;
  configured: string;
  incomplete: string;
  live: string;
  liveCredentials: string;
  missing: string;
  notConfigured: string;
  providers: Record<"stripe" | "vipps", string>;
  save: string;
  saved: string;
  saveError: string;
  secretPlaceholder: string;
  test: string;
  testCredentials: string;
  testMode: string;
  testModeHint: string;
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

function Toggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      aria-pressed={checked}
      className="relative h-6 w-10 shrink-0 rounded-full transition-all disabled:opacity-50"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        background: checked ? STUDIO.leaf : STUDIO.rule2,
        boxShadow: checked ? "0 4px 14px rgba(47,93,58,0.18)" : "none",
      }}
      type="button"
    >
      <span
        className="absolute top-1 h-4 w-4 rounded-full transition-all"
        style={{
          background: "#fff",
          left: checked ? "calc(100% - 20px)" : "4px",
        }}
      />
    </button>
  );
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className="rounded-full px-2.5 py-0.5 text-xs"
      style={
        ok
          ? { background: "rgba(47,93,58,0.08)", color: STUDIO.leaf }
          : { background: "rgba(107,30,30,0.07)", color: STUDIO.claret }
      }
    >
      {label}
    </span>
  );
}

function SecretField({
  fieldKey,
  configured,
  value,
  labels,
  onChange,
}: {
  configured: boolean;
  fieldKey: string;
  labels: PaymentLabels;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <div
      className="py-3"
      style={{ borderBottom: `0.5px solid ${STUDIO.rule}` }}
    >
      <div className="flex items-center gap-2">
        <p className="text-sm" style={{ color: STUDIO.ink2 }}>
          {secretLabel(fieldKey)}
        </p>
        <span
          className="rounded-full px-2 py-0.5 text-[11px]"
          style={
            configured
              ? { background: "rgba(47,93,58,0.08)", color: STUDIO.leaf }
              : { background: STUDIO.paper2, color: STUDIO.ink4 }
          }
        >
          {configured ? labels.configured : labels.notConfigured}
        </span>
      </div>
      <input
        autoComplete="off"
        className="mt-2 w-full rounded-lg px-3 py-2 text-sm"
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
  labels,
  inputs,
  pending,
  onInput,
  onToggleMode,
  onSave,
}: {
  inputs: Record<string, string>;
  labels: PaymentLabels;
  onInput: (key: string, value: string) => void;
  onSave: () => void;
  onToggleMode: (next: boolean) => void;
  pending: boolean;
  view: ProviderSettingsView;
}) {
  const modeLabel = view.activeMode === "test" ? labels.test : labels.live;

  return (
    <div className="rounded-2xl p-6" style={studioSurface}>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="font-medium text-sm" style={{ color: STUDIO.ink }}>
            {labels.providers[view.provider]}
          </h3>
          <p className="mt-0.5 text-xs" style={{ color: STUDIO.ink4 }}>
            {labels.activeMode}: {modeLabel}
          </p>
        </div>
        <StatusBadge
          label={view.status.complete ? labels.complete : labels.incomplete}
          ok={view.status.complete}
        />
      </div>

      <div
        className="flex items-center justify-between gap-4 py-3"
        style={{ borderBottom: `0.5px solid ${STUDIO.rule}` }}
      >
        <div>
          <p className="text-sm" style={{ color: STUDIO.ink2 }}>
            {labels.testMode}
          </p>
          <p className="mt-0.5 text-xs" style={{ color: STUDIO.ink4 }}>
            {labels.testModeHint}
          </p>
        </div>
        <Toggle
          checked={view.testMode}
          disabled={pending}
          onChange={onToggleMode}
        />
      </div>

      <p
        className="mt-5 mb-1 font-medium text-[11px] uppercase tracking-[0.06em]"
        style={{ color: STUDIO.ink3 }}
      >
        {labels.testCredentials}
      </p>
      {view.testSecrets.map((secret) => (
        <SecretField
          configured={secret.configured}
          fieldKey={secret.key}
          key={secret.key}
          labels={labels}
          onChange={(value) => onInput(secret.key, value)}
          value={inputs[secret.key] ?? ""}
        />
      ))}

      <p
        className="mt-5 mb-1 font-medium text-[11px] uppercase tracking-[0.06em]"
        style={{ color: STUDIO.ink3 }}
      >
        {labels.liveCredentials}
      </p>
      {view.liveSecrets.map((secret) => (
        <SecretField
          configured={secret.configured}
          fieldKey={secret.key}
          key={secret.key}
          labels={labels}
          onChange={(value) => onInput(secret.key, value)}
          value={inputs[secret.key] ?? ""}
        />
      ))}

      <div className="mt-5 flex justify-end">
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

  function handleToggleMode(provider: string, next: boolean) {
    setPendingProvider(provider);
    startTransition(async () => {
      const result = await setPaymentTestMode(provider, next);
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
          onInput={(key, value) => setInput(view.provider, key, value)}
          onSave={() => handleSave(view.provider)}
          onToggleMode={(next) => handleToggleMode(view.provider, next)}
          pending={pendingProvider === view.provider}
          view={view}
        />
      ))}
    </div>
  );
}

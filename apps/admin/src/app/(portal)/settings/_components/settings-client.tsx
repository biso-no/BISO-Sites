"use client";

import { Bell, Globe, Lock, Shield, Zap } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { STUDIO, StudioButton, studioSurface } from "../../_components/studio";
import { saveAdminPortalSettings } from "../actions";
import type { AdminPortalSettings, AdminTimezone } from "../settings-model";

interface IntegrationStatus {
  connected: boolean;
  id: string;
  name: string;
}

interface SettingsClientProps {
  initialSettings: AdminPortalSettings;
  integrations: IntegrationStatus[];
  isGlobalAdmin: boolean;
  labels: {
    save: string;
    saveError: string;
    saveSuccess: string;
    saving: string;
    sections: Record<string, string>;
    general: { title: string; locale: string; timezone: string };
    notifications: {
      title: string;
      newApplications: string;
      newDrafts: string;
      systemAlerts: string;
    };
    integrations: {
      title: string;
      connected: string;
      notConfigured: string;
    };
    security: {
      title: string;
      twoFactor: string;
      sessions: string;
      managedExternally: string;
      restricted: string;
      sessionsManaged: string;
    };
  };
  timezoneOptions: AdminTimezone[];
}

type Section = "general" | "notifications" | "integrations" | "security";

const SECTION_ICONS: Record<
  Section,
  React.ComponentType<{ size?: number; style?: React.CSSProperties }>
> = {
  general: Globe,
  notifications: Bell,
  integrations: Zap,
  security: Shield,
};

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      aria-pressed={checked}
      className="relative h-6 w-10 shrink-0 rounded-full transition-all"
      onClick={() => onChange(!checked)}
      style={{
        background: checked ? STUDIO.ink : STUDIO.rule2,
        boxShadow: checked ? "0 4px 14px rgba(26,24,20,0.16)" : "none",
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

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl p-6" style={studioSurface}>
      <h3 className="mb-4 font-medium text-sm" style={{ color: STUDIO.ink }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  checked: boolean;
  description?: string;
  label: string;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      className="flex items-center justify-between gap-4 py-3"
      style={{ borderBottom: `0.5px solid ${STUDIO.rule}` }}
    >
      <div>
        <p className="text-sm" style={{ color: STUDIO.ink2 }}>
          {label}
        </p>
        {description && (
          <p className="mt-0.5 text-xs" style={{ color: STUDIO.ink4 }}>
            {description}
          </p>
        )}
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

function StatusRow({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  tone?: "good" | "neutral";
  value: string;
}) {
  return (
    <div
      className="flex items-center justify-between gap-4 py-3"
      style={{ borderBottom: `0.5px solid ${STUDIO.rule}` }}
    >
      <p className="text-sm" style={{ color: STUDIO.ink2 }}>
        {label}
      </p>
      <span
        className="rounded-full px-2.5 py-0.5 text-xs"
        style={
          tone === "good"
            ? {
                background: "rgba(47,93,58,0.08)",
                color: STUDIO.leaf,
              }
            : {
                background: STUDIO.paper2,
                color: STUDIO.ink4,
              }
        }
      >
        {value}
      </span>
    </div>
  );
}

function settingsEqual(
  left: AdminPortalSettings,
  right: AdminPortalSettings
): boolean {
  return (
    left.locale === right.locale &&
    left.timezone === right.timezone &&
    left.notifications.newApplications ===
      right.notifications.newApplications &&
    left.notifications.newDrafts === right.notifications.newDrafts &&
    left.notifications.systemAlerts === right.notifications.systemAlerts
  );
}

export function SettingsClient({
  initialSettings,
  integrations,
  isGlobalAdmin,
  labels,
  timezoneOptions,
}: SettingsClientProps) {
  const [activeSection, setActiveSection] = useState<Section>("general");
  const [settings, setSettings] =
    useState<AdminPortalSettings>(initialSettings);
  const [savedSettings, setSavedSettings] =
    useState<AdminPortalSettings>(initialSettings);
  const [isPending, startTransition] = useTransition();

  const sections = Object.entries(labels.sections).filter(([key]) => {
    if ((key === "security" || key === "integrations") && !isGlobalAdmin) {
      return false;
    }
    return key in SECTION_ICONS;
  }) as [Section, string][];

  const hasChanges = !settingsEqual(settings, savedSettings);
  const isEditableSection =
    activeSection === "general" || activeSection === "notifications";

  function updateSettings(next: Partial<AdminPortalSettings>) {
    setSettings((current) => ({ ...current, ...next }));
  }

  function updateNotification(
    key: keyof AdminPortalSettings["notifications"],
    value: boolean
  ) {
    setSettings((current) => ({
      ...current,
      notifications: {
        ...current.notifications,
        [key]: value,
      },
    }));
  }

  function handleSave() {
    startTransition(async () => {
      const result = await saveAdminPortalSettings(settings);
      if ("error" in result) {
        toast.error(result.error || labels.saveError);
        return;
      }
      setSettings(result.data);
      setSavedSettings(result.data);
      toast.success(labels.saveSuccess);
    });
  }

  return (
    <div className="flex gap-8">
      <div className="w-44 shrink-0">
        <nav className="space-y-1">
          {sections.map(([key, label]) => {
            const Icon = SECTION_ICONS[key];
            const isActive = activeSection === key;
            return (
              <button
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition-all"
                key={key}
                onClick={() => setActiveSection(key)}
                style={
                  isActive
                    ? { background: STUDIO.ink, color: STUDIO.paper }
                    : { color: STUDIO.ink3 }
                }
                type="button"
              >
                <Icon
                  size={15}
                  style={{
                    color: isActive ? STUDIO.paper : STUDIO.ink4,
                  }}
                />
                {label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="flex-1 space-y-5">
        {activeSection === "general" && (
          <SectionCard title={labels.general.title}>
            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label
                  className="text-xs"
                  htmlFor="settings-locale"
                  style={{ color: STUDIO.ink3 }}
                >
                  {labels.general.locale}
                </label>
                <select
                  className="rounded-xl px-3 py-2 text-sm outline-none"
                  id="settings-locale"
                  onChange={(event) =>
                    updateSettings({
                      locale: event.target
                        .value as AdminPortalSettings["locale"],
                    })
                  }
                  style={{
                    background: "rgba(255,255,255,0.62)",
                    border: `0.5px solid ${STUDIO.rule2}`,
                    color: STUDIO.ink,
                  }}
                  value={settings.locale}
                >
                  <option style={{ background: STUDIO.paper }} value="no">
                    Norwegian
                  </option>
                  <option style={{ background: STUDIO.paper }} value="en">
                    English
                  </option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label
                  className="text-xs"
                  htmlFor="settings-timezone"
                  style={{ color: STUDIO.ink3 }}
                >
                  {labels.general.timezone}
                </label>
                <select
                  className="rounded-xl px-3 py-2 text-sm outline-none"
                  id="settings-timezone"
                  onChange={(event) =>
                    updateSettings({
                      timezone: event.target.value as AdminTimezone,
                    })
                  }
                  style={{
                    background: "rgba(255,255,255,0.62)",
                    border: `0.5px solid ${STUDIO.rule2}`,
                    color: STUDIO.ink,
                  }}
                  value={settings.timezone}
                >
                  {timezoneOptions.map((timezone) => (
                    <option
                      key={timezone}
                      style={{ background: STUDIO.paper }}
                      value={timezone}
                    >
                      {timezone}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </SectionCard>
        )}

        {activeSection === "notifications" && (
          <SectionCard title={labels.notifications.title}>
            <ToggleRow
              checked={settings.notifications.newApplications}
              label={labels.notifications.newApplications}
              onChange={(value) => updateNotification("newApplications", value)}
            />
            <ToggleRow
              checked={settings.notifications.newDrafts}
              label={labels.notifications.newDrafts}
              onChange={(value) => updateNotification("newDrafts", value)}
            />
            <ToggleRow
              checked={settings.notifications.systemAlerts}
              label={labels.notifications.systemAlerts}
              onChange={(value) => updateNotification("systemAlerts", value)}
            />
          </SectionCard>
        )}

        {activeSection === "integrations" && isGlobalAdmin && (
          <SectionCard title={labels.integrations.title}>
            {integrations.map((integration) => (
              <StatusRow
                key={integration.id}
                label={integration.name}
                tone={integration.connected ? "good" : "neutral"}
                value={
                  integration.connected
                    ? labels.integrations.connected
                    : labels.integrations.notConfigured
                }
              />
            ))}
          </SectionCard>
        )}

        {activeSection === "security" && isGlobalAdmin && (
          <SectionCard title={labels.security.title}>
            <StatusRow
              label={labels.security.twoFactor}
              value={labels.security.managedExternally}
            />
            <StatusRow
              label={labels.security.sessions}
              value={labels.security.sessionsManaged}
            />
          </SectionCard>
        )}

        {activeSection === "security" && !isGlobalAdmin && (
          <div
            className="rounded-2xl p-6"
            style={{
              background: "rgba(107,30,30,0.05)",
              border: "0.5px solid rgba(107,30,30,0.15)",
            }}
          >
            <div className="flex items-center gap-2">
              <Lock size={15} style={{ color: STUDIO.claret }} />
              <p className="text-sm" style={{ color: STUDIO.claret }}>
                {labels.security.restricted}
              </p>
            </div>
          </div>
        )}

        {isEditableSection && (
          <div className="flex justify-end">
            <StudioButton
              className={!hasChanges || isPending ? "opacity-50" : ""}
              disabled={!hasChanges || isPending}
              onClick={handleSave}
              variant="primary"
            >
              {isPending ? labels.saving : labels.save}
            </StudioButton>
          </div>
        )}
      </div>
    </div>
  );
}

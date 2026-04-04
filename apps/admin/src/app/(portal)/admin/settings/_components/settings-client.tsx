"use client";

import { Bell, Globe, Lock, Shield, Users, Zap } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type SettingsClientProps = {
  isGlobalAdmin: boolean;
  labels: {
    save: string;
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
      appwrite: string;
      stripe: string;
      slack: string;
      connected: string;
      notConnected: string;
      comingSoon: string;
    };
    security: {
      title: string;
      twoFactor: string;
      sessions: string;
      restricted: string;
    };
    saveSuccess: string;
  };
};

type Section =
  | "general"
  | "notifications"
  | "integrations"
  | "security"
  | "team";

const SECTION_ICONS: Record<
  Section,
  React.ComponentType<{ size?: number; style?: React.CSSProperties }>
> = {
  general: Globe,
  notifications: Bell,
  integrations: Zap,
  security: Shield,
  team: Users,
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
      className="relative h-6 w-10 flex-shrink-0 rounded-full transition-all"
      onClick={() => onChange(!checked)}
      style={{
        background: checked ? "#3DA9E0" : "rgba(255,255,255,0.15)",
        boxShadow: checked ? "0 0 10px rgba(61,169,224,0.30)" : "none",
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
    <div
      className="rounded-2xl p-6"
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <h3 className="mb-4 font-medium text-sm" style={{ color: "#fff" }}>
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
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      className="flex items-center justify-between py-3"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
    >
      <div>
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.80)" }}>
          {label}
        </p>
        {description && (
          <p
            className="mt-0.5 text-xs"
            style={{ color: "rgba(255,255,255,0.35)" }}
          >
            {description}
          </p>
        )}
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

export function SettingsClient({ isGlobalAdmin, labels }: SettingsClientProps) {
  const [activeSection, setActiveSection] = useState<Section>("general");
  const [notifApplications, setNotifApplications] = useState(true);
  const [notifDrafts, setNotifDrafts] = useState(true);
  const [notifAlerts, setNotifAlerts] = useState(false);
  const [twoFactor, setTwoFactor] = useState(false);

  const sections = Object.entries(labels.sections).filter(([key]) => {
    if ((key === "security" || key === "integrations") && !isGlobalAdmin) {
      return false;
    }
    return true;
  }) as [Section, string][];

  function handleSave() {
    toast.success(labels.saveSuccess);
  }

  return (
    <div className="flex gap-8">
      {/* Left nav */}
      <div className="w-44 flex-shrink-0">
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
                    ? { background: "rgba(255,255,255,0.06)", color: "#fff" }
                    : { color: "rgba(255,255,255,0.45)" }
                }
                type="button"
              >
                {Icon && (
                  <Icon
                    size={15}
                    style={{
                      color: isActive ? "#3DA9E0" : "rgba(255,255,255,0.35)",
                    }}
                  />
                )}
                {label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Right content */}
      <div className="flex-1 space-y-5">
        {activeSection === "general" && (
          <SectionCard title={labels.general.title}>
            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label
                  className="text-xs"
                  style={{ color: "rgba(255,255,255,0.50)" }}
                >
                  {labels.general.locale}
                </label>
                <select
                  className="rounded-xl px-3 py-2 text-sm outline-none"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "#fff",
                  }}
                >
                  <option style={{ background: "#000a16" }} value="en">
                    English
                  </option>
                  <option style={{ background: "#000a16" }} value="no">
                    Norwegian
                  </option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label
                  className="text-xs"
                  style={{ color: "rgba(255,255,255,0.50)" }}
                >
                  {labels.general.timezone}
                </label>
                <select
                  className="rounded-xl px-3 py-2 text-sm outline-none"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "#fff",
                  }}
                >
                  <option style={{ background: "#000a16" }} value="Europe/Oslo">
                    Europe/Oslo (UTC+1)
                  </option>
                  <option style={{ background: "#000a16" }} value="UTC">
                    UTC
                  </option>
                </select>
              </div>
            </div>
          </SectionCard>
        )}

        {activeSection === "notifications" && (
          <SectionCard title={labels.notifications.title}>
            <ToggleRow
              checked={notifApplications}
              label={labels.notifications.newApplications}
              onChange={setNotifApplications}
            />
            <ToggleRow
              checked={notifDrafts}
              label={labels.notifications.newDrafts}
              onChange={setNotifDrafts}
            />
            <ToggleRow
              checked={notifAlerts}
              label={labels.notifications.systemAlerts}
              onChange={setNotifAlerts}
            />
          </SectionCard>
        )}

        {activeSection === "integrations" && isGlobalAdmin && (
          <SectionCard title={labels.integrations.title}>
            {[
              { name: labels.integrations.appwrite, connected: true },
              { name: labels.integrations.stripe, connected: false },
              { name: labels.integrations.slack, connected: false },
            ].map((integration) => (
              <div
                className="flex items-center justify-between py-3"
                key={integration.name}
                style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
              >
                <p
                  className="text-sm"
                  style={{ color: "rgba(255,255,255,0.80)" }}
                >
                  {integration.name}
                </p>
                <span
                  className="rounded-full px-2.5 py-0.5 text-xs"
                  style={
                    integration.connected
                      ? {
                          background: "rgba(74,222,128,0.10)",
                          color: "#4ade80",
                        }
                      : {
                          background: "rgba(255,255,255,0.05)",
                          color: "rgba(255,255,255,0.35)",
                        }
                  }
                >
                  {integration.connected
                    ? labels.integrations.connected
                    : labels.integrations.comingSoon}
                </span>
              </div>
            ))}
          </SectionCard>
        )}

        {activeSection === "security" && isGlobalAdmin && (
          <SectionCard title={labels.security.title}>
            <ToggleRow
              checked={twoFactor}
              label={labels.security.twoFactor}
              onChange={setTwoFactor}
            />
            <div className="py-3">
              <p
                className="text-sm"
                style={{ color: "rgba(255,255,255,0.80)" }}
              >
                {labels.security.sessions}
              </p>
              <p
                className="mt-1 text-xs"
                style={{ color: "rgba(255,255,255,0.35)" }}
              >
                1 active session
              </p>
            </div>
          </SectionCard>
        )}

        {activeSection === "security" && !isGlobalAdmin && (
          <div
            className="rounded-2xl p-6"
            style={{
              background: "rgba(248,113,113,0.05)",
              border: "1px solid rgba(248,113,113,0.15)",
            }}
          >
            <div className="flex items-center gap-2">
              <Lock size={15} style={{ color: "#f87171" }} />
              <p className="text-sm" style={{ color: "#f87171" }}>
                {labels.security.restricted}
              </p>
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <button
            className="rounded-xl px-5 py-2.5 font-medium text-sm"
            onClick={handleSave}
            style={{
              background: "#3DA9E0",
              color: "#001731",
              boxShadow: "0 0 20px rgba(61,169,224,0.25)",
            }}
            type="button"
          >
            {labels.save}
          </button>
        </div>
      </div>
    </div>
  );
}

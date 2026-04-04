"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Lock, Bell, Zap, Globe, Shield, Users } from "lucide-react";

type SettingsClientProps = {
  isGlobalAdmin: boolean;
  labels: {
    save: string;
    sections: Record<string, string>;
    general: { title: string; locale: string; timezone: string };
    notifications: { title: string; newApplications: string; newDrafts: string; systemAlerts: string };
    integrations: { title: string; appwrite: string; stripe: string; slack: string; connected: string; notConnected: string; comingSoon: string };
    security: { title: string; twoFactor: string; sessions: string; restricted: string };
    saveSuccess: string;
  };
};

type Section = "general" | "notifications" | "integrations" | "security" | "team";

const SECTION_ICONS: Record<Section, React.ComponentType<{ size?: number; style?: React.CSSProperties }>> = {
  general: Globe,
  notifications: Bell,
  integrations: Zap,
  security: Shield,
  team: Users,
};

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="relative w-10 h-6 rounded-full transition-all flex-shrink-0"
      style={{
        background: checked ? "#3DA9E0" : "rgba(255,255,255,0.15)",
        boxShadow: checked ? "0 0 10px rgba(61,169,224,0.30)" : "none",
      }}
    >
      <span
        className="absolute top-1 w-4 h-4 rounded-full transition-all"
        style={{
          background: "#fff",
          left: checked ? "calc(100% - 20px)" : "4px",
        }}
      />
    </button>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-6" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <h3 className="text-sm font-medium mb-4" style={{ color: "#fff" }}>{title}</h3>
      {children}
    </div>
  );
}

function ToggleRow({ label, description, checked, onChange }: { label: string; description?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <div>
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.80)" }}>{label}</p>
        {description && <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>{description}</p>}
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
    if ((key === "security" || key === "integrations") && !isGlobalAdmin) return false;
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
                key={key}
                type="button"
                onClick={() => setActiveSection(key)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-left transition-all"
                style={isActive ? { background: "rgba(255,255,255,0.06)", color: "#fff" } : { color: "rgba(255,255,255,0.45)" }}
              >
                {Icon && <Icon size={15} style={{ color: isActive ? "#3DA9E0" : "rgba(255,255,255,0.35)" }} />}
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
                <label className="text-xs" style={{ color: "rgba(255,255,255,0.50)" }}>{labels.general.locale}</label>
                <select
                  className="px-3 py-2 rounded-xl text-sm outline-none"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }}
                >
                  <option value="en" style={{ background: "#000a16" }}>English</option>
                  <option value="no" style={{ background: "#000a16" }}>Norwegian</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs" style={{ color: "rgba(255,255,255,0.50)" }}>{labels.general.timezone}</label>
                <select
                  className="px-3 py-2 rounded-xl text-sm outline-none"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }}
                >
                  <option value="Europe/Oslo" style={{ background: "#000a16" }}>Europe/Oslo (UTC+1)</option>
                  <option value="UTC" style={{ background: "#000a16" }}>UTC</option>
                </select>
              </div>
            </div>
          </SectionCard>
        )}

        {activeSection === "notifications" && (
          <SectionCard title={labels.notifications.title}>
            <ToggleRow label={labels.notifications.newApplications} checked={notifApplications} onChange={setNotifApplications} />
            <ToggleRow label={labels.notifications.newDrafts} checked={notifDrafts} onChange={setNotifDrafts} />
            <ToggleRow label={labels.notifications.systemAlerts} checked={notifAlerts} onChange={setNotifAlerts} />
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
                key={integration.name}
                className="flex items-center justify-between py-3"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
              >
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.80)" }}>{integration.name}</p>
                <span
                  className="text-xs px-2.5 py-0.5 rounded-full"
                  style={integration.connected ? { background: "rgba(74,222,128,0.10)", color: "#4ade80" } : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.35)" }}
                >
                  {integration.connected ? labels.integrations.connected : labels.integrations.comingSoon}
                </span>
              </div>
            ))}
          </SectionCard>
        )}

        {activeSection === "security" && isGlobalAdmin && (
          <SectionCard title={labels.security.title}>
            <ToggleRow label={labels.security.twoFactor} checked={twoFactor} onChange={setTwoFactor} />
            <div className="py-3">
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.80)" }}>{labels.security.sessions}</p>
              <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>1 active session</p>
            </div>
          </SectionCard>
        )}

        {activeSection === "security" && !isGlobalAdmin && (
          <div className="rounded-2xl p-6" style={{ background: "rgba(248,113,113,0.05)", border: "1px solid rgba(248,113,113,0.15)" }}>
            <div className="flex items-center gap-2">
              <Lock size={15} style={{ color: "#f87171" }} />
              <p className="text-sm" style={{ color: "#f87171" }}>{labels.security.restricted}</p>
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2.5 rounded-xl text-sm font-medium"
            style={{ background: "#3DA9E0", color: "#001731", boxShadow: "0 0 20px rgba(61,169,224,0.25)" }}
          >
            {labels.save}
          </button>
        </div>
      </div>
    </div>
  );
}

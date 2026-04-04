import {
  AlertCircle,
  Bell,
  CheckCircle2,
  CreditCard,
  Database,
  Globe,
  Key,
  Lock,
  MessageSquare,
  MonitorSmartphone,
  Palette,
  Plus,
  Search,
  Settings as SettingsIcon,
  Shield,
  Users as UsersIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { MOCK_USER_IMAGE } from "../data";

const TABS = [
  { id: "general", icon: SettingsIcon, label: "General" },
  { id: "appearance", icon: Palette, label: "Brand & Appearance" },
  { id: "team", icon: UsersIcon, label: "Team & Roles" },
  { id: "localization", icon: Globe, label: "AI Localization" },
  { id: "security", icon: Shield, label: "Security" },
  { id: "integrations", icon: Database, label: "Integrations" },
  { id: "notifications", icon: Bell, label: "Notifications" },
];

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState("general");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => setIsSaving(false), 1000);
  };

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-6xl space-y-8 pb-12"
      initial={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.5 }}
    >
      <header className="flex flex-col justify-between gap-6 pt-4 md:flex-row md:items-end">
        <div>
          <h1 className="font-light text-4xl text-white tracking-tight md:text-5xl">
            System Preferences
          </h1>
          <p className="mt-2 text-lg text-white/50">
            Configure your BISO OS experience and global settings.
          </p>
        </div>
        <button
          className="flex items-center gap-2 rounded-xl bg-[#3DA9E0] px-6 py-3 font-bold text-[#001731] shadow-[0_0_20px_rgba(61,169,224,0.3)] transition-all hover:shadow-[0_0_30px_rgba(61,169,224,0.5)] disabled:opacity-50"
          disabled={isSaving}
          onClick={handleSave}
        >
          {isSaving ? "Saving Changes..." : "Save Preferences"}
        </button>
      </header>

      <div className="mt-8 flex flex-col gap-12 lg:flex-row">
        {/* Settings Navigation */}
        <aside className="sticky top-8 h-fit w-full shrink-0 space-y-2 lg:w-64">
          {TABS.map((item) => (
            <button
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-all ${
                activeTab === item.id
                  ? "border border-white/10 bg-white/10 text-white shadow-sm backdrop-blur-md"
                  : "border border-transparent text-white/50 hover:bg-white/5 hover:text-white"
              }`}
              key={item.id}
              onClick={() => setActiveTab(item.id)}
            >
              <item.icon
                className={activeTab === item.id ? "text-[#3DA9E0]" : ""}
                size={18}
              />
              <span className="font-medium text-sm">{item.label}</span>
            </button>
          ))}
        </aside>

        {/* Settings Content */}
        <div className="min-w-0 flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
              exit={{ opacity: 0, y: -10 }}
              initial={{ opacity: 0, y: 10 }}
              key={activeTab}
              transition={{ duration: 0.2 }}
            >
              {/* GENERAL TAB */}
              {activeTab === "general" && (
                <section className="rounded-3xl border border-white/[0.05] bg-white/[0.02] p-8 backdrop-blur-sm">
                  <h2 className="mb-6 font-medium text-white text-xl">
                    Site Details
                  </h2>
                  <div className="max-w-xl space-y-6">
                    <div>
                      <label className="mb-2 block font-medium text-sm text-white/70">
                        Site Name
                      </label>
                      <input
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition-colors focus:border-[#3DA9E0]"
                        defaultValue="BISO Official"
                        type="text"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block font-medium text-sm text-white/70">
                        Primary Domain
                      </label>
                      <div className="flex">
                        <span className="inline-flex items-center rounded-l-xl border border-white/10 border-r-0 bg-white/5 px-4 text-sm text-white/40">
                          https://
                        </span>
                        <input
                          className="flex-1 rounded-r-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition-colors focus:border-[#3DA9E0]"
                          defaultValue="biso.no"
                          type="text"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-2 block font-medium text-sm text-white/70">
                        Support Email
                      </label>
                      <input
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition-colors focus:border-[#3DA9E0]"
                        defaultValue="contact@biso.no"
                        type="email"
                      />
                    </div>
                  </div>
                </section>
              )}

              {/* APPEARANCE TAB */}
              {activeTab === "appearance" && (
                <section className="rounded-3xl border border-white/[0.05] bg-white/[0.02] p-8 backdrop-blur-sm">
                  <h2 className="mb-6 font-medium text-white text-xl">
                    Brand Identity
                  </h2>
                  <div className="mb-8 grid grid-cols-1 gap-8 md:grid-cols-2">
                    <div>
                      <label className="mb-3 block font-medium text-sm text-white/70">
                        Primary Brand Color
                      </label>
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 cursor-pointer rounded-full border-2 border-white/20 bg-[#001731] shadow-[0_0_15px_rgba(0,23,49,0.5)]" />
                        <input
                          className="w-28 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 font-mono text-sm text-white outline-none transition-colors focus:border-[#3DA9E0]"
                          defaultValue="#001731"
                          type="text"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-3 block font-medium text-sm text-white/70">
                        Accent Color
                      </label>
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 cursor-pointer rounded-full border-2 border-white/20 bg-[#3DA9E0] shadow-[0_0_15px_rgba(61,169,224,0.5)]" />
                        <input
                          className="w-28 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 font-mono text-sm text-white outline-none transition-colors focus:border-[#3DA9E0]"
                          defaultValue="#3DA9E0"
                          type="text"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="max-w-xl space-y-6 border-white/10 border-t pt-6">
                    <div>
                      <label className="mb-2 block font-medium text-sm text-white/70">
                        Typography (Headings)
                      </label>
                      <select className="w-full appearance-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-serif text-white outline-none transition-colors focus:border-[#3DA9E0]">
                        <option>Playfair Display (Premium)</option>
                        <option>Inter (Modern)</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-2 block font-medium text-sm text-white/70">
                        Typography (Body)
                      </label>
                      <select className="w-full appearance-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition-colors focus:border-[#3DA9E0]">
                        <option>Inter</option>
                        <option>Roboto</option>
                      </select>
                    </div>
                  </div>
                </section>
              )}

              {/* TEAM TAB */}
              {activeTab === "team" && (
                <section className="rounded-3xl border border-white/[0.05] bg-white/[0.02] p-8 backdrop-blur-sm">
                  <div className="mb-8 flex items-center justify-between">
                    <h2 className="font-medium text-white text-xl">
                      Team & Roles
                    </h2>
                    <button className="flex items-center gap-2 rounded-xl border border-[#3DA9E0]/30 bg-[#3DA9E0]/10 px-4 py-2 font-semibold text-[#3DA9E0] text-sm transition-all hover:bg-[#3DA9E0]/20">
                      <Plus size={16} /> Invite Member
                    </button>
                  </div>

                  <div className="relative mb-6">
                    <Search
                      className="absolute top-1/2 left-4 -translate-y-1/2 text-white/40"
                      size={16}
                    />
                    <input
                      className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pr-4 pl-10 text-sm text-white outline-none transition-colors focus:border-[#3DA9E0]"
                      placeholder="Search team members..."
                      type="text"
                    />
                  </div>

                  <div className="space-y-2">
                    {[
                      {
                        name: "Alex Editor",
                        email: "alex@biso.no",
                        role: "Superadmin",
                        image: MOCK_USER_IMAGE,
                      },
                      {
                        name: "Sarah Jenkins",
                        email: "sarah@biso.no",
                        role: "Editor",
                        image:
                          "https://images.unsplash.com/photo-1770922809545-edc679cdf6d6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwb3J0cmFpdCUyMHByb2Zlc3Npb25hbCUyMHN0dWRlbnR8ZW58MXx8fHwxNzc1MjkyNTI4fDA&ixlib=rb-4.1.0&q=80&w=1080",
                      },
                      {
                        name: "Event Team",
                        email: "events@biso.no",
                        role: "Contributor",
                        image:
                          "https://images.unsplash.com/photo-1550305080-4e029753abcf?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxldmVudCUyMG5ldHdvcmtpbmclMjBzdHVkZW50c3xlbnwxfHx8fDE3NzUyOTMwODB8MA&ixlib=rb-4.1.0&q=80&w=1080",
                      },
                    ].map((user, i) => (
                      <div
                        className="group flex items-center justify-between rounded-2xl border border-white/5 bg-white/5 p-4 transition-colors hover:bg-white/10"
                        key={i}
                      >
                        <div className="flex items-center gap-4">
                          <img
                            alt={user.name}
                            className="h-10 w-10 rounded-full border border-white/10 object-cover"
                            src={user.image}
                          />
                          <div>
                            <p className="font-medium text-sm text-white">
                              {user.name}
                            </p>
                            <p className="text-white/40 text-xs">
                              {user.email}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span
                            className={`rounded-md border px-2.5 py-1 font-semibold text-[10px] uppercase tracking-wider ${
                              user.role === "Superadmin"
                                ? "border-[#3DA9E0]/30 bg-[#3DA9E0]/10 text-[#3DA9E0]"
                                : user.role === "Editor"
                                  ? "border-amber-400/30 bg-amber-400/10 text-amber-400"
                                  : "border-white/20 bg-white/10 text-white/70"
                            }`}
                          >
                            {user.role}
                          </span>
                          <button className="text-white/30 transition-colors hover:text-white">
                            <SettingsIcon size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* LOCALIZATION TAB */}
              {activeTab === "localization" && (
                <section className="rounded-3xl border border-white/[0.05] bg-white/[0.02] p-8 backdrop-blur-sm">
                  <h2 className="mb-6 flex items-center gap-3 font-medium text-white text-xl">
                    <Globe className="text-[#3DA9E0]" /> AI Localization Engine
                  </h2>
                  <p className="mb-8 max-w-2xl text-sm text-white/50 leading-relaxed">
                    BISO OS uses an advanced LLM pipeline to automatically
                    translate and localize content across your supported
                    languages while maintaining brand voice and student
                    terminology.
                  </p>

                  <div className="max-w-xl space-y-4">
                    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-5">
                      <div>
                        <p className="font-medium text-sm text-white">
                          Auto-Translate on Publish
                        </p>
                        <p className="mt-1 text-white/40 text-xs">
                          Automatically generate EN/NO variants.
                        </p>
                      </div>
                      <div className="relative h-5 w-10 cursor-pointer rounded-full bg-[#3DA9E0] shadow-[0_0_10px_rgba(61,169,224,0.3)]">
                        <div className="absolute top-0.5 right-1 h-4 w-4 rounded-full bg-[#001731] shadow-sm" />
                      </div>
                    </div>

                    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-5 opacity-70">
                      <div>
                        <p className="font-medium text-sm text-white">
                          Strict Glossary Enforcement
                        </p>
                        <p className="mt-1 text-white/40 text-xs">
                          Force AI to use exact terms for specific BISO
                          organizations.
                        </p>
                      </div>
                      <div className="relative h-5 w-10 cursor-pointer rounded-full bg-white/10">
                        <div className="absolute top-0.5 left-1 h-4 w-4 rounded-full bg-white/50 shadow-sm" />
                      </div>
                    </div>
                  </div>

                  <button className="mt-8 rounded-xl border border-white/10 px-5 py-2.5 font-medium text-sm text-white transition-colors hover:bg-white/5">
                    Manage Glossary Terms
                  </button>
                </section>
              )}

              {/* SECURITY TAB */}
              {activeTab === "security" && (
                <section className="space-y-12 rounded-3xl border border-white/[0.05] bg-white/[0.02] p-8 backdrop-blur-sm">
                  <div>
                    <h2 className="mb-6 flex items-center gap-3 font-medium text-white text-xl">
                      <Shield className="text-[#3DA9E0]" /> Authentication
                    </h2>
                    <div className="max-w-xl space-y-4">
                      <div className="flex items-center justify-between rounded-2xl border border-[#3DA9E0]/20 bg-[#3DA9E0]/5 p-5">
                        <div className="flex items-center gap-3">
                          <Lock className="text-[#3DA9E0]" size={20} />
                          <div>
                            <p className="font-medium text-sm text-white">
                              Two-Factor Authentication
                            </p>
                            <p className="mt-1 text-white/50 text-xs">
                              Require 2FA for all Superadmins and Editors.
                            </p>
                          </div>
                        </div>
                        <div className="relative h-5 w-10 cursor-pointer rounded-full bg-[#3DA9E0]">
                          <div className="absolute top-0.5 right-1 h-4 w-4 rounded-full bg-[#001731] shadow-sm" />
                        </div>
                      </div>
                      <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-5">
                        <div className="flex items-center gap-3">
                          <Key className="text-white/40" size={20} />
                          <div>
                            <p className="font-medium text-sm text-white">
                              SSO Login Only
                            </p>
                            <p className="mt-1 text-white/40 text-xs">
                              Disable password login, require BISO Microsoft
                              account.
                            </p>
                          </div>
                        </div>
                        <div className="relative h-5 w-10 cursor-pointer rounded-full bg-white/10">
                          <div className="absolute top-0.5 left-1 h-4 w-4 rounded-full bg-white/50 shadow-sm" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h2 className="mb-6 font-medium text-white text-xl">
                      Active Sessions
                    </h2>
                    <div className="max-w-xl space-y-2">
                      <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4">
                        <div className="flex items-center gap-4">
                          <div className="rounded-lg bg-emerald-400/10 p-2 text-emerald-400">
                            <MonitorSmartphone size={18} />
                          </div>
                          <div>
                            <p className="font-medium text-sm text-white">
                              MacBook Pro - Chrome
                            </p>
                            <p className="text-white/40 text-xs">
                              Oslo, Norway • Active now
                            </p>
                          </div>
                        </div>
                        <span className="rounded bg-emerald-400/10 px-2 py-1 font-mono text-emerald-400 text-xs">
                          Current
                        </span>
                      </div>
                      <div className="flex items-center justify-between rounded-2xl border border-transparent bg-transparent p-4 transition-all hover:border-white/10 hover:bg-white/5">
                        <div className="flex items-center gap-4">
                          <div className="rounded-lg bg-white/5 p-2 text-white/40">
                            <MonitorSmartphone size={18} />
                          </div>
                          <div>
                            <p className="font-medium text-sm text-white/80">
                              iPhone 14 Pro - Safari
                            </p>
                            <p className="text-white/40 text-xs">
                              Bergen, Norway • Last seen 2h ago
                            </p>
                          </div>
                        </div>
                        <button className="font-medium text-red-400 text-xs hover:text-red-300">
                          Revoke
                        </button>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {/* INTEGRATIONS TAB */}
              {activeTab === "integrations" && (
                <section className="rounded-3xl border border-white/[0.05] bg-white/[0.02] p-8 backdrop-blur-sm">
                  <h2 className="mb-6 font-medium text-white text-xl">
                    Connected Services
                  </h2>
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    {/* Appwrite */}
                    <div className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/5 p-6">
                      <div className="mb-4 flex items-start justify-between">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#F02E65]/30 bg-[#F02E65]/10">
                          <Database className="text-[#F02E65]" size={24} />
                        </div>
                        <span className="flex items-center gap-1 rounded-md bg-emerald-400/10 px-2.5 py-1 font-bold text-[10px] text-emerald-400 uppercase tracking-wider">
                          <CheckCircle2 size={12} /> Connected
                        </span>
                      </div>
                      <h3 className="mb-2 font-medium text-lg text-white">
                        Appwrite
                      </h3>
                      <p className="mb-6 flex-1 text-sm text-white/50">
                        Core backend database, auth, and storage infrastructure
                        powering BISO OS.
                      </p>
                      <button className="w-full rounded-lg border border-white/10 py-2 text-sm text-white/70 transition-colors hover:bg-white/5 hover:text-white">
                        Manage Connection
                      </button>
                    </div>

                    {/* Stripe */}
                    <div className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/5 p-6">
                      <div className="mb-4 flex items-start justify-between">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#635BFF]/30 bg-[#635BFF]/10">
                          <CreditCard className="text-[#635BFF]" size={24} />
                        </div>
                        <span className="flex items-center gap-1 rounded-md bg-emerald-400/10 px-2.5 py-1 font-bold text-[10px] text-emerald-400 uppercase tracking-wider">
                          <CheckCircle2 size={12} /> Connected
                        </span>
                      </div>
                      <h3 className="mb-2 font-medium text-lg text-white">
                        Stripe
                      </h3>
                      <p className="mb-6 flex-1 text-sm text-white/50">
                        Payment processing for webshop products and event
                        ticketing.
                      </p>
                      <button className="w-full rounded-lg border border-white/10 py-2 text-sm text-white/70 transition-colors hover:bg-white/5 hover:text-white">
                        Manage Keys
                      </button>
                    </div>

                    {/* Slack */}
                    <div className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/5 p-6">
                      <div className="mb-4 flex items-start justify-between">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                          <MessageSquare className="text-white/60" size={24} />
                        </div>
                      </div>
                      <h3 className="mb-2 font-medium text-lg text-white">
                        Slack
                      </h3>
                      <p className="mb-6 flex-1 text-sm text-white/50">
                        Send notifications for drafts awaiting review or system
                        alerts directly to Slack channels.
                      </p>
                      <button className="w-full rounded-lg border border-[#3DA9E0]/30 bg-[#3DA9E0]/10 py-2 font-medium text-[#3DA9E0] text-sm transition-colors hover:bg-[#3DA9E0]/20">
                        Connect Slack
                      </button>
                    </div>
                  </div>
                </section>
              )}

              {/* NOTIFICATIONS TAB */}
              {activeTab === "notifications" && (
                <section className="rounded-3xl border border-white/[0.05] bg-white/[0.02] p-8 backdrop-blur-sm">
                  <h2 className="mb-6 font-medium text-white text-xl">
                    Notification Preferences
                  </h2>

                  <div className="max-w-2xl space-y-8">
                    <div className="space-y-4">
                      <h3 className="mb-4 border-white/5 border-b pb-2 font-bold text-sm text-white/40 uppercase tracking-widest">
                        Email Alerts
                      </h3>

                      <div className="flex items-center justify-between rounded-xl p-4 transition-colors hover:bg-white/5">
                        <div>
                          <p className="font-medium text-sm text-white">
                            Draft Reviews
                          </p>
                          <p className="mt-1 text-white/40 text-xs">
                            Get notified when someone submits content for
                            review.
                          </p>
                        </div>
                        <div className="relative h-5 w-10 cursor-pointer rounded-full bg-[#3DA9E0]">
                          <div className="absolute top-0.5 right-1 h-4 w-4 rounded-full bg-[#001731] shadow-sm" />
                        </div>
                      </div>

                      <div className="flex items-center justify-between rounded-xl p-4 transition-colors hover:bg-white/5">
                        <div>
                          <p className="font-medium text-sm text-white">
                            New Job Applications
                          </p>
                          <p className="mt-1 text-white/40 text-xs">
                            Receive an email when a student applies for an
                            active job.
                          </p>
                        </div>
                        <div className="relative h-5 w-10 cursor-pointer rounded-full bg-[#3DA9E0]">
                          <div className="absolute top-0.5 right-1 h-4 w-4 rounded-full bg-[#001731] shadow-sm" />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="mb-4 border-white/5 border-b pb-2 font-bold text-sm text-white/40 uppercase tracking-widest">
                        System Warnings
                      </h3>

                      <div className="flex items-center justify-between rounded-xl p-4 transition-colors hover:bg-white/5">
                        <div className="flex items-center gap-3">
                          <AlertCircle className="text-amber-400" size={18} />
                          <div>
                            <p className="font-medium text-sm text-white">
                              Low Stock Alerts
                            </p>
                            <p className="mt-1 text-white/40 text-xs">
                              Warn me when webshop products drop below 10 items.
                            </p>
                          </div>
                        </div>
                        <div className="relative h-5 w-10 cursor-pointer rounded-full bg-[#3DA9E0]">
                          <div className="absolute top-0.5 right-1 h-4 w-4 rounded-full bg-[#001731] shadow-sm" />
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

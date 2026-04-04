import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Settings as SettingsIcon, Globe, Palette, Users as UsersIcon, 
  Shield, Database, Bell, Search, Plus, CreditCard, MessageSquare, 
  MonitorSmartphone, Key, Mail, Lock, CheckCircle2, AlertCircle
} from "lucide-react";
import { MOCK_USER_IMAGE } from "../data";

const TABS = [
  { id: 'general', icon: SettingsIcon, label: 'General' },
  { id: 'appearance', icon: Palette, label: 'Brand & Appearance' },
  { id: 'team', icon: UsersIcon, label: 'Team & Roles' },
  { id: 'localization', icon: Globe, label: 'AI Localization' },
  { id: 'security', icon: Shield, label: 'Security' },
  { id: 'integrations', icon: Database, label: 'Integrations' },
  { id: 'notifications', icon: Bell, label: 'Notifications' },
];

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState('general');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => setIsSaving(false), 1000);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-8 pb-12 max-w-6xl mx-auto"
    >
      <header className="pt-4 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-light tracking-tight text-white">
            System Preferences
          </h1>
          <p className="text-white/50 mt-2 text-lg">Configure your BISO OS experience and global settings.</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="px-6 py-3 rounded-xl bg-[#3DA9E0] text-[#001731] font-bold shadow-[0_0_20px_rgba(61,169,224,0.3)] hover:shadow-[0_0_30px_rgba(61,169,224,0.5)] transition-all flex items-center gap-2 disabled:opacity-50"
        >
          {isSaving ? 'Saving Changes...' : 'Save Preferences'}
        </button>
      </header>

      <div className="flex flex-col lg:flex-row gap-12 mt-8">
        {/* Settings Navigation */}
        <aside className="w-full lg:w-64 shrink-0 space-y-2 sticky top-8 h-fit">
          {TABS.map(item => (
            <button 
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left ${
                activeTab === item.id 
                  ? 'bg-white/10 text-white border border-white/10 shadow-sm backdrop-blur-md' 
                  : 'text-white/50 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <item.icon size={18} className={activeTab === item.id ? 'text-[#3DA9E0]' : ''} />
              <span className="font-medium text-sm">{item.label}</span>
            </button>
          ))}
        </aside>

        {/* Settings Content */}
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-8"
            >
              {/* GENERAL TAB */}
              {activeTab === 'general' && (
                <section className="bg-white/[0.02] border border-white/[0.05] rounded-3xl p-8 backdrop-blur-sm">
                  <h2 className="text-xl font-medium text-white mb-6">Site Details</h2>
                  <div className="space-y-6 max-w-xl">
                    <div>
                      <label className="text-sm font-medium text-white/70 mb-2 block">Site Name</label>
                      <input type="text" defaultValue="BISO Official" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-[#3DA9E0] transition-colors" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-white/70 mb-2 block">Primary Domain</label>
                      <div className="flex">
                        <span className="inline-flex items-center px-4 rounded-l-xl border border-r-0 border-white/10 bg-white/5 text-white/40 text-sm">https://</span>
                        <input type="text" defaultValue="biso.no" className="flex-1 bg-white/5 border border-white/10 rounded-r-xl px-4 py-3 text-white outline-none focus:border-[#3DA9E0] transition-colors" />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-white/70 mb-2 block">Support Email</label>
                      <input type="email" defaultValue="contact@biso.no" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-[#3DA9E0] transition-colors" />
                    </div>
                  </div>
                </section>
              )}

              {/* APPEARANCE TAB */}
              {activeTab === 'appearance' && (
                <section className="bg-white/[0.02] border border-white/[0.05] rounded-3xl p-8 backdrop-blur-sm">
                  <h2 className="text-xl font-medium text-white mb-6">Brand Identity</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                    <div>
                      <label className="text-sm font-medium text-white/70 mb-3 block">Primary Brand Color</label>
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-[#001731] border-2 border-white/20 shadow-[0_0_15px_rgba(0,23,49,0.5)] cursor-pointer" />
                        <input type="text" defaultValue="#001731" className="w-28 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white outline-none focus:border-[#3DA9E0] transition-colors font-mono text-sm" />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-white/70 mb-3 block">Accent Color</label>
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-[#3DA9E0] border-2 border-white/20 shadow-[0_0_15px_rgba(61,169,224,0.5)] cursor-pointer" />
                        <input type="text" defaultValue="#3DA9E0" className="w-28 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white outline-none focus:border-[#3DA9E0] transition-colors font-mono text-sm" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6 pt-6 border-t border-white/10 max-w-xl">
                    <div>
                      <label className="text-sm font-medium text-white/70 mb-2 block">Typography (Headings)</label>
                      <select className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-[#3DA9E0] transition-colors appearance-none font-serif">
                        <option>Playfair Display (Premium)</option>
                        <option>Inter (Modern)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-white/70 mb-2 block">Typography (Body)</label>
                      <select className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-[#3DA9E0] transition-colors appearance-none">
                        <option>Inter</option>
                        <option>Roboto</option>
                      </select>
                    </div>
                  </div>
                </section>
              )}

              {/* TEAM TAB */}
              {activeTab === 'team' && (
                <section className="bg-white/[0.02] border border-white/[0.05] rounded-3xl p-8 backdrop-blur-sm">
                  <div className="flex items-center justify-between mb-8">
                    <h2 className="text-xl font-medium text-white">Team & Roles</h2>
                    <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#3DA9E0]/10 text-[#3DA9E0] text-sm font-semibold hover:bg-[#3DA9E0]/20 transition-all border border-[#3DA9E0]/30">
                      <Plus size={16} /> Invite Member
                    </button>
                  </div>
                  
                  <div className="relative mb-6">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={16} />
                    <input type="text" placeholder="Search team members..." className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white outline-none focus:border-[#3DA9E0] transition-colors" />
                  </div>

                  <div className="space-y-2">
                    {[
                      { name: 'Alex Editor', email: 'alex@biso.no', role: 'Superadmin', image: MOCK_USER_IMAGE },
                      { name: 'Sarah Jenkins', email: 'sarah@biso.no', role: 'Editor', image: 'https://images.unsplash.com/photo-1770922809545-edc679cdf6d6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwb3J0cmFpdCUyMHByb2Zlc3Npb25hbCUyMHN0dWRlbnR8ZW58MXx8fHwxNzc1MjkyNTI4fDA&ixlib=rb-4.1.0&q=80&w=1080' },
                      { name: 'Event Team', email: 'events@biso.no', role: 'Contributor', image: 'https://images.unsplash.com/photo-1550305080-4e029753abcf?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxldmVudCUyMG5ldHdvcmtpbmclMjBzdHVkZW50c3xlbnwxfHx8fDE3NzUyOTMwODB8MA&ixlib=rb-4.1.0&q=80&w=1080' },
                    ].map((user, i) => (
                      <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors group">
                        <div className="flex items-center gap-4">
                          <img src={user.image} alt={user.name} className="w-10 h-10 rounded-full object-cover border border-white/10" />
                          <div>
                            <p className="text-white font-medium text-sm">{user.name}</p>
                            <p className="text-white/40 text-xs">{user.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className={`px-2.5 py-1 rounded-md text-[10px] uppercase tracking-wider font-semibold border ${
                            user.role === 'Superadmin' ? 'bg-[#3DA9E0]/10 text-[#3DA9E0] border-[#3DA9E0]/30' : 
                            user.role === 'Editor' ? 'bg-amber-400/10 text-amber-400 border-amber-400/30' : 
                            'bg-white/10 text-white/70 border-white/20'
                          }`}>
                            {user.role}
                          </span>
                          <button className="text-white/30 hover:text-white transition-colors">
                            <SettingsIcon size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* LOCALIZATION TAB */}
              {activeTab === 'localization' && (
                <section className="bg-white/[0.02] border border-white/[0.05] rounded-3xl p-8 backdrop-blur-sm">
                  <h2 className="text-xl font-medium text-white mb-6 flex items-center gap-3">
                    <Globe className="text-[#3DA9E0]" /> AI Localization Engine
                  </h2>
                  <p className="text-white/50 text-sm mb-8 max-w-2xl leading-relaxed">
                    BISO OS uses an advanced LLM pipeline to automatically translate and localize content across your supported languages while maintaining brand voice and student terminology.
                  </p>
                  
                  <div className="space-y-4 max-w-xl">
                    <div className="flex items-center justify-between p-5 rounded-2xl border border-white/10 bg-white/5">
                      <div>
                        <p className="text-white font-medium text-sm">Auto-Translate on Publish</p>
                        <p className="text-white/40 text-xs mt-1">Automatically generate EN/NO variants.</p>
                      </div>
                      <div className="relative w-10 h-5 rounded-full bg-[#3DA9E0] cursor-pointer shadow-[0_0_10px_rgba(61,169,224,0.3)]">
                        <div className="absolute right-1 top-0.5 w-4 h-4 rounded-full bg-[#001731] shadow-sm" />
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between p-5 rounded-2xl border border-white/10 bg-white/5 opacity-70">
                      <div>
                        <p className="text-white font-medium text-sm">Strict Glossary Enforcement</p>
                        <p className="text-white/40 text-xs mt-1">Force AI to use exact terms for specific BISO organizations.</p>
                      </div>
                      <div className="relative w-10 h-5 rounded-full bg-white/10 cursor-pointer">
                        <div className="absolute left-1 top-0.5 w-4 h-4 rounded-full bg-white/50 shadow-sm" />
                      </div>
                    </div>
                  </div>
                  
                  <button className="mt-8 px-5 py-2.5 rounded-xl border border-white/10 text-white text-sm font-medium hover:bg-white/5 transition-colors">
                    Manage Glossary Terms
                  </button>
                </section>
              )}

              {/* SECURITY TAB */}
              {activeTab === 'security' && (
                <section className="bg-white/[0.02] border border-white/[0.05] rounded-3xl p-8 backdrop-blur-sm space-y-12">
                  <div>
                    <h2 className="text-xl font-medium text-white mb-6 flex items-center gap-3">
                      <Shield className="text-[#3DA9E0]" /> Authentication
                    </h2>
                    <div className="space-y-4 max-w-xl">
                      <div className="flex items-center justify-between p-5 rounded-2xl border border-[#3DA9E0]/20 bg-[#3DA9E0]/5">
                        <div className="flex items-center gap-3">
                          <Lock className="text-[#3DA9E0]" size={20} />
                          <div>
                            <p className="text-white font-medium text-sm">Two-Factor Authentication</p>
                            <p className="text-white/50 text-xs mt-1">Require 2FA for all Superadmins and Editors.</p>
                          </div>
                        </div>
                        <div className="relative w-10 h-5 rounded-full bg-[#3DA9E0] cursor-pointer">
                          <div className="absolute right-1 top-0.5 w-4 h-4 rounded-full bg-[#001731] shadow-sm" />
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-5 rounded-2xl border border-white/10 bg-white/5">
                        <div className="flex items-center gap-3">
                          <Key className="text-white/40" size={20} />
                          <div>
                            <p className="text-white font-medium text-sm">SSO Login Only</p>
                            <p className="text-white/40 text-xs mt-1">Disable password login, require BISO Microsoft account.</p>
                          </div>
                        </div>
                        <div className="relative w-10 h-5 rounded-full bg-white/10 cursor-pointer">
                          <div className="absolute left-1 top-0.5 w-4 h-4 rounded-full bg-white/50 shadow-sm" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h2 className="text-xl font-medium text-white mb-6">Active Sessions</h2>
                    <div className="space-y-2 max-w-xl">
                      <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10">
                        <div className="flex items-center gap-4">
                          <div className="p-2 bg-emerald-400/10 text-emerald-400 rounded-lg"><MonitorSmartphone size={18} /></div>
                          <div>
                            <p className="text-white font-medium text-sm">MacBook Pro - Chrome</p>
                            <p className="text-white/40 text-xs">Oslo, Norway • Active now</p>
                          </div>
                        </div>
                        <span className="text-xs font-mono text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded">Current</span>
                      </div>
                      <div className="flex items-center justify-between p-4 rounded-2xl bg-transparent hover:bg-white/5 border border-transparent hover:border-white/10 transition-all">
                        <div className="flex items-center gap-4">
                          <div className="p-2 bg-white/5 text-white/40 rounded-lg"><MonitorSmartphone size={18} /></div>
                          <div>
                            <p className="text-white/80 font-medium text-sm">iPhone 14 Pro - Safari</p>
                            <p className="text-white/40 text-xs">Bergen, Norway • Last seen 2h ago</p>
                          </div>
                        </div>
                        <button className="text-xs text-red-400 hover:text-red-300 font-medium">Revoke</button>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {/* INTEGRATIONS TAB */}
              {activeTab === 'integrations' && (
                <section className="bg-white/[0.02] border border-white/[0.05] rounded-3xl p-8 backdrop-blur-sm">
                  <h2 className="text-xl font-medium text-white mb-6">Connected Services</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Appwrite */}
                    <div className="p-6 rounded-2xl bg-white/5 border border-white/10 flex flex-col h-full">
                      <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 rounded-xl bg-[#F02E65]/10 flex items-center justify-center border border-[#F02E65]/30">
                          <Database size={24} className="text-[#F02E65]" />
                        </div>
                        <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded-md">
                          <CheckCircle2 size={12} /> Connected
                        </span>
                      </div>
                      <h3 className="text-lg font-medium text-white mb-2">Appwrite</h3>
                      <p className="text-sm text-white/50 mb-6 flex-1">Core backend database, auth, and storage infrastructure powering BISO OS.</p>
                      <button className="w-full py-2 rounded-lg border border-white/10 text-white/70 hover:text-white hover:bg-white/5 transition-colors text-sm">Manage Connection</button>
                    </div>

                    {/* Stripe */}
                    <div className="p-6 rounded-2xl bg-white/5 border border-white/10 flex flex-col h-full">
                      <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 rounded-xl bg-[#635BFF]/10 flex items-center justify-center border border-[#635BFF]/30">
                          <CreditCard size={24} className="text-[#635BFF]" />
                        </div>
                        <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded-md">
                          <CheckCircle2 size={12} /> Connected
                        </span>
                      </div>
                      <h3 className="text-lg font-medium text-white mb-2">Stripe</h3>
                      <p className="text-sm text-white/50 mb-6 flex-1">Payment processing for webshop products and event ticketing.</p>
                      <button className="w-full py-2 rounded-lg border border-white/10 text-white/70 hover:text-white hover:bg-white/5 transition-colors text-sm">Manage Keys</button>
                    </div>

                    {/* Slack */}
                    <div className="p-6 rounded-2xl bg-white/5 border border-white/10 flex flex-col h-full">
                      <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
                          <MessageSquare size={24} className="text-white/60" />
                        </div>
                      </div>
                      <h3 className="text-lg font-medium text-white mb-2">Slack</h3>
                      <p className="text-sm text-white/50 mb-6 flex-1">Send notifications for drafts awaiting review or system alerts directly to Slack channels.</p>
                      <button className="w-full py-2 rounded-lg bg-[#3DA9E0]/10 text-[#3DA9E0] font-medium border border-[#3DA9E0]/30 hover:bg-[#3DA9E0]/20 transition-colors text-sm">Connect Slack</button>
                    </div>
                  </div>
                </section>
              )}

              {/* NOTIFICATIONS TAB */}
              {activeTab === 'notifications' && (
                <section className="bg-white/[0.02] border border-white/[0.05] rounded-3xl p-8 backdrop-blur-sm">
                  <h2 className="text-xl font-medium text-white mb-6">Notification Preferences</h2>
                  
                  <div className="space-y-8 max-w-2xl">
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold tracking-widest uppercase text-white/40 mb-4 border-b border-white/5 pb-2">Email Alerts</h3>
                      
                      <div className="flex items-center justify-between p-4 rounded-xl hover:bg-white/5 transition-colors">
                        <div>
                          <p className="text-white font-medium text-sm">Draft Reviews</p>
                          <p className="text-white/40 text-xs mt-1">Get notified when someone submits content for review.</p>
                        </div>
                        <div className="relative w-10 h-5 rounded-full bg-[#3DA9E0] cursor-pointer">
                          <div className="absolute right-1 top-0.5 w-4 h-4 rounded-full bg-[#001731] shadow-sm" />
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-4 rounded-xl hover:bg-white/5 transition-colors">
                        <div>
                          <p className="text-white font-medium text-sm">New Job Applications</p>
                          <p className="text-white/40 text-xs mt-1">Receive an email when a student applies for an active job.</p>
                        </div>
                        <div className="relative w-10 h-5 rounded-full bg-[#3DA9E0] cursor-pointer">
                          <div className="absolute right-1 top-0.5 w-4 h-4 rounded-full bg-[#001731] shadow-sm" />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-sm font-bold tracking-widest uppercase text-white/40 mb-4 border-b border-white/5 pb-2">System Warnings</h3>
                      
                      <div className="flex items-center justify-between p-4 rounded-xl hover:bg-white/5 transition-colors">
                        <div className="flex items-center gap-3">
                          <AlertCircle className="text-amber-400" size={18} />
                          <div>
                            <p className="text-white font-medium text-sm">Low Stock Alerts</p>
                            <p className="text-white/40 text-xs mt-1">Warn me when webshop products drop below 10 items.</p>
                          </div>
                        </div>
                        <div className="relative w-10 h-5 rounded-full bg-[#3DA9E0] cursor-pointer">
                          <div className="absolute right-1 top-0.5 w-4 h-4 rounded-full bg-[#001731] shadow-sm" />
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

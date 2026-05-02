import React from "react";
import { 
  Settings, Cpu, Database, BrainCircuit, Palette, 
  Terminal, Shield, FlaskConical, Save, Trash2, 
  Layers, Download, Layout, Sparkles, Key, 
  Gauge, Sun, Moon, Eye, FileText
} from "lucide-react";
import { AppSettings } from "../types";
import { cn } from "../lib/utils";

interface TabSettingsProps {
  settings: AppSettings;
  setSettings: (settings: AppSettings) => void;
}

export function TabSettings({ settings, setSettings }: TabSettingsProps) {
  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings({ ...settings, [key]: value });
  };

  const Section = ({ title, icon: Icon, children }: { title: string, icon: any, children: React.ReactNode }) => (
    <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
          <Icon className="w-5 h-5 text-slate-600" />
        </div>
        <h2 className="text-xl font-black text-slate-800 tracking-tight">{title}</h2>
      </div>
      <div className="space-y-6">
        {children}
      </div>
    </div>
  );

  const SettingRow = ({ label, desc, children }: { label: string, desc: string, children: React.ReactNode }) => (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-50 last:border-0 last:pb-0">
      <div className="max-w-md">
        <h3 className="text-sm font-bold text-slate-800 mb-1">{label}</h3>
        <p className="text-[11px] text-slate-500 font-medium leading-relaxed">{desc}</p>
      </div>
      <div className="flex-shrink-0">
        {children}
      </div>
    </div>
  );

  return (
    <div className="h-full space-y-8 overflow-y-auto pr-2 custom-scrollbar pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter">System Configuration</h1>
          <p className="text-slate-500 text-sm font-medium">Manage your analytical engine and environment preferences.</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-full text-[10px] font-black uppercase tracking-widest border border-green-100 italic">
          <Shield className="w-3 h-3" /> All changes synced to cloud
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {/* API & AI Model Control */}
        <Section title="AI Intelligence Core" icon={BrainCircuit}>
          <SettingRow 
            label="Generative Model Selection" 
            desc="Choose between high-precision reasoning (Pro) or lightning-fast low-cost processing (Flash)."
          >
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button 
                onClick={() => updateSetting("model", "gemini-1.5-pro")}
                className={cn("px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all", 
                  settings.model === "gemini-1.5-pro" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700")}
              >
                1.5 Pro
              </button>
              <button 
                onClick={() => updateSetting("model", "gemini-1.5-flash")}
                className={cn("px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all", 
                  settings.model === "gemini-1.5-flash" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700")}
              >
                1.5 Flash
              </button>
            </div>
          </SettingRow>

          <SettingRow 
            label="Inference Temperature" 
            desc="Controls randomness. Lower values are more deterministic and precise; higher values are more creative."
          >
            <div className="flex items-center gap-4 w-64">
              <Gauge className="w-4 h-4 text-slate-400" />
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.1" 
                value={settings.temperature}
                onChange={(e) => updateSetting("temperature", parseFloat(e.target.value))}
                className="flex-1 accent-blue-600"
              />
              <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">{settings.temperature}</span>
            </div>
          </SettingRow>

          <SettingRow 
            label="Custom API Keys" 
            desc="Provide your own Google AI Studio keys to bypass global system rate limits."
          >
            <div className="flex gap-2">
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input 
                  type="password" 
                  placeholder="AI_STUDIO_KEY_••••••••"
                  className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs w-64 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                />
              </div>
              <button className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase">Apply</button>
            </div>
          </SettingRow>
        </Section>

        {/* Engine & Language Settings */}
        <Section title="Processing Engine" icon={Cpu}>
          <SettingRow 
            label="Computational Runtime" 
            desc="Toggle between Python (Pandas/NumPy) for ML and standard analysis, or R (Tidyverse) for statistical rigor."
          >
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button 
                onClick={() => updateSetting("engine", "python")}
                className={cn("px-6 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center gap-2", 
                  settings.engine === "python" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700")}
              >
                Python <span className="opacity-30 text-[8px]">v3.11</span>
              </button>
              <button 
                onClick={() => updateSetting("engine", "r")}
                className={cn("px-6 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center gap-2", 
                  settings.engine === "r" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700")}
              >
                R Language <span className="opacity-30 text-[8px]">v4.3</span>
              </button>
            </div>
          </SettingRow>

          <SettingRow 
            label="Developer Diagnostics" 
            desc="Enable detailed performance tracing, raw API metadata, and execution time stamps across all modules."
          >
            <button 
              onClick={() => updateSetting("developerMode", !settings.developerMode)}
              className={cn("w-12 h-6 rounded-full transition-all relative", settings.developerMode ? "bg-blue-600" : "bg-slate-200")}
            >
              <div className={cn("absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm", settings.developerMode ? "right-1" : "left-1")} />
            </button>
          </SettingRow>

          <SettingRow 
            label="Environment Packages" 
            desc="View integrated libraries and system dependencies."
          >
            <button className="flex items-center gap-2 px-4 py-2 bg-slate-50 text-slate-600 border border-slate-200 rounded-xl text-[10px] font-black uppercase hover:bg-slate-100 transition-colors">
              <FlaskConical className="w-3.5 h-3.5" /> Manage Libraries
            </button>
          </SettingRow>
        </Section>

        {/* Database & Storage */}
        <Section title="Storage & Connectivity" icon={Database}>
          <SettingRow 
            label="External DB Connection" 
            desc="Connect to live PostgreSQL, MySQL, or BigQuery instances for real-time querying."
          >
             <input 
              value={settings.dbConnectionString}
              onChange={(e) => updateSetting("dbConnectionString", e.target.value)}
              placeholder="postgresql://user:pass@host:port/dbname"
              className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs w-80 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
            />
          </SettingRow>

          <SettingRow 
            label="Persistence Strategy" 
            desc="Choose how datasets are managed. Permanent mode uses SQLite for safer, long-term storage."
          >
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button 
                onClick={() => updateSetting("storageType", "cache")}
                className={cn("px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all", 
                  settings.storageType === "cache" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700")}
              >
                Volatile Cache
              </button>
              <button 
                onClick={() => updateSetting("storageType", "permanent")}
                className={cn("px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center gap-2", 
                  settings.storageType === "permanent" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700")}
              >
                SQLite Persistence <Save className="w-3 h-3" />
              </button>
            </div>
          </SettingRow>

          <SettingRow 
            label="Auto-Cleanup Engine" 
            desc="Automatically purge temporary query results and scraped exports after 24 hours to optimize cloud resources."
          >
            <button 
              onClick={() => updateSetting("autoCleanup", !settings.autoCleanup)}
              className={cn("w-12 h-6 rounded-full transition-all relative", settings.autoCleanup ? "bg-red-500" : "bg-slate-200")}
            >
              <div className={cn("absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm", settings.autoCleanup ? "right-1" : "left-1")} />
            </button>
          </SettingRow>
        </Section>

        {/* Personalization & UI */}
        <Section title="Workspace Persona" icon={Palette}>
          <SettingRow 
            label="Interface Theme" 
            desc="Select a visual profile that matches your work environment."
          >
            <div className="flex gap-2">
              {[
                { id: "cyberpunk", label: "Cyberpunk", icon: Moon, color: "bg-slate-900" },
                { id: "light", label: "Clean Light", icon: Sun, color: "bg-slate-50" },
                { id: "contrast", label: "High Contrast", icon: Eye, color: "bg-white border-2 border-black" }
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => updateSetting("theme", t.id as any)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-black uppercase transition-all border",
                    settings.theme === t.id ? "border-blue-500 ring-2 ring-blue-500/20" : "border-slate-200"
                  )}
                >
                  <div className={cn("w-3 h-3 rounded-full", t.color)} />
                  {t.label}
                </button>
              ))}
            </div>
          </SettingRow>

          <SettingRow 
            label="Module Layout" 
            desc="Arrange input editors and result panels to maximize focused screen space."
          >
             <div className="flex bg-slate-100 p-1 rounded-xl">
              <button 
                onClick={() => updateSetting("layout", "side-by-side")}
                className={cn("px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center gap-2", 
                  settings.layout === "side-by-side" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700")}
              >
                Side Panels <Layout className="w-3 h-3" />
              </button>
              <button 
                onClick={() => updateSetting("layout", "stacked")}
                className={cn("px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center gap-2", 
                  settings.layout === "stacked" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700")}
              >
                Adaptive Stack <Layers className="w-3 h-3" />
              </button>
            </div>
          </SettingRow>

          <SettingRow 
            label="Default Export Strategy" 
            desc="The preferred file format used when clicking generic 'Download' or 'Export' buttons."
          >
            <div className="flex gap-2">
              {[
                { id: "pdf", label: "Professional PDF", icon: FileText },
                { id: "excel", label: "Excel Spreadsheet", icon: Download },
                { id: "markdown", label: "Markdown Docs", icon: Database }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => updateSetting("exportFormat", f.id as any)}
                  className={cn(
                    "p-2 rounded-xl border transition-all",
                    settings.exportFormat === f.id ? "bg-blue-50 border-blue-200 text-blue-600" : "bg-white border-slate-200 text-slate-400"
                  )}
                  title={f.label}
                >
                  <f.icon className="w-5 h-5" />
                </button>
              ))}
            </div>
          </SettingRow>
        </Section>
      </div>

      <div className="flex items-center justify-center p-8 opacity-20 hover:opacity-100 transition-opacity">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-4">
          <Terminal className="w-4 h-4" /> DataMind AI Core v2.4.0-Stable <Sparkles className="w-4 h-4" />
        </p>
      </div>
    </div>
  );
}

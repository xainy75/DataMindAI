import React from "react";
import { 
  Home,
  Database, 
  Globe, 
  BrainCircuit, 
  LayoutDashboard, 
  Settings,
  ChevronRight
} from "lucide-react";
import { cn } from "../lib/utils";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
}

export function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  const menuItems = [
    { id: "home", label: "Home", icon: Home },
    { id: "sql", label: "SQL Runner", icon: Database },
    { id: "scraper", label: "Web Scraper", icon: Globe },
    { id: "analyzer", label: "AI Analyzer", icon: BrainCircuit },
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  ];

  return (
    <div className="w-64 bg-[#0F172A] text-white flex flex-col p-4 shadow-2xl">
      <div className="flex items-center gap-3 px-2 py-6 mb-4">
        <div className="w-10 h-10 bg-[#1a73e8] rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
          <BrainCircuit className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold tracking-tight">DataMind AI</h1>
      </div>

      <nav className="space-y-1 flex-1">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group text-sm font-medium",
              activeTab === item.id 
                ? "bg-[#1a73e8] text-white shadow-md shadow-blue-500/20" 
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            )}
          >
            <item.icon className={cn("w-5 h-5", activeTab === item.id ? "text-white" : "text-slate-500 group-hover:text-slate-300")} />
            {item.label}
            {activeTab === item.id && <ChevronRight className="ml-auto w-4 h-4 opacity-50" />}
          </button>
        ))}
      </nav>

      <div className="mt-auto border-t border-slate-800 pt-4 space-y-1">
        <button 
          onClick={() => setActiveTab("settings")}
          className={cn(
            "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group text-sm font-medium",
            activeTab === "settings" 
              ? "bg-[#1a73e8] text-white shadow-md shadow-blue-500/20" 
              : "text-slate-400 hover:text-white hover:bg-slate-800"
          )}
        >
          <Settings className={cn("w-5 h-5", activeTab === "settings" ? "text-white" : "text-slate-500 group-hover:text-slate-300")} />
          Settings
        </button>
      </div>
    </div>
  );
}

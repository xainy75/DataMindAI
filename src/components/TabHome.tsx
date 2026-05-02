import React from "react";
import { 
  Home, Database, Globe, BrainCircuit, LayoutDashboard, Clock, Star, 
  ChevronRight, ArrowUpRight, BarChart3, ListChecks, Calendar, 
  Sparkles, History as HistoryIcon, Bookmark
} from "lucide-react";
import { Tab, AppHistoryItem, SavedWorkItem } from "../types";
import { cn } from "../lib/utils";

interface TabHomeProps {
  setActiveTab: (tab: Tab) => void;
  history: AppHistoryItem[];
  savedWork: SavedWorkItem[];
}

export function TabHome({ setActiveTab, history, savedWork }: TabHomeProps) {
  const dailyTasks = [
    { id: 1, text: "Analyze yesterday's sales data", completed: true },
    { id: 2, text: "Scrape competitor pricing updates", completed: false },
    { id: 3, text: "Update regional performance dashboard", completed: false },
    { id: 4, text: "Run SQL audit on new user registrations", completed: false },
  ];

  const modules = [
    { 
      id: "sql", 
      name: "SQL Runner", 
      desc: "Query & manipulate data", 
      icon: Database, 
      color: "text-blue-600", 
      bg: "bg-blue-50" 
    },
    { 
      id: "scraper", 
      name: "Web Scraper", 
      desc: "Extract data from URLs", 
      icon: Globe, 
      color: "text-emerald-600", 
      bg: "bg-emerald-50" 
    },
    { 
      id: "analyzer", 
      name: "AI Analyzer", 
      desc: "Deep statistical insights", 
      icon: BrainCircuit, 
      color: "text-purple-600", 
      bg: "bg-purple-50" 
    },
    { 
      id: "dashboard", 
      name: "Visual Studio", 
      desc: "Build BI dashboards", 
      icon: LayoutDashboard, 
      color: "text-orange-600", 
      bg: "bg-orange-50" 
    },
  ];

  return (
    <div className="h-full space-y-8 overflow-y-auto pr-2 custom-scrollbar pb-12">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-slate-900 rounded-[2rem] p-10 text-white shadow-2xl">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <span className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-500/30">
              System Active
            </span>
            <span className="text-slate-400 text-xs font-medium">May 02, 2026</span>
          </div>
          <h1 className="text-5xl font-black tracking-tight mb-4 leading-tight">
            Welcome back to <br />
            <span className="text-blue-400">DataMind Intelligence.</span>
          </h1>
          <p className="text-slate-400 max-w-xl text-lg mb-8 font-medium">
            Your unified platform for advanced data extraction, deep SQL analysis, and professional reporting.
          </p>
          <div className="flex gap-4">
            <button 
              onClick={() => setActiveTab("sql")}
              className="px-6 py-3 bg-white text-slate-900 rounded-xl font-bold text-sm hover:bg-slate-100 transition-all flex items-center gap-2 active:scale-95"
            >
              Start New Analysis <ArrowUpRight className="w-4 h-4" />
            </button>
            <button className="px-6 py-3 bg-slate-800 text-slate-300 rounded-xl font-bold text-sm hover:bg-slate-700 transition-all active:scale-95 border border-slate-700">
              View Reports
            </button>
          </div>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-blue-600/10 to-transparent pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-blue-600/10 rounded-full blur-[100px] pointer-events-none" />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Quick Access & Tasks */}
        <div className="lg:col-span-8 space-y-8">
          {/* Modules Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {modules.map((m) => (
              <button
                key={m.id}
                onClick={() => setActiveTab(m.id as Tab)}
                className="group p-6 bg-white border border-slate-200 rounded-2xl text-left hover:shadow-xl hover:border-blue-100 transition-all active:scale-[0.98]"
              >
                <div className={cn("p-3 rounded-xl w-fit mb-4 group-hover:scale-110 transition-transform", m.bg)}>
                  <m.icon className={cn("w-6 h-6", m.color)} />
                </div>
                <h3 className="text-lg font-black text-slate-800 mb-1">{m.name}</h3>
                <p className="text-sm text-slate-500 mb-4">{m.desc}</p>
                <div className="flex items-center text-[10px] font-bold text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                  Launch Module <ChevronRight className="w-3 h-3 ml-1" />
                </div>
              </button>
            ))}
          </div>

          {/* Daily Tasks */}
          <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <ListChecks className="w-5 h-5 text-orange-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-800 tracking-tight">Analytical Roadmap</h2>
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Daily Progress</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dailyTasks.map(task => (
                <div 
                  key={task.id} 
                  className={cn(
                    "flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer",
                    task.completed ? "bg-slate-50 border-transparent opacity-60" : "bg-white border-slate-100 hover:border-orange-100 shadow-sm"
                  )}
                >
                  <div className={cn(
                    "w-6 h-6 rounded-lg flex items-center justify-center border-2",
                    task.completed ? "bg-green-500 border-green-500 text-white" : "border-slate-200"
                  )}>
                    {task.completed && <Sparkles className="w-3.5 h-3.5" />}
                  </div>
                  <span className={cn("text-sm font-medium", task.completed ? "line-through text-slate-400" : "text-slate-700")}>
                    {task.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: History & Saved Work */}
        <div className="lg:col-span-4 space-y-6">
          {/* Saved Work */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col h-fit">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Bookmark className="w-5 h-5 text-blue-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-800 tracking-tight">Saved Insights</h2>
            </div>
            
            <div className="space-y-3">
              {savedWork.length === 0 ? (
                <div className="text-center py-8 opacity-30">
                  <Star className="w-10 h-10 mx-auto mb-2" />
                  <p className="text-[10px] font-bold uppercase">No records saved yet</p>
                </div>
              ) : (
                savedWork.map(item => (
                  <div key={item.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl hover:border-blue-100 transition-colors cursor-pointer group">
                    <p className="text-[11px] font-bold text-slate-800 truncate mb-1">{item.name}</p>
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-bold text-blue-500 uppercase">{item.type}</span>
                      <span className="text-[9px] text-slate-400 font-medium">{new Date(item.timestamp).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Activity History */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col h-fit">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-slate-100 rounded-lg">
                <HistoryIcon className="w-5 h-5 text-slate-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-800 tracking-tight">Recent Sessions</h2>
            </div>
            
            <div className="space-y-4">
              {history.length === 0 ? (
                <p className="text-[10px] text-slate-400 italic text-center py-4">Session history is clear</p>
              ) : (
                history.map(item => (
                  <div key={item.id} className="flex gap-4 items-start relative pl-4 border-l-2 border-slate-100">
                    <div className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-blue-500" />
                    <div>
                      <p className="text-[10px] font-bold text-slate-800">{item.action}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[9px] text-slate-400">{new Date(item.timestamp).toLocaleTimeString()}</span>
                        <span className="text-[9px] font-bold text-slate-500 uppercase px-1.5 py-0.5 bg-slate-50 rounded italic">{item.tab}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

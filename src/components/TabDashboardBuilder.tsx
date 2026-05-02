import React, { useState, useRef } from "react";
import { LayoutDashboard, Settings2, Download, Share2, Plus, Trash2, Loader2, Sparkles, BarChart3, Check, Palette, FileJson, FileSpreadsheet, FileText, Database, RefreshCw, Layers, PieChart, Activity, TrendingUp, Filter, Wand2, X } from "lucide-react";
import { Dataset, DashboardConfig } from "../types";
import { GoogleGenAI } from "@google/genai";
import { toPng } from "html-to-image";
import axios from "axios";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import { 
  BarChart, Bar, LineChart, Line, PieChart as RePieChart, Pie, ScatterChart, Scatter, AreaChart, Area, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell 
} from "recharts";
import { cn } from "../lib/utils";
import { Upload } from "lucide-react";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

const COLORS = ["#1a73e8", "#34a853", "#fbbc05", "#ea4335", "#8ab4f8", "#ff6d00", "#46bdc6", "#7b1fa2", "#000000", "#9e9e9e"];

interface TabDashboardBuilderProps {
  datasets: Dataset[];
  selectedDatasetId: string;
  setSelectedDatasetId: (id: string) => void;
  onRefresh?: () => void;
  onDatasetAdded?: (dataset: Dataset) => void;
  analysisReport?: { insights: string; suggestions: any[] } | null;
}

export function TabDashboardBuilder({ datasets, selectedDatasetId, setSelectedDatasetId, onRefresh, onDatasetAdded, analysisReport }: TabDashboardBuilderProps) {
  const [loading, setLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<DashboardConfig | null>(null);
  const [editingChartId, setEditingChartId] = useState<string | null>(null);
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [activePalette, setActivePalette] = useState("#1a73e8");
  const [sidebarTab, setSidebarTab] = useState<"visuals" | "layout" | "ai">("visuals");
  const [aiMessage, setAiMessage] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [chartSuggestions, setChartSuggestions] = useState<Record<string, { text: string; loading: boolean; recommendedType?: "bar" | "line" | "pie" | "area" | "radar" | null }>>({});
  const [hiddenKeys, setHiddenKeys] = useState<Record<string, Set<string>>>({});
  const dashboardRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedDataset = datasets.find(d => d.id === selectedDatasetId);

  const getChartSuggestion = async (chart: any) => {
    if (!selectedDataset) return;
    
    setChartSuggestions(prev => ({ 
      ...prev, 
      [chart.id]: { text: "", loading: true } 
    }));

    try {
      const prompt = `You are a Data visualization expert.
      Dataset: ${selectedDataset.name}
      Current Visual: ${chart.title} (Type: ${chart.type}, X: ${chart.xKey}, Y: ${chart.yKey})
      Data Sample: ${JSON.stringify(selectedDataset.metadata.sample)}
      
      Analyze this visual and provide 3 improvement points. 
      Also, if another chart type would be markedly better, name it.
      
      Guidance:
      - Use "area" for showing cumulative trends or volume over time.
      - Use "radar" for multi-dimensional comparisons (e.g. comparing 5+ metrics across categories).
      - Use "bar" for categorical comparisons.
      - Use "line" for linear trends.
      - Use "pie" for simple part-to-whole (max 6 categories).
      
      Output ONLY a JSON object:
      {
        "points": string[],
        "recommendedType": "bar" | "line" | "pie" | "area" | "radar" | null
      }`;

      const result = await ai.models.generateContent({
        model: "gemini-flash-latest",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });

      const parsed = JSON.parse(result.text.replace(/```json|```/g, "").trim());
      
      setChartSuggestions(prev => ({ 
        ...prev, 
        [chart.id]: { 
          text: parsed.points.join("\n"), 
          loading: false,
          recommendedType: parsed.recommendedType
        } 
      }));
    } catch (err) {
      console.error(err);
      setChartSuggestions(prev => ({ 
        ...prev, 
        [chart.id]: { text: "Failed to get suggestions. Try again.", loading: false } 
      }));
    }
  };

  const handleAiEdit = async () => {
    if (!dashboard || !aiMessage) return;
    setAiLoading(true);
    try {
      const prompt = `You are a Dashboard Architect. 
      Current Dashboard Config: ${JSON.stringify(dashboard)}
      User Request: "${aiMessage}"
      
      Modify the "Current Dashboard Config" to satisfy the user request. 
      Output ONLY the updated JSON config. Do not explain anything. 
      Maintain the structure of kpis and charts.`;

      const result = await ai.models.generateContent({
        model: "gemini-flash-latest",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });

      const updated = JSON.parse(result.text.replace(/```json|```/g, "").trim());
      setDashboard(updated);
      setAiMessage("");
    } catch (err) {
      console.error(err);
      alert("AI Edit failed");
    } finally {
      setAiLoading(false);
    }
  };

  const moveChart = (id: string, direction: "up" | "down") => {
    if (!dashboard) return;
    const idx = dashboard.charts.findIndex(c => c.id === id);
    if (idx === -1) return;
    
    const newCharts = [...dashboard.charts];
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    
    if (targetIdx >= 0 && targetIdx < newCharts.length) {
      [newCharts[idx], newCharts[targetIdx]] = [newCharts[targetIdx], newCharts[idx]];
      setDashboard({ ...dashboard, charts: newCharts });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onDatasetAdded) return;

    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await axios.post("/api/upload-csv", formData);
      const newDataset: Dataset = {
        id: res.data.tableName,
        name: file.name,
        data: res.data.metadata.sample,
        metadata: res.data.metadata
      };
      onDatasetAdded(newDataset);
      if (onRefresh) onRefresh();
      setSelectedDatasetId(newDataset.id);
    } catch (err: any) {
      alert("Upload failed: " + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    setDashboard(null);
    setEditingChartId(null);
  }, [selectedDatasetId]);

  // NEW: Auto-generate dashboard if a new analysis report comes in
  React.useEffect(() => {
    if (analysisReport && !dashboard && !loading) {
       generateDashboard();
    }
  }, [analysisReport]);

  const generateDashboard = async () => {
    if (!selectedDataset) return;
    setLoading(true);
    try {
      const pipelineCtx = analysisReport 
        ? `Use these pre-analyzed insights: "${analysisReport.insights}".
           Suggested chart data ideas: ${JSON.stringify(analysisReport.suggestions)}`
        : "";

      const prompt = `You are DataMind Dashboard Designer. 
      Create a Power BI style dashboard config for this dataset: ${selectedDataset.name}. 
      ${pipelineCtx}
      
      Columns: ${selectedDataset.metadata.columns.join(", ")}. 
      Sample Data: ${JSON.stringify(selectedDataset.metadata.sample)}.
      
      Output ONLY a JSON object with:
      - "title": string
      - "summary": string (a 2-3 sentence high-level summary of the dashboard insights)
      - "kpis": array of {label, value, change, trend}
      - "charts": array of {id, type (bar|line|pie|area|radar), title, xKey, yKey, color}
      
      Ensure the charts are the best ones for the analyzed patterns.`;

      const result = await ai.models.generateContent({
        model: "gemini-flash-latest",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });

      const parsed = JSON.parse(result.text.replace(/```json|```/g, "").trim());
      setDashboard(parsed);
    } catch (err) {
      console.error(err);
      alert("Dashboard generation failed");
    } finally {
      setLoading(false);
    }
  };

  const exportAsPDF = async () => {
    if (!dashboardRef.current) return;
    setLoading(true);
    try {
      const element = dashboardRef.current;
      const dataUrl = await toPng(element, {
        backgroundColor: "#ffffff",
        pixelRatio: 2,
        cacheBust: true,
      });

      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgProps = pdf.getImageProperties(dataUrl);
      const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(dataUrl, 'PNG', 0, position, pdfWidth, imgHeight);
      heightLeft -= pdfHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(dataUrl, 'PNG', 0, position, pdfWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      pdf.save(`${dashboard?.title || "dashboard"}.pdf`);
    } catch (err) {
      console.error("PDF export failed:", err);
      alert("PDF export failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const exportAsPNG = async () => {
    if (!dashboardRef.current) return;
    try {
      const dataUrl = await toPng(dashboardRef.current, { 
        cacheBust: true, 
        backgroundColor: "#ffffff",
        quality: 1,
        pixelRatio: 2
      });
      const link = document.createElement('a');
      link.download = `${dashboard?.title || "dashboard"}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("PNG export failed:", err);
    }
  };

  const exportAsExcel = () => {
    if (!dashboard || !selectedDataset) return;
    const ws = XLSX.utils.json_to_sheet(selectedDataset.data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Raw Data");
    XLSX.writeFile(wb, `${dashboard.title || "Dashboard_Export"}.xlsx`);
  };

  const updateChartProperty = (chartId: string, property: string, value: any) => {
    if (!dashboard) return;
    setDashboard({
      ...dashboard,
      charts: dashboard.charts.map(c => c.id === chartId ? { ...c, [property]: value } : c)
    });
  };

  const addManualChart = () => {
    if (!dashboard || !selectedDataset) return;
    const newId = `chart_${Date.now()}`;
    const newChart = {
      id: newId,
      type: "bar" as const,
      title: "New Analysis",
      xKey: selectedDataset.metadata.columns[0],
      yKey: selectedDataset.metadata.columns[1] || selectedDataset.metadata.columns[0],
      color: activePalette
    };
    setDashboard({
      ...dashboard,
      charts: [...dashboard.charts, newChart]
    });
    setEditingChartId(newId);
  };

  const toggleLegend = (chartId: string, entry: any) => {
    const value = entry.dataKey || entry.value;
    setHiddenKeys(prev => {
      const next = { ...prev };
      const chartHidden = new Set(next[chartId] || []);
      if (chartHidden.has(value)) {
        chartHidden.delete(value);
      } else {
        chartHidden.add(value);
      }
      next[chartId] = chartHidden;
      return next;
    });
  };

  const renderChart = (chart: any) => {
    const data = selectedDataset?.data || [];
    const chartHidden = hiddenKeys[chart.id] || new Set();

    const renderLegendText = (value: string, entry: any) => {
      const isHidden = chartHidden.has(entry.dataKey || value);
      return (
        <span className={cn(
          "text-[10px] font-bold transition-all",
          isHidden ? "text-slate-300 line-through" : "text-slate-600"
        )}>
          {value}
        </span>
      );
    };

    if (chart.type === "pie") {
      const filteredData = data.filter(d => !chartHidden.has(d[chart.xKey]));
      return (
        <ResponsiveContainer width="100%" height="100%">
          <RePieChart>
            <Pie
              data={filteredData}
              dataKey={chart.yKey}
              nameKey={chart.xKey}
              cx="50%"
              cy="50%"
              outerRadius={80}
              fill={chart.color || "#1a73e8"}
            >
              {filteredData.map((slice, index) => {
                const originalIndex = data.findIndex(d => d[chart.xKey] === slice[chart.xKey]);
                return <Cell key={`cell-${index}`} fill={COLORS[originalIndex === -1 ? index % COLORS.length : originalIndex % COLORS.length]} />;
              })}
            </Pie>
            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
            <Legend 
              onClick={(e) => toggleLegend(chart.id, e)}
              formatter={renderLegendText}
              wrapperStyle={{ cursor: 'pointer', paddingTop: '10px' }}
            />
          </RePieChart>
        </ResponsiveContainer>
      );
    }

    if (chart.type === "bar") {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey={chart.xKey} tick={{fontSize: 10}} axisLine={false} tickLine={false} />
            <YAxis tick={{fontSize: 10}} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
            <Legend 
              onClick={(e) => toggleLegend(chart.id, e)}
              formatter={renderLegendText}
              wrapperStyle={{ cursor: 'pointer', paddingTop: '10px' }}
            />
            <Bar 
              dataKey={chart.yKey} 
              fill={chart.color || "#1a73e8"} 
              radius={[4, 4, 0, 0]} 
              hide={chartHidden.has(chart.yKey)}
            />
          </BarChart>
        </ResponsiveContainer>
      );
    }

    if (chart.type === "line") {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey={chart.xKey} tick={{fontSize: 10}} axisLine={false} tickLine={false} />
            <YAxis tick={{fontSize: 10}} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
            <Legend 
              onClick={(e) => toggleLegend(chart.id, e)}
              formatter={renderLegendText}
              wrapperStyle={{ cursor: 'pointer', paddingTop: '10px' }}
            />
            <Line 
              type="monotone" 
              dataKey={chart.yKey} 
              stroke={chart.color || "#1a73e8"} 
              strokeWidth={2} 
              dot={{ r: 4, fill: chart.color || "#1a73e8", strokeWidth: 2, stroke: '#fff' }}
              hide={chartHidden.has(chart.yKey)}
            />
          </LineChart>
        </ResponsiveContainer>
      );
    }

    if (chart.type === "area") {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey={chart.xKey} tick={{fontSize: 10}} axisLine={false} tickLine={false} />
            <YAxis tick={{fontSize: 10}} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
            <Legend 
              onClick={(e) => toggleLegend(chart.id, e)}
              formatter={renderLegendText}
              wrapperStyle={{ cursor: 'pointer', paddingTop: '10px' }}
            />
            <Area 
              type="monotone" 
              dataKey={chart.yKey} 
              stroke={chart.color || "#1a73e8"} 
              fill={chart.color || "#1a73e8"} 
              fillOpacity={0.15} 
              hide={chartHidden.has(chart.yKey)}
            />
          </AreaChart>
        </ResponsiveContainer>
      );
    }

    if (chart.type === "radar") {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
            <PolarGrid stroke="#e2e8f0" />
            <PolarAngleAxis dataKey={chart.xKey} tick={{ fontSize: 10, fontWeight: 600 }} />
            <PolarRadiusAxis fontSize={10} axisLine={false} tickLine={false} />
            <Radar 
              name={chart.title} 
              dataKey={chart.yKey} 
              stroke={chart.color || "#1a73e8"} 
              fill={chart.color || "#1a73e8"} 
              fillOpacity={0.6} 
              hide={chartHidden.has(chart.yKey)}
            />
            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
            <Legend 
              onClick={(e) => toggleLegend(chart.id, e)}
              formatter={renderLegendText}
              wrapperStyle={{ cursor: 'pointer', paddingTop: '10px' }}
            />
          </RadarChart>
        </ResponsiveContainer>
      );
    }

    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
           <XAxis dataKey={chart.xKey} tick={{fontSize: 10}} />
           <YAxis tick={{fontSize: 10}} />
           <Tooltip contentStyle={{ borderRadius: '12px', border: 'none' }} />
           <Legend 
             onClick={(e) => toggleLegend(chart.id, e)}
             formatter={renderLegendText}
             wrapperStyle={{ cursor: 'pointer', paddingTop: '10px' }}
           />
           <Bar dataKey={chart.yKey} fill={chart.color || "#1a73e8"} hide={chartHidden.has(chart.yKey)} />
        </BarChart>
      </ResponsiveContainer>
    );
  };

  return (
    <div className="h-full flex flex-col gap-6 overflow-hidden">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <LayoutDashboard className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Visual Studio Pro</h2>
            <p className="text-xs text-slate-500">Professional BI Dashboards & Visual Design</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {dashboard && (
            <>
              <div className="flex bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm mr-2">
                <button onClick={exportAsPDF} className="px-3 py-2 text-slate-600 hover:bg-slate-50 border-r border-slate-200 text-[10px] font-bold flex items-center gap-1.5" title="Export as PDF">
                  <FileText className="w-3 h-3 text-red-500" /> PDF
                </button>
                <button onClick={exportAsPNG} className="px-3 py-2 text-slate-600 hover:bg-slate-50 border-r border-slate-200 text-[10px] font-bold flex items-center gap-1.5" title="Export as PNG Image">
                  <Download className="w-3 h-3 text-blue-500" /> PNG
                </button>
                <button onClick={exportAsExcel} className="px-3 py-2 text-slate-600 hover:bg-slate-50 text-[10px] font-bold flex items-center gap-1.5" title="Export Raw Data to Excel">
                  <FileSpreadsheet className="w-3 h-3 text-green-500" /> Excel
                </button>
              </div>
              <button 
                onClick={() => setIsLiveConnected(!isLiveConnected)}
                className={cn(
                  "px-4 py-2 rounded-lg font-bold text-[10px] transition-all flex items-center gap-2",
                  isLiveConnected ? "bg-green-100 text-green-700 border border-green-200" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                )}
              >
                <Database className={cn("w-3 h-3", isLiveConnected && "animate-pulse")} />
                {isLiveConnected ? "Power BI Live Sync" : "Sync BI Connections"}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0 overflow-hidden">
        {/* Advanced BI Sidebar */}
        <div className="lg:col-span-3 space-y-4 overflow-y-auto pr-1 flex flex-col custom-scrollbar">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col min-h-0">
            {/* Sidebar Tabs */}
            <div className="flex border-b border-slate-100 bg-slate-50/50">
              <button 
                onClick={() => setSidebarTab("visuals")}
                className={cn("flex-1 py-3 text-[10px] font-bold uppercase tracking-wider transition-all border-b-2", sidebarTab === "visuals" ? "border-blue-600 text-blue-600 bg-white" : "border-transparent text-slate-400 hover:text-slate-600")}
              >
                Visuals
              </button>
              <button 
                onClick={() => setSidebarTab("layout")}
                className={cn("flex-1 py-3 text-[10px] font-bold uppercase tracking-wider transition-all border-b-2", sidebarTab === "layout" ? "border-blue-600 text-blue-600 bg-white" : "border-transparent text-slate-400 hover:text-slate-600")}
              >
                Layout
              </button>
              <button 
                onClick={() => setSidebarTab("ai")}
                className={cn("flex-1 py-3 text-[10px] font-bold uppercase tracking-wider transition-all border-b-2", sidebarTab === "ai" ? "border-blue-600 text-blue-600 bg-white" : "border-transparent text-slate-400 hover:text-slate-600")}
              >
                AI
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto custom-scrollbar">
              {sidebarTab === "visuals" && (
                <div className="space-y-6">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Connect Data</label>
                      <button onClick={() => fileInputRef.current?.click()} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded-lg transition-colors">
                        <Upload className="w-3.5 h-3.5" />
                      </button>
                      <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".csv,.xlsx,.xls,.json,.docx,.txt" />
                    </div>
                    <div className="space-y-2">
                       {datasets.map(d => (
                         <button
                           key={d.id}
                           onClick={() => setSelectedDatasetId(d.id)}
                           className={cn(
                             "w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-all border",
                             selectedDatasetId === d.id ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-slate-50 border-transparent hover:border-slate-200 shadow-sm text-slate-600"
                           )}
                         >
                           <Database className="w-3.5 h-3.5 opacity-50" />
                           <p className="text-[11px] font-bold truncate flex-1">{d.name}</p>
                           {selectedDatasetId === d.id && <Check className="w-3 h-3" />}
                         </button>
                       ))}
                    </div>
                  </div>

                  {dashboard && (
                    <div className="space-y-4 pt-4 border-t border-slate-50">
                       <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 block">Color Schemes</label>
                       <div className="grid grid-cols-5 gap-2">
                         {COLORS.map(c => (
                           <button key={c} onClick={() => setActivePalette(c)} className={cn("w-6 h-6 rounded-full border-2", activePalette === c ? "border-slate-800 scale-110 shadow-md" : "border-transparent")} style={{ backgroundColor: c }} />
                         ))}
                       </div>
                       <button onClick={addManualChart} className="w-full py-2 bg-slate-900 text-white rounded-lg text-[10px] font-bold flex items-center justify-center gap-2 mt-4">
                         <Plus className="w-3 h-3" /> Create Custom Visual
                       </button>
                    </div>
                  )}
                </div>
              )}

              {sidebarTab === "layout" && (
                <div className="space-y-6">
                  {dashboard ? (
                    <>
                      <div className="space-y-3">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Global Headline</label>
                        <input 
                          type="text"
                          value={dashboard.title || ""}
                          onChange={(e) => setDashboard({...dashboard, title: e.target.value})}
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="Dashboard Title"
                        />
                      </div>

                      <div className="space-y-3 pt-4 border-t border-slate-50">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center justify-between">
                          KPI Metrics
                          <button 
                            onClick={() => setDashboard({...dashboard, kpis: [...dashboard.kpis, { label: "New KPI", value: "0", change: "0%", trend: "up" }] })}
                            className="p-1 hover:bg-white rounded text-blue-600"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </label>
                        <div className="space-y-2">
                          {dashboard.kpis.map((kpi, i) => (
                            <div key={i} className="space-y-2 p-2 bg-slate-50 border border-slate-100 rounded-lg">
                              <div className="flex gap-2">
                                <input 
                                  value={kpi.label} 
                                  onChange={(e) => {
                                    const newKpis = [...dashboard.kpis];
                                    newKpis[i].label = e.target.value;
                                    setDashboard({...dashboard, kpis: newKpis});
                                  }}
                                  className="w-full p-1.5 bg-white border border-slate-200 rounded text-[10px] font-bold"
                                />
                                <button 
                                  onClick={() => setDashboard({...dashboard, kpis: dashboard.kpis.filter((_, idx) => idx !== i) })}
                                  className="p-1.5 text-slate-400 hover:text-red-500"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                              <input 
                                value={kpi.value} 
                                onChange={(e) => {
                                  const newKpis = [...dashboard.kpis];
                                  newKpis[i].value = e.target.value;
                                  setDashboard({...dashboard, kpis: newKpis});
                                }}
                                className="w-full p-1.5 bg-white border border-slate-200 rounded text-[10px]"
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3 pt-4 border-t border-slate-50">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Section Order</label>
                        <div className="space-y-2">
                          {dashboard.charts.map((c, i) => (
                            <div key={c.id} className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-100 rounded-lg">
                              <span className="text-[10px] font-bold text-slate-400 w-4">#{i+1}</span>
                              <p className="flex-1 text-[11px] font-medium truncate text-slate-700">{c.title}</p>
                              <div className="flex gap-1">
                                <button onClick={() => moveChart(c.id, "up")} className="p-1 hover:bg-white rounded transition-colors" disabled={i === 0}>
                                  <TrendingUp className="w-3 h-3 text-slate-400" />
                                </button>
                                <button onClick={() => moveChart(c.id, "down")} className="p-1 hover:bg-white rounded transition-colors" disabled={i === dashboard.charts.length - 1}>
                                  <TrendingUp className="w-3 h-3 text-slate-400 rotate-180" />
                                </button>
                                <button 
                                  onClick={() => setDashboard({...dashboard, charts: dashboard.charts.filter(ch => ch.id !== c.id) })}
                                  className="p-1 hover:bg-white rounded text-red-400 transition-colors"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-12 opacity-40">
                      <Layers className="w-8 h-8 mx-auto mb-2" />
                      <p className="text-[10px] font-bold">Generate a dashboard first</p>
                    </div>
                  )}
                </div>
              )}

              {sidebarTab === "ai" && (
                <div className="space-y-4 h-full flex flex-col">
                  {dashboard ? (
                    <>
                      <div className="flex-1 bg-blue-50/30 rounded-xl p-4 border border-blue-100/50 mb-4 h-60 overflow-y-auto custom-scrollbar">
                        <div className="space-y-3">
                          <div className="bg-white p-3 rounded-lg border border-blue-50 shadow-sm text-[11px] text-slate-600 leading-relaxed">
                             I am your **Dashboard AI**. You can ask me to change anything:
                             <ul className="list-disc ml-4 mt-2 space-y-1">
                               <li>"Change all chart titles to uppercase"</li>
                               <li>"Swap chart 1 and 2"</li>
                               <li>"Add a summary KPI for profit"</li>
                               <li>"Make the theme dark blue"</li>
                             </ul>
                          </div>
                        </div>
                      </div>
                      <div className="relative">
                        <textarea 
                          value={aiMessage}
                          onChange={(e) => setAiMessage(e.target.value)}
                          placeholder="Type an AI instruction..."
                          className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs resize-none h-24 focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                        <button 
                          onClick={handleAiEdit}
                          disabled={aiLoading || !aiMessage}
                          className="absolute bottom-3 right-3 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all disabled:opacity-50"
                        >
                          {aiLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-12 opacity-40">
                      <Sparkles className="w-8 h-8 mx-auto mb-2" />
                      <p className="text-[10px] font-bold">Design a dashboard to use AI</p>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {!dashboard && (
              <div className="p-4 border-t border-slate-100">
                <button
                  onClick={generateDashboard}
                  disabled={loading || !selectedDatasetId}
                  className="w-full py-4 bg-[#1a73e8] text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 disabled:bg-slate-200 flex items-center justify-center gap-3 active:scale-[0.98]"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Sparkles className="w-4 h-4" />}
                  Finalize Intelligence
                </button>
              </div>
            )}
          </div>

          {editingChartId && dashboard && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm animate-in slide-in-from-bottom-4 duration-300">
              <div className="flex items-center justify-between mb-4 border-b border-slate-50 pb-2">
                <span className="text-[10px] font-bold uppercase text-slate-400 italic">Visual Properties</span>
                <button 
                  onClick={() => {
                    setDashboard({ ...dashboard, charts: dashboard.charts.filter(c => c.id !== editingChartId) });
                    setEditingChartId(null);
                  }}
                  className="text-slate-400 hover:text-red-500 p-1 rounded hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="space-y-3">
                <div className="space-y-1">
                   <p className="text-[9px] font-bold text-slate-400 uppercase">Title</p>
                   <input 
                    type="text" 
                    value={dashboard.charts.find(c => c.id === editingChartId)?.title || ""}
                    onChange={(e) => updateChartProperty(editingChartId, "title", e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                    placeholder="Visual Title"
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] font-bold text-slate-400 uppercase">Visual Type</p>
                  <select 
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-xs capitalize"
                    value={dashboard.charts.find(c => c.id === editingChartId)?.type || "bar"}
                    onChange={(e) => updateChartProperty(editingChartId, "type", e.target.value)}
                  >
                    <option value="bar">Bar Analysis</option>
                    <option value="line">Trend Line</option>
                    <option value="pie">Distribution</option>
                    <option value="area">Area Coverage</option>
                    <option value="radar">Radar Analysis</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Axis (X)</p>
                    <select 
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-[10px]"
                      value={dashboard.charts.find(c => c.id === editingChartId)?.xKey || ""}
                      onChange={(e) => updateChartProperty(editingChartId, "xKey", e.target.value)}
                    >
                      {selectedDataset?.metadata.columns.map(col => <option key={col} value={col}>{col}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Values (Y)</p>
                    <select 
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-[10px]"
                      value={dashboard.charts.find(c => c.id === editingChartId)?.yKey || ""}
                      onChange={(e) => updateChartProperty(editingChartId, "yKey", e.target.value)}
                    >
                      {selectedDataset?.metadata.columns.map(col => <option key={col} value={col}>{col}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Studio View */}
        <div className="lg:col-span-9 flex flex-col min-h-0">
          {dashboard ? (
            <div ref={dashboardRef} className="flex-1 space-y-6 overflow-auto pr-2 pb-6 bg-white p-8 rounded-2xl border border-slate-200 shadow-inner">
               <div className="flex items-center justify-between mb-4 border-b border-slate-50 pb-6">
                  <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">{dashboard.title || "Target Analytics View"}</h1>
                    <p className="text-xs text-slate-500 font-medium">{selectedDataset?.name} • Last sync: {new Date().toLocaleTimeString()}</p>
                  </div>
                  <div className="flex gap-2">
                    <div className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-[10px] font-bold flex items-center gap-2 self-center">
                       <Activity className="w-3 h-3" /> System Health Optimal
                    </div>
                  </div>
               </div>

               {/* KPIs */}
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {dashboard.kpis.map((kpi, i) => (
                  <div key={i} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all group">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 group-hover:text-blue-600 transition-colors">{kpi.label}</p>
                    <div className="flex items-end justify-between">
                      <h3 className="text-2xl font-black text-slate-900 tracking-tight">{kpi.value}</h3>
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1",
                        kpi.trend === "up" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                      )}>
                        {kpi.trend === "up" ? <TrendingUp className="w-3 h-3" /> : <TrendingUp className="w-3 h-3 rotate-180" />}
                        {kpi.change}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Charts Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {dashboard.charts.map((chart) => (
                  <div 
                    key={chart.id} 
                    onClick={() => setEditingChartId(chart.id)}
                    className={cn(
                      "group bg-white border rounded-2xl p-6 flex flex-col min-h-[380px] transition-all relative overflow-hidden cursor-pointer",
                      editingChartId === chart.id ? "border-blue-500 ring-4 ring-blue-50 shadow-xl" : "border-slate-100 hover:border-slate-200 hover:shadow-md"
                    )}
                  >
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-2">
                         <div className="w-2.5 h-6 rounded-full" style={{ backgroundColor: chart.color || activePalette }} />
                         <h4 className="text-sm font-black text-slate-800 tracking-tight">{chart.title}</h4>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            moveChart(chart.id, "up");
                          }}
                          className="p-1.5 text-slate-400 hover:text-blue-600 bg-slate-50 rounded-lg transition-colors"
                          title="Move Up"
                        >
                          <TrendingUp className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            moveChart(chart.id, "up"); // For a 2-col grid, same as "left" in most cases or just standard move
                          }}
                          className="p-1.5 text-slate-400 hover:text-blue-600 bg-slate-50 rounded-lg transition-colors -rotate-90"
                          title="Move Left"
                        >
                          <TrendingUp className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            moveChart(chart.id, "down");
                          }}
                          className="p-1.5 text-slate-400 hover:text-blue-600 bg-slate-50 rounded-lg transition-colors rotate-90"
                          title="Move Right"
                        >
                          <TrendingUp className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            moveChart(chart.id, "down");
                          }}
                          className="p-1.5 text-slate-400 hover:text-blue-600 bg-slate-50 rounded-lg transition-colors"
                          title="Move Down"
                        >
                          <TrendingUp className="w-3.5 h-3.5 rotate-180" />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            getChartSuggestion(chart);
                          }}
                          className="p-1.5 text-slate-400 hover:text-blue-600 bg-slate-50 rounded-lg transition-colors"
                          title="Suggest Improvements"
                        >
                          <Wand2 className={cn("w-3.5 h-3.5", chartSuggestions[chart.id]?.loading && "animate-spin text-blue-500")} />
                        </button>
                        <button className="p-1.5 text-slate-400 hover:text-blue-600 bg-slate-50 rounded-lg">
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex-1 w-full h-full min-h-0 bg-slate-50/30 rounded-xl p-4 border border-slate-50 shadow-inner relative">
                      {renderChart(chart)}
                      
                      {/* AI Suggestions Overlay */}
                      {chartSuggestions[chart.id] && (
                        <div 
                          className="absolute inset-0 bg-white/95 backdrop-blur-sm p-6 z-10 animate-in fade-in zoom-in duration-200 flex flex-col"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                              <Sparkles className="w-4 h-4 text-blue-600" />
                              <span className="text-xs font-black uppercase text-slate-900 tracking-tighter">AI Optimization Tips</span>
                            </div>
                            <button 
                              onClick={() => {
                                const newSuggestions = { ...chartSuggestions };
                                delete newSuggestions[chart.id];
                                setChartSuggestions(newSuggestions);
                              }}
                              className="p-1 hover:bg-slate-100 rounded-full transition-colors"
                            >
                              <X className="w-4 h-4 text-slate-400" />
                            </button>
                          </div>
                          
                          <div className="flex-1 overflow-y-auto">
                            {chartSuggestions[chart.id].loading ? (
                              <div className="h-full flex items-center justify-center">
                                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                              </div>
                            ) : (
                              <div className="space-y-4">
                                <div className="text-[11px] prose prose-slate max-w-none text-slate-600 font-medium leading-relaxed">
                                  {chartSuggestions[chart.id].text.split('\n').map((line, i) => (
                                    <p key={i} className="mb-2 last:mb-0 flex items-start gap-2">
                                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                                      {line.replace(/^[-*]\s*/, '')}
                                    </p>
                                  ))}
                                </div>
                                {chartSuggestions[chart.id].recommendedType && chartSuggestions[chart.id].recommendedType !== chart.type && (
                                  <button 
                                    onClick={() => {
                                      updateChartProperty(chart.id, "type", chartSuggestions[chart.id].recommendedType);
                                      const newSuggestions = { ...chartSuggestions };
                                      delete newSuggestions[chart.id];
                                      setChartSuggestions(newSuggestions);
                                    }}
                                    className="w-full py-2 bg-blue-600 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95"
                                  >
                                    <RefreshCw className="w-3 h-3" /> Switch to {chartSuggestions[chart.id].recommendedType}
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                          
                          {!chartSuggestions[chart.id].loading && (
                            <div className="mt-4 pt-4 border-t border-slate-50">
                              <p className="text-[9px] text-slate-400 font-bold uppercase text-center">Suggestions based on dynamic data profile</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Dashboard Summary */}
              {dashboard.summary && (
                <div className="mt-8 p-8 bg-slate-50 rounded-3xl border border-slate-100 shadow-inner">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-blue-100 rounded-xl">
                      <Sparkles className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-800 tracking-tighter uppercase">Executive Intelligence Summary</h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">AI Generated Dataset Narrative</p>
                    </div>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <p className="text-sm text-slate-600 leading-relaxed font-medium italic">
                      "{dashboard.summary}"
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200 p-12">
               <div className="p-8 bg-white rounded-full shadow-2xl mb-6 relative hover:scale-105 transition-transform">
                  <LayoutDashboard className="w-16 h-16 text-slate-200" />
                  <div className="absolute top-2 right-2 p-2 bg-[#1a73e8] rounded-full shadow-lg shadow-blue-500/30">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
               </div>
               <h3 className="text-2xl font-black text-slate-800 mb-2">Visual Intelligence Studio</h3>
               <p className="text-sm max-w-sm text-center opacity-70 leading-relaxed mb-8 font-medium">
                Engineered for scale. Select your dataset components and let our neural designer build mission-critical dashboards instantly.
               </p>
               <div className="flex flex-wrap justify-center gap-4">
                  <div className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-full text-[11px] font-bold shadow-sm hover:shadow-md transition-shadow">
                    <Activity className="w-3.5 h-3.5 text-blue-500" /> Live Data Sync
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-full text-[11px] font-bold shadow-sm hover:shadow-md transition-shadow">
                    <Layers className="w-3.5 h-3.5 text-orange-500" /> 1-Click Export
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-full text-[11px] font-bold shadow-sm hover:shadow-md transition-shadow">
                    <Filter className="w-3.5 h-3.5 text-green-500" /> SQL Connectivity
                  </div>
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

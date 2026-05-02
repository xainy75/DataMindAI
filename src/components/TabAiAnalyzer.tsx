import React, { useState, useRef } from "react";
import { BrainCircuit, MessageSquare, Send, BarChart3, TrendingUp, Compass, AlertTriangle, FileText, Loader2, Zap, Shield, RefreshCw, Plus, Upload, Copy, Download, ChevronRight, Check, PieChart, LineChart, Sigma, Calculator, Layers, Activity, Search, Target } from "lucide-react";
import { Dataset, Tab } from "../types";
import ReactMarkdown from "react-markdown";
import { GoogleGenAI } from "@google/genai";
import axios from "axios";
import { cn } from "../lib/utils";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart as ReLineChart, Line, PieChart as RePieChart, Pie, Cell, AreaChart, Area, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from "recharts";

const COLORS = ["#1a73e8", "#34a853", "#fbbc05", "#ea4335", "#8ab4f8", "#ff6d00", "#46bdc6", "#7b1fa2"];

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

interface TabAiAnalyzerProps {
  datasets: Dataset[];
  selectedDatasetId: string;
  setSelectedDatasetId: (id: string) => void;
  onRefresh?: () => void;
  onTransferSql?: (sql: string) => void;
  setActiveTab?: (tab: Tab) => void;
  onDatasetAdded?: (dataset: Dataset) => void;
  onAnalysisComplete?: (report: { insights: string; suggestions: any[] }) => void;
}

export function TabAiAnalyzer({ datasets, selectedDatasetId, setSelectedDatasetId, onRefresh, onTransferSql, setActiveTab, onDatasetAdded, onAnalysisComplete }: TabAiAnalyzerProps) {
  const [selectedAnalysisTypes, setSelectedAnalysisTypes] = useState<string[]>(["Summary Stats"]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [report, setReport] = useState<{ 
    analysis: string; 
    insights: string[]; 
    nextSteps: string[];
    stats?: Record<string, string | number>;
    charts?: { 
      type: "bar" | "line" | "pie" | "area" | "radar"; 
      title: string; 
      data: any[]; 
      xAxis?: string; 
      yAxis?: string; 
    }[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [chatMessage, setChatMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<{ role: "user" | "model"; text: string }[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  React.useEffect(() => {
    setReport(null);
    setChatHistory([]);
  }, [selectedDatasetId]);

  // Handle pipeline auto-selection
  React.useEffect(() => {
    if (datasets.some(d => d.id === "latest_sql_result") && !selectedDatasetId) {
      setSelectedDatasetId("latest_sql_result");
    }
  }, [datasets, selectedDatasetId, setSelectedDatasetId]);

  const toggleAnalysisType = (id: string) => {
    setSelectedAnalysisTypes(prev => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev; // Keep at least one
        return prev.filter(t => t !== id);
      }
      return [...prev, id];
    });
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

  const triggerUpload = () => {
    fileInputRef.current?.click();
  };

  const extractSql = (text: string) => {
    const match = text.match(/```sql\n([\s\S]*?)```/);
    return match ? match[1].trim() : null;
  };

  const sqlToTransfer = report ? extractSql(report.analysis) : null;

  const handleRefresh = async () => {
    if (onRefresh) {
      setRefreshing(true);
      await onRefresh();
      setRefreshing(false);
    }
  };

  const copyToClipboard = () => {
    if (!report) return;
    const text = `# ${selectedDataset?.name} - AI Analysis\n\n${report.analysis}\n\n### Insights\n${report.insights.join("\n")}\n\n### Next Steps\n${report.nextSteps.join("\n")}`;
    navigator.clipboard.writeText(text);
    alert("Report copied to clipboard in Markdown format.");
  };

  const downloadReport = () => {
    if (!report) return;
    const text = `# ${selectedDataset?.name} - AI Analysis\n\n${report.analysis}\n\n### Insights\n${report.insights.join("\n")}\n\n### Next Steps\n${report.nextSteps.join("\n")}`;
    const blob = new Blob([text], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `analysis_${selectedDataset?.name || "data"}.md`;
    link.click();
  };

  const selectedDataset = datasets.find(d => d.id === selectedDatasetId);

  const runAnalysis = async (isExpansion = false) => {
    if (!selectedDataset) return;
    setLoading(true);
    try {
      const typesList = selectedAnalysisTypes.join(", ");
      const basePrompt = isExpansion 
        ? `I have already generated a report with these statistical goals: ${typesList}. Now, I need you to EXPAND and provide even deeper mathematical details, Minitab-grade quality metrics, and advanced logical deductions. Don't repeat the previous summary, dive straight into extreme technical detail.` 
        : `Include these advanced analysis types in your report: ${typesList}.`;

      const prompt = `You are DataMind AI, a world-class Data Scientist.
      You are part of a connected pipeline. Use the current SQL results to find correlations and outliers.
      
      Table: ${selectedDataset.name}
      Schema: ${selectedDataset.metadata.columns.join(", ")}
      Row Count: ${selectedDataset.metadata.rowCount}
      Sample Data: ${JSON.stringify(selectedDataset.metadata.sample)}
      
      CORE TASK: ${basePrompt}
      
      FORMAT REQUIREMENTS:
      Your response MUST be a valid JSON object with these keys: 
      "analysis" (markdown text), 
      "insights" (array of 2 business insight strings), 
      "nextSteps" (array of 2 next step strings),
      "stats" (key-value object),
      "charts" (array of 2 chart objects: { type, title, data, xAxis, yAxis }).
      
      Identify the most meaningful chart types (bar, line, pie, area, radar) for this data.`;

      const result = await ai.models.generateContent({
        model: "gemini-flash-latest",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: { responseMimeType: "application/json" }
      });

      const parsed = JSON.parse(result.text || "{}");
      if (isExpansion && report) {
        const updatedReport = {
          analysis: report.analysis + "\n\n---\n\n### Expanded Analysis\n\n" + parsed.analysis,
          insights: [...new Set([...report.insights, ...parsed.insights])],
          nextSteps: [...new Set([...report.nextSteps, ...parsed.nextSteps])],
          charts: [...(report.charts || []), ...(parsed.charts || [])].slice(0, 4)
        };
        setReport(updatedReport);
        if (onAnalysisComplete) {
          onAnalysisComplete({
            insights: parsed.analysis,
            suggestions: parsed.charts || []
          });
        }
      } else {
        setReport(parsed);
        if (onAnalysisComplete) {
          onAnalysisComplete({
            insights: parsed.analysis,
            suggestions: parsed.charts || []
          });
        }
      }
    } catch (err: any) {
      console.error(err);
      alert("Analysis failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!chatMessage || !selectedDataset) return;
    const userMsg = chatMessage;
    setChatMessage("");
    setChatHistory(prev => [...prev, { role: "user", text: userMsg }]);
    setChatLoading(true);

    try {
      const context = `You are DataMind AI. You are helping a user with their dataset "${selectedDataset.name}".
      Be concise. One clear summary line first, then details.
      Schema: ${selectedDataset.metadata.columns.join(", ")}
      Row Count: ${selectedDataset.metadata.rowCount}
      Sample: ${JSON.stringify(selectedDataset.metadata.sample)}`;

      const result = await ai.models.generateContent({
        model: "gemini-flash-latest",
        contents: [
          { role: "user", parts: [{ text: context }] },
          ...chatHistory.map(h => ({ role: h.role, parts: [{ text: h.text }] })),
          { role: "user", parts: [{ text: userMsg }] }
        ],
      });

      setChatHistory(prev => [...prev, { role: "model", text: result.text || "I'm sorry, I couldn't process that." }]);
    } catch (err: any) {
      console.error(err);
      setChatHistory(prev => [...prev, { role: "model", text: `Error: ${err.message}` }]);
    } finally {
      setChatLoading(false);
    }
  };

  const analysisTypes = [
    { id: "Descriptive Stats", icon: BarChart3, description: "Mean, Median, Std Dev, Variance" },
    { id: "Hypothesis Testing", icon: Sigma, description: "T-Tests, ANOVA, P-Values" },
    { id: "Regression Analysis", icon: Activity, description: "Predictive Modeling (Y=mx+b)" },
    { id: "Quality Control", icon: Target, description: "Control Charts (X-Bar) & Cpk" },
    { id: "Pivot & Summaries", icon: Layers, description: "Excel-Style Dynamic Grouping" },
    { id: "What-If Impact", icon: Calculator, description: "Sensitivity & Forecast Modeling" },
    { id: "Visual Analytics", icon: PieChart, description: "Pareto, BoxPlots, Clusters" },
    { id: "Forecasting", icon: TrendingUp, description: "Time-Series Trend Prediction" },
    { id: "Data Cleaning", icon: Shield, description: "VLOOKUP/Join Logic & Formatting" },
    { id: "Market Sentiment", icon: Search, description: "Tone & Theme Analysis" },
    { id: "Full Report", icon: FileText, description: "Deep Investigation & Summary" }
  ];

  return (
    <div className="flex flex-col h-full space-y-6">
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        className="hidden" 
        accept=".csv,.xlsx,.xls,.json,.txt,.docx"
      />
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">AI Data Analyzer</h2>
          <p className="text-slate-500 text-sm">Get deep insights and automated reports powered by Gemini AI.</p>
        </div>
        <button 
          onClick={triggerUpload}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-all text-xs font-bold shadow-sm"
        >
          <Upload className="w-3.5 h-3.5 text-blue-600" />
          Upload Data
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-400 uppercase">1. Select dataset</label>
              <button 
                onClick={handleRefresh}
                className={cn("p-1 hover:bg-slate-100 rounded transition-colors", refreshing && "animate-spin")}
                title="Refresh datasets"
              >
                <RefreshCw className="w-3 h-3 text-slate-400" />
              </button>
            </div>
            
            <div className="space-y-2 mb-4 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
              {datasets.length === 0 ? (
                <div className="py-6 px-2 text-center border-2 border-dashed border-slate-100 rounded-lg">
                  <p className="text-[10px] text-slate-400 italic mb-3">No datasets found.</p>
                  <button 
                    onClick={triggerUpload}
                    className="w-full py-2 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-lg hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus className="w-3 h-3" /> Upload File
                  </button>
                </div>
              ) : (
                <>
                  {datasets.map(d => (
                    <button
                      key={d.id}
                      onClick={() => setSelectedDatasetId(d.id)}
                      className={cn(
                        "w-full flex flex-col p-2 rounded-lg text-left transition-all border",
                        selectedDatasetId === d.id 
                          ? "bg-blue-50 border-blue-200 ring-1 ring-blue-100" 
                          : "bg-slate-50 border-slate-100 hover:bg-slate-100"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-0.5">
                        <TrendingUp className={cn("w-3 h-3", selectedDatasetId === d.id ? "text-blue-600" : "text-slate-400")} />
                        <span className={cn("text-xs font-bold truncate", selectedDatasetId === d.id ? "text-blue-700" : "text-slate-600")}>
                          {d.name}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[9px] text-slate-400">
                        <span>{d.metadata.rowCount >= 0 ? d.metadata.rowCount.toLocaleString() : "External"} rows</span>
                        <span>{d.metadata.columns.length} cols</span>
                      </div>
                    </button>
                  ))}
                  <button 
                    onClick={triggerUpload}
                    className="w-full py-2 mt-2 bg-white border border-dashed border-slate-200 text-slate-500 text-[9px] font-bold rounded-lg hover:bg-slate-50 transition-colors flex items-center justify-center gap-1"
                  >
                    <Plus className="w-2.5 h-2.5" /> Upload More
                  </button>
                </>
              )}
            </div>

            <label className="text-xs font-bold text-slate-400 uppercase mb-3 block">2. Analysis Types</label>
            <div className="space-y-1">
              {analysisTypes.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => toggleAnalysisType(t.id)}
                    className={cn(
                      "w-full flex items-center justify-between p-2 rounded-lg text-sm transition-colors group",
                      selectedAnalysisTypes.includes(t.id) ? "bg-blue-50 text-blue-700 font-bold" : "text-slate-600 hover:bg-slate-50"
                    )}
                    title={t.description}
                  >
                    <div className="flex items-center gap-2">
                      <t.icon className={cn("w-4 h-4", selectedAnalysisTypes.includes(t.id) ? "text-blue-600" : "text-slate-400")} />
                      <div className="flex flex-col">
                        <span>{t.id}</span>
                      </div>
                    </div>
                    {selectedAnalysisTypes.includes(t.id) && <Check className="w-3.5 h-3.5 text-blue-600" />}
                  </button>
              ))}
            </div>

            <button
              onClick={() => runAnalysis(false)}
              disabled={loading || !selectedDatasetId}
              className="w-full mt-6 py-3 bg-[#1a73e8] text-white rounded-lg font-bold text-sm hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/20 disabled:bg-slate-200 disabled:shadow-none flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BrainCircuit className="w-4 h-4" />}
              {loading ? "Analyzing..." : `Analyze (${selectedAnalysisTypes.length})`}
            </button>
          </div>
        </div>

        <div className="lg:col-span-3 space-y-6 flex flex-col min-h-0">
          {report ? (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col flex-1 overflow-hidden">
              <div className="bg-slate-50 px-6 py-3 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                   <FileText className="w-3.5 h-3.5 text-slate-400" />
                   <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">AI Investigation Report</span>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={copyToClipboard}
                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded transition-all"
                    title="Copy Report"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={downloadReport}
                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded transition-all"
                    title="Download Report"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={() => runAnalysis(true)}
                    disabled={loading}
                    className="flex items-center gap-1 px-3 py-1 bg-white border border-slate-200 text-slate-600 text-[10px] font-bold rounded hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                    Expand Report
                  </button>
                  {sqlToTransfer && onTransferSql && (
                    <button 
                      onClick={() => onTransferSql(sqlToTransfer)}
                      className="flex items-center gap-1.5 px-3 py-1 bg-slate-900 text-white text-[10px] font-bold rounded hover:bg-slate-800 transition-colors shadow-sm"
                    >
                      <Zap className="w-3 h-3" /> SQL Runner
                    </button>
                  )}
                  {setActiveTab && (
                    <button 
                      onClick={() => setActiveTab("dashboard")}
                      className="flex items-center gap-1.5 px-3 py-1 bg-blue-600 text-white text-[10px] font-bold rounded hover:bg-blue-700 transition-colors shadow-sm"
                    >
                      Generate Dashboard →
                    </button>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-auto p-6 space-y-8">
                {report.charts && report.charts.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {report.charts.map((chart, i) => (
                      <div key={i} className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex flex-col h-[300px]">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-4 flex items-center gap-2">
                          {chart.type === "bar" && <BarChart3 className="w-3 h-3" />}
                          {chart.type === "line" && <TrendingUp className="w-3 h-3" />}
                          {chart.type === "pie" && <PieChart className="w-3 h-3" />}
                          {chart.type === "area" && <Layers className="w-3 h-3" />}
                          {chart.type === "radar" && <Activity className="w-3 h-3" />}
                          {chart.title}
                        </h4>
                        <div className="flex-1 min-h-0">
                          <ResponsiveContainer width="100%" height="100%">
                            {chart.type === "bar" ? (
                              <BarChart data={chart.data}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey={chart.xAxis} fontSize={10} tickLine={false} axisLine={false} />
                                <YAxis fontSize={10} tickLine={false} axisLine={false} />
                                <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                <Bar dataKey={chart.yAxis} fill="#1a73e8" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            ) : chart.type === "line" ? (
                              <ReLineChart data={chart.data}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey={chart.xAxis} fontSize={10} tickLine={false} axisLine={false} />
                                <YAxis fontSize={10} tickLine={false} axisLine={false} />
                                <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                <Line type="monotone" dataKey={chart.yAxis} stroke="#1a73e8" strokeWidth={2} dot={{ r: 4 }} />
                              </ReLineChart>
                            ) : chart.type === "area" ? (
                              <AreaChart data={chart.data}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey={chart.xAxis} fontSize={10} tickLine={false} axisLine={false} />
                                <YAxis fontSize={10} tickLine={false} axisLine={false} />
                                <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                <Area type="monotone" dataKey={chart.yAxis} stroke="#1a73e8" fill="#1a73e8" fillOpacity={0.1} />
                              </AreaChart>
                            ) : chart.type === "radar" ? (
                              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chart.data}>
                                <PolarGrid stroke="#e2e8f0" />
                                <PolarAngleAxis dataKey={chart.xAxis} tick={{ fontSize: 10 }} />
                                <PolarRadiusAxis fontSize={10} />
                                <Radar name={chart.title} dataKey={chart.yAxis} stroke="#1a73e8" fill="#1a73e8" fillOpacity={0.6} />
                                <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                              </RadarChart>
                            ) : (
                              <RePieChart>
                                <Pie
                                  data={chart.data}
                                  dataKey={chart.yAxis}
                                  nameKey={chart.xAxis}
                                  cx="50%"
                                  cy="50%"
                                  outerRadius={80}
                                  label={{ fontSize: 10 }}
                                >
                                  {chart.data.map((_, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                  ))}
                                </Pie>
                                <Tooltip />
                                <Legend wrapperStyle={{ fontSize: '10px' }} />
                              </RePieChart>
                            )}
                          </ResponsiveContainer>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {report.stats && (
                   <div className="bg-slate-900 rounded-xl p-6 text-white shadow-xl">
                      <div className="flex items-center gap-2 mb-4 border-b border-white/10 pb-2">
                        <Sigma className="w-4 h-4 text-blue-400" />
                        <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400">Statistical Parameters (Minitab Engine)</h4>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                        {Object.entries(report.stats).map(([key, val]) => (
                          <div key={key} className="flex flex-col">
                            <span className="text-[10px] text-slate-400 uppercase font-medium">{key}</span>
                            <span className="text-lg font-bold text-white tabular-nums">{val}</span>
                          </div>
                        ))}
                      </div>
                   </div>
                )}

                <div className="prose prose-sm max-w-none prose-slate">
                  <ReactMarkdown>{report.analysis}</ReactMarkdown>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                    <h4 className="text-xs font-bold text-blue-800 uppercase mb-3 flex items-center gap-2">
                       <TrendingUp className="w-3 h-3" /> Key Insights
                    </h4>
                    <ul className="text-sm text-blue-700 space-y-2">
                      {report.insights.map((ins, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-blue-400">•</span> {ins}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                    <h4 className="text-xs font-bold text-green-800 uppercase mb-3 flex items-center gap-2">
                       <Compass className="w-3 h-3" /> Next Steps
                    </h4>
                    <ul className="text-sm text-green-700 space-y-2">
                      {report.nextSteps.map((step, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-green-400">•</span> {step}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-400">
              <BrainCircuit className="w-12 h-12 mb-4 opacity-20" />
              <p className="text-sm font-medium">Select a dataset and run analysis to generate AI insights.</p>
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-xl shadow-lg flex flex-col overflow-hidden max-h-[400px]">
             <div className="bg-slate-900 px-4 py-2 border-b flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                   <MessageSquare className="w-3 h-3" /> Data Chat
                </span>
                <span className="text-[10px] text-slate-500">Ask follow-up questions...</span>
             </div>
             <div className="flex-1 overflow-auto p-4 space-y-4 bg-slate-50">
                {chatHistory.length === 0 && <p className="text-xs text-slate-400 text-center italic mt-4">No messages yet. Start a conversation about your data.</p>}
                {chatHistory.map((msg, i) => (
                  <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                    <div className={cn(
                      "max-w-[80%] rounded-2xl p-3 text-sm shadow-sm",
                      msg.role === "user" ? "bg-blue-600 text-white rounded-tr-none" : "bg-white text-slate-700 border border-slate-200 rounded-tl-none"
                    )}>
                      {msg.text}
                    </div>
                  </div>
                ))}
                {chatLoading && <div className="flex justify-start"><div className="bg-white px-4 py-2 rounded-2xl text-slate-400 text-xs animate-pulse">AI is thinking...</div></div>}
             </div>
             <div className="p-3 border-t bg-white flex gap-2">
                <input 
                  type="text" 
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  disabled={!selectedDatasetId}
                  className="flex-1 text-sm bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Analyze the revenue by region..."
                />
                <button 
                  onClick={sendMessage}
                  disabled={!selectedDatasetId || chatLoading}
                  className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                </button>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}

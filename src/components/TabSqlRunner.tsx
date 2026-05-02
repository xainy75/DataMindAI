import React, { useState, useRef, useEffect } from "react";
import Editor from "@monaco-editor/react";
import { Upload, Play, Info, Download, Database as DbIcon, Table as TableIcon, Search, Sparkles, AlertCircle, BarChart3, ChevronDown, ChevronRight, Eye, BrainCircuit, Loader2, Link, Server, ShieldCheck, History, Bookmark, Trash2, Wand2, ArrowLeftRight, FileText, Globe, Database } from "lucide-react";
import axios from "axios";
import { Dataset, Tab } from "../types";
import ReactMarkdown from "react-markdown";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "../lib/utils";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, ScatterChart, Scatter, AreaChart, Area, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell 
 } from "recharts";

interface TabSqlRunnerProps {
  datasets: Dataset[];
  onDatasetAdded: (dataset: Dataset) => void;
  onRefresh?: () => void;
  selectedDatasetId?: string;
  setSelectedDatasetId?: (id: string) => void;
  setActiveTab?: (tab: Tab) => void;
  initialQuery?: string;
  onClearInitialQuery?: () => void;
}

interface QueryHistoryItem {
  id: string;
  query: string;
  timestamp: number;
}

interface Snippet {
  id: string;
  name: string;
  query: string;
}

export function TabSqlRunner({ datasets, onDatasetAdded, onRefresh, selectedDatasetId, setSelectedDatasetId, setActiveTab, initialQuery, onClearInitialQuery }: TabSqlRunnerProps) {
  const [query, setQuery] = useState("SELECT * FROM your_table LIMIT 10;");

  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
      if (onClearInitialQuery) onClearInitialQuery();
    }
  }, [initialQuery, onClearInitialQuery]);

  const [nlQuery, setNlQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [explanation, setExplanation] = useState("");
  const [errorLog, setErrorLog] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [explaining, setExplaining] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [expandedDatasets, setExpandedDatasets] = useState<Record<string, boolean>>({});
  const [smartChart, setSmartChart] = useState<any>(null);
  const [suggestingChart, setSuggestingChart] = useState(false);
  const [insights, setInsights] = useState("");
  const [generatingInsights, setGeneratingInsights] = useState(false);
  
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [dbType, setDbType] = useState("pg");
  const [dbConfig, setDbConfig] = useState({
    host: "",
    port: "5432",
    user: "",
    password: "",
    database: "",
    ssl: true
  });

  // History & Snippets
  const [history, setHistory] = useState<QueryHistoryItem[]>(() => {
    const saved = localStorage.getItem("sql_history");
    return saved ? JSON.parse(saved) : [];
  });
  const [snippets, setSnippets] = useState<Snippet[]>(() => {
    const saved = localStorage.getItem("sql_snippets");
    return saved ? JSON.parse(saved) : [];
  });
  const [showHistory, setShowHistory] = useState(false);
  const [dialect, setDialect] = useState("SQLite");
  const [converting, setConverting] = useState(false);
  const [prepping, setPrepping] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem("sql_history", JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem("sql_snippets", JSON.stringify(snippets));
  }, [snippets]);

    const toggleDataset = (id: string) => {
    if (setSelectedDatasetId) setSelectedDatasetId(id);
    setExpandedDatasets(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
      setQuery(`SELECT * FROM "${newDataset.id}" LIMIT 10;`);
    } catch (err) {
      alert("Upload failed: " + (err as any).response?.data?.error || (err as any).message);
    } finally {
      setLoading(false);
    }
  };

  const runQuery = async () => {
    setLoading(true);
    setErrorLog(null);
    setInsights("");
    try {
      const res = await axios.post("/api/sql-run", { query, connectionId });
      setResults(res.data.results);
      setExplanation(""); 
      
      // Add to history
      setHistory(prev => [{
        id: Math.random().toString(36).substr(2, 9),
        query,
        timestamp: Date.now()
      }, ...prev].slice(0, 50));

      // NEW: Save as Latest SQL Result for the pipeline
      if (res.data.results.length > 0) {
        const latestDataset: Dataset = {
          id: "latest_sql_result",
          name: "Latest SQL Result",
          data: res.data.results.slice(0, 10), // sample
          metadata: {
            name: "Latest SQL Result",
            columns: Object.keys(res.data.results[0]),
            rowCount: res.data.results.length,
            sample: res.data.results.slice(0, 10),
            stats: {} // Basic stats could be inferred but leaving empty for now
          }
        };
        // Use a small delay to ensure it doesn't conflict with immediate UI updates if any
        onDatasetAdded(latestDataset);
      }

    } catch (err: any) {
      const msg = err.response?.data?.error || err.message;
      setErrorLog(msg);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const saveSnippet = () => {
    const name = prompt("Enter snippet name:");
    if (!name) return;
    setSnippets(prev => [...prev, {
      id: Math.random().toString(36).substr(2, 9),
      name,
      query
    }]);
  };

  const handleSemanticSearch = async () => {
    if (!nlQuery.trim()) return;
    setTranslating(true);
    try {
      const schemaCtx = datasets.map(d => `Table: "${d.id}" (Original name: ${d.name}), Columns: ${d.metadata.columns.join(", ")}`).join("\n");
      const prompt = `Convert this natural language data request into a valid SQLite SELECT query.
      
      Available Tables & Schema:
      ${schemaCtx}
      
      User Request: "${nlQuery}"
      
      Return ONLY the SQL query code block. No explanation. Use double quotes for table names that contain spaces or special characters.`;

      const result = await ai.models.generateContent({
        model: "gemini-flash-latest",
        contents: [{ role: "user", parts: [{ text: prompt }] }]
      });
      const sql = result.text.replace(/```sql|```/g, "").trim();
      setQuery(sql);
      setNlQuery("");
    } catch (err: any) {
      console.error(err);
      alert("Failed to translate to SQL: " + err.message);
    } finally {
      setTranslating(false);
    }
  };

  const convertDialect = async (target: string) => {
    if (target === dialect) return;
    setConverting(true);
    try {
      const prompt = `Convert this ${dialect} SQL query to ${target} syntax.
      
      Original Query:
      ${query}
      
      Return ONLY the converted SQL code block.`;

      const result = await ai.models.generateContent({
        model: "gemini-flash-latest",
        contents: [{ role: "user", parts: [{ text: prompt }] }]
      });
      const converted = result.text.replace(/```sql|```/g, "").trim();
      setQuery(converted);
      setDialect(target);
    } catch (err: any) {
      console.error(err);
      alert("Failed to convert dialect: " + err.message);
    } finally {
      setConverting(false);
    }
  };

  const handlePrepData = async (dataset: Dataset) => {
    setPrepping(dataset.id);
    try {
      const schemaCtx = `Table: "${dataset.id}", Columns: ${dataset.metadata.columns.join(", ")}. Stats: ${JSON.stringify(dataset.metadata.stats)}`;
      const prompt = `Generate a SQL data cleaning and preparation script for the table "${dataset.id}".
      
      Analysis of data:
      ${schemaCtx}
      
      The script should:
      1. Fix inconsistent date formats if detected in columns.
      2. Identify and flag duplicate rows (using a CTE or window function).
      3. Handle missing values (e.g., COALESCE with mean or 'N/A').
      4. Standardize text columns (TRIM, UPPER/LOWER).
      
      Return ONLY the SQL script. Use standard SQL compatible with SQLite/Postgres.`;

      const result = await ai.models.generateContent({
        model: "gemini-flash-latest",
        contents: [{ role: "user", parts: [{ text: prompt }] }]
      });
      const cleaningSql = result.text.replace(/```sql|```/g, "").trim();
      setQuery(cleaningSql);
    } catch (err: any) {
      console.error(err);
      alert("Failed to generate prep script: " + err.message);
    } finally {
      setPrepping(null);
    }
  };

  const generateReport = async () => {
    if (results.length === 0) return;
    setGeneratingInsights(true);
    try {
      const sample = results.slice(0, 10);
      const prompt = `Analyze these SQL query results and provide a 3-sentence executive summary with actionable business insights.
      
      Data Sample: ${JSON.stringify(sample)}
      
      Focus on trends, outliers, or specific recommendations.`;

      const result = await ai.models.generateContent({
        model: "gemini-flash-latest",
        contents: [{ role: "user", parts: [{ text: prompt }] }]
      });
      setInsights(result.text);
    } catch (err: any) {
      console.error(err);
      alert("Failed to generate insights: " + err.message);
    } finally {
      setGeneratingInsights(false);
    }
  };

  const fixSqlWithAi = async () => {
    if (!errorLog) return;
    setFixing(true);
    try {
      const schemaCtx = datasets.map(d => `Table: "${d.id}", Columns: ${d.metadata.columns.join(", ")}`).join("\n");
      const prompt = `Fix this SQL query that resulted in an error.
      
      Error: ${errorLog}
      Broken Query: ${query}
      
      Schema:
      ${schemaCtx}
      
      Return ONLY the fixed SQL query code block. No explanation.`;

      const result = await ai.models.generateContent({
        model: "gemini-flash-latest",
        contents: [{ role: "user", parts: [{ text: prompt }] }]
      });
      const fixedSql = result.text.replace(/```sql|```/g, "").trim();
      setQuery(fixedSql);
      setErrorLog(null);
    } catch (err: any) {
      console.error(err);
      alert("AI could not fix the query: " + err.message);
    } finally {
      setFixing(false);
    }
  };

  const explainQuery = async () => {
    setExplaining(true);
    try {
      const prompt = `Explain this SQL query in plain English: \n\n${query}`;
      const result = await ai.models.generateContent({
        model: "gemini-flash-latest",
        contents: [{ role: "user", parts: [{ text: prompt }] }]
      });
      setExplanation(result.text || "No explanation generated.");
    } catch (err: any) {
      console.error(err);
      setExplanation("Failed to generate explanation: " + err.message);
    } finally {
      setExplaining(false);
    }
  };

  const suggestChart = async () => {
    if (results.length === 0) return;
    setSuggestingChart(true);
    try {
      const sampleResults = results.slice(0, 10);
      const columns = Object.keys(results[0]);
      
      const prompt = `Based on these SQL query results (sample below), suggest the best single chart to visualize it.
      
      Results Sample: ${JSON.stringify(sampleResults)}
      Columns: ${columns.join(", ")}
      
      Respond with ONLY a JSON object:
      {
        "type": "bar" | "line" | "pie" | "area",
        "title": "A good title",
        "xKey": "column for x-axis",
        "yKey": "column for y-axis",
        "color": "#hex"
      }`;

      const result = await ai.models.generateContent({
        model: "gemini-flash-latest",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: { responseMimeType: "application/json" }
      });
      const config = JSON.parse(result.text.replace(/```json|```/g, "").trim());
      setSmartChart(config);
    } catch (err: any) {
      console.error(err);
      alert("Failed to suggest a chart: " + err.message);
    } finally {
      setSuggestingChart(false);
    }
  };

  const handleConnect = async () => {
    setLoading(true);
    try {
      const res = await axios.post("/api/db-connect", { ...dbConfig, type: dbType });
      setConnectionId(res.data.connectionId);
      
      // Add all discovered datasets
      res.data.datasets.forEach((d: Dataset) => {
        onDatasetAdded(d);
      });
      if (onRefresh) onRefresh();
      
      setShowConnectModal(false);
      alert("Successfully connected to the database!");
    } catch (err: any) {
      alert("Connection failed: " + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const renderSmartChart = () => {
    if (!smartChart || results.length === 0) return null;
    const data = results.slice(0, 20); // Limit data for preview

    switch (smartChart.type) {
      case "bar":
        return (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
            <XAxis dataKey={smartChart.xKey} tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Bar dataKey={smartChart.yKey} fill={smartChart.color || "#1a73e8"} radius={[4, 4, 0, 0]} />
          </BarChart>
        );
      case "line":
        return (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
            <XAxis dataKey={smartChart.xKey} tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Line type="monotone" dataKey={smartChart.yKey} stroke={smartChart.color || "#1a73e8"} strokeWidth={2} dot={{ r: 4 }} />
          </LineChart>
        );
      case "area":
        return (
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
            <XAxis dataKey={smartChart.xKey} tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Area type="monotone" dataKey={smartChart.yKey} stroke={smartChart.color || "#1a73e8"} fill={smartChart.color || "#1a73e8"} fillOpacity={0.1} />
          </AreaChart>
        );
      case "pie":
        return (
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              outerRadius={80}
              fill="#8884d8"
              dataKey={smartChart.yKey}
              nameKey={smartChart.xKey}
              label
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={[`#1a73e8`, `#34a853`, `#fbbc04`, `#ea4335`, `#673ab7`][index % 5]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        );
      default:
        return <p className="text-sm text-slate-500">Unsupported chart type: {smartChart.type}</p>;
    }
  };

  const exportCsv = () => {
    if (results.length === 0) return;
    const headers = Object.keys(results[0]).join(",");
    const rows = results.map(row => Object.values(row).map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([`${headers}\n${rows}`], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "query_results.csv";
    a.click();
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">SQL Runner</h2>
          <p className="text-slate-500 text-sm">Query your uploaded datasets with raw SQL or natural language.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowHistory(!showHistory)}
            className="p-2 text-slate-500 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            title="History & Snippets"
          >
            <History className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setShowConnectModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white hover:bg-slate-800 cursor-pointer shadow-sm transition-colors text-sm font-medium"
          >
            <Link className="w-4 h-4" />
            Connect DB
          </button>
          <label className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 cursor-pointer shadow-sm transition-colors text-sm font-medium">
            <Upload className="w-4 h-4" />
            Upload File
            <input type="file" className="hidden" accept=".csv,.xlsx,.xls,.json,.docx,.txt" onChange={handleFileUpload} />
          </label>
        </div>
      </div>

      {/* Semantic Search Bar */}
      <div className="relative group">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
          <Search className="w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
        </div>
        <input 
          type="text" 
          value={nlQuery}
          onChange={(e) => setNlQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSemanticSearch()}
          placeholder="e.g., Show me the top 10 rows from the sales table ordered by revenue..."
          className="w-full pl-11 pr-32 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm"
        />
        <button 
          onClick={handleSemanticSearch}
          disabled={translating || !nlQuery.trim()}
          className="absolute right-2 top-2 bottom-2 px-4 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 disabled:opacity-50 transition-colors flex items-center gap-2"
        >
          {translating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
          Ask AI
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[500px]">
        {/* Main Editor Section */}
        <div className="lg:col-span-3 border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col bg-white overflow-visible">
          <div className="bg-slate-50 px-4 py-2 border-b flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Play className="w-3 h-3" /> SQL Editor
              </span>
              <div className="flex items-center gap-1">
                <ArrowLeftRight className="w-3 h-3 text-slate-400" />
                <select 
                  value={dialect}
                  onChange={(e) => convertDialect(e.target.value)}
                  disabled={converting}
                  className="bg-transparent text-[10px] font-bold text-slate-500 outline-none cursor-pointer border border-slate-200 rounded px-1 hover:border-slate-300 transition-colors"
                >
                  <option value="SQLite">SQLite</option>
                  <option value="PostgreSQL">PostgreSQL</option>
                  <option value="BigQuery">BigQuery</option>
                  <option value="MySQL">MySQL</option>
                </select>
                {converting && <Loader2 className="w-2.5 h-2.5 animate-spin text-blue-500" />}
              </div>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={saveSnippet}
                className="text-[10px] text-slate-500 hover:text-slate-700 font-medium flex items-center gap-1 bg-slate-100 px-2 py-1 rounded"
                title="Save as Snippet"
              >
                <Bookmark className="w-3 h-3" /> Save Snippet
              </button>
              <button 
                onClick={explainQuery}
                disabled={explaining}
                className="text-[10px] text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 bg-blue-50 px-2 py-1 rounded"
              >
                {explaining ? <Loader2 className="w-3 h-3 animate-spin" /> : <Info className="w-3 h-3" />} AI Explain
              </button>
            </div>
          </div>
          <div className="flex-1 relative">
            <Editor
              height="100%"
              defaultLanguage="sql"
              theme="vs-light"
              value={query}
              onChange={(v) => setQuery(v || "")}
              onMount={(editor, monaco) => {
                editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
                  runQuery();
                });
              }}
              options={{ 
                minimap: { enabled: false }, 
                fontSize: 13, 
                padding: { top: 12 },
                scrollbar: { vertical: 'hidden' },
                lineNumbers: 'on',
                glyphMargin: false,
                folding: false,
              }}
            />
            
            <AnimatePresence>
              {errorLog && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute bottom-4 left-4 right-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-3 shadow-xl z-20"
                >
                  <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs font-bold text-red-800 mb-1">SQL Error</p>
                    <p className="text-xs text-red-700 font-mono line-clamp-2">{errorLog}</p>
                  </div>
                  <button 
                    onClick={fixSqlWithAi}
                    disabled={fixing}
                    className="shrink-0 bg-red-600 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-red-700 transition-colors flex items-center gap-2 shadow-sm"
                  >
                    {fixing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    AI Fix
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="bg-slate-50 px-4 py-3 border-t flex justify-end">
             <button 
                onClick={runQuery}
                disabled={loading}
                className="px-6 py-2 bg-[#1a73e8] text-white rounded-lg font-medium text-sm hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/20 flex items-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                {loading ? "Running..." : "Run Query"}
              </button>
          </div>
        </div>

        {/* Sidebar Section */}
        <div className="lg:col-span-1 bg-white border border-slate-200 rounded-xl flex flex-col shadow-sm">
          <div className="bg-slate-50 border-b flex p-1 overflow-hidden rounded-t-xl">
             <button 
               onClick={() => setShowHistory(false)}
               className={cn("flex-1 py-1.5 text-[10px] font-bold rounded-md transition-all", !showHistory ? "bg-white text-blue-600 shadow-sm" : "text-slate-400")}
             >
               Datasets
             </button>
             <button 
               onClick={() => setShowHistory(true)}
               className={cn("flex-1 py-1.5 text-[10px] font-bold rounded-md transition-all", showHistory ? "bg-white text-blue-600 shadow-sm" : "text-slate-400")}
             >
               History
             </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {!showHistory ? (
              datasets.length === 0 ? (
                <div className="text-center py-12">
                  <TableIcon className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">No Data Sources</p>
                </div>
              ) : (
                datasets.map(d => (
                  <div key={d.id} className={cn(
                    "bg-slate-50/50 rounded-xl border shadow-sm overflow-hidden transition-all group",
                    selectedDatasetId === d.id ? "border-blue-300 ring-1 ring-blue-100" : "border-slate-200"
                  )}>
                    <div 
                      className={cn(
                        "p-3 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors",
                        selectedDatasetId === d.id ? "bg-blue-50/30" : ""
                      )}
                      onClick={() => toggleDataset(d.id)}
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <TableIcon className="w-3 h-3 text-slate-400 group-hover:text-blue-500" />
                        <span className="text-xs font-bold text-slate-700 truncate">{d.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                         <button 
                           onClick={(e) => { e.stopPropagation(); setQuery(`SELECT * FROM "${d.id}" LIMIT 10;`); }}
                           className="p-1 text-slate-500 hover:bg-slate-100 rounded transition-colors"
                           title="Query this table"
                         >
                            <Play className="w-3 h-3" />
                         </button>
                         <button 
                           onClick={(e) => { e.stopPropagation(); if (setActiveTab && setSelectedDatasetId) { setSelectedDatasetId(d.id); setActiveTab("analyzer"); } }}
                           className="p-1 text-emerald-500 hover:bg-emerald-50 rounded transition-colors"
                           title="AI Analysis"
                         >
                            <BrainCircuit className="w-3 h-3" />
                         </button>
                         <button 
                           onClick={(e) => { e.stopPropagation(); handlePrepData(d); }}
                           disabled={prepping === d.id}
                           className="p-1 text-blue-500 hover:bg-blue-50 rounded transition-colors"
                           title="AI Data Prep"
                         >
                           {prepping === d.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                         </button>
                         {expandedDatasets[d.id] ? <ChevronDown className="w-3 h-3 text-slate-400" /> : <ChevronRight className="w-3 h-3 text-slate-400" />}
                      </div>
                    </div>
                    
                    {expandedDatasets[d.id] && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        className="px-3 pb-3 border-t border-slate-200 bg-white"
                      >
                        <div className="py-2 space-y-3">
                          <div 
                            className="group/id relative cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(d.id);
                              // Simple momentary feedback could be nice but keeping it minimal
                            }}
                          >
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mb-1">Dataset ID (Click to Copy)</p>
                            <code className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 font-mono block truncate group-hover/id:bg-blue-100 transition-colors">
                              "{d.id}"
                            </code>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2">
                            <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                              <p className="text-[8px] text-slate-400 font-medium uppercase">Rows</p>
                              <p className="text-xs font-black text-slate-700">{d.metadata.rowCount > 0 ? d.metadata.rowCount.toLocaleString() : "Ext"}</p>
                            </div>
                            <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                              <p className="text-[8px] text-slate-400 font-medium uppercase">Cols</p>
                              <p className="text-xs font-black text-slate-700">{d.metadata.columns.length}</p>
                            </div>
                          </div>

                          <div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mb-2 flex items-center justify-between">
                              <span>Column Schema</span>
                              <Eye className="w-2.5 h-2.5" />
                            </p>
                            <div className="max-h-48 overflow-auto space-y-1 pr-1 custom-scrollbar">
                              {d.metadata.columns.map((col, idx) => (
                                <div key={idx} className="py-1.5 border-b border-slate-50 last:border-0">
                                  <div className="flex items-center justify-between text-[10px] mb-0.5">
                                    <span className="font-mono text-slate-700 font-bold">{col}</span>
                                    <span className="text-slate-400 italic text-[8px]">{d.metadata.stats?.[col]?.type || "Text"}</span>
                                  </div>
                                  <div className="flex items-center justify-between text-[8px] text-slate-400 uppercase tracking-widest">
                                    <span>Missing</span>
                                    <span className={cn(d.metadata.stats?.[col]?.missing > 0 ? "text-red-500 font-bold" : "")}>
                                      {d.metadata.stats?.[col]?.missing || 0}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </div>
                ))
              )
            ) : (
               <div className="space-y-4">
                  {snippets.length > 0 && (
                    <div>
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                        <Bookmark className="w-2.5 h-2.5" /> Saved Snippets
                      </h4>
                      <div className="space-y-1.5">
                        {snippets.map(s => (
                          <div key={s.id} className="p-2 border border-slate-200 rounded-lg bg-slate-50/50 hover:bg-slate-100 transition-colors group cursor-pointer" onClick={() => setQuery(s.query)}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] font-bold text-slate-700">{s.name}</span>
                              <button onClick={(e) => { e.stopPropagation(); setSnippets(prev => prev.filter(it => it.id !== s.id)); }} className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 transition-all">
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                            <code className="text-[9px] text-slate-400 block truncate font-mono">{s.query}</code>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                       <History className="w-2.5 h-2.5" /> Recent History
                    </h4>
                    {history.length === 0 ? (
                      <p className="text-[10px] text-slate-400 italic text-center py-4">No recent queries.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {history.map(h => (
                          <div key={h.id} className="p-2 border border-slate-100 rounded-lg bg-white hover:border-blue-200 transition-all cursor-pointer" onClick={() => setQuery(h.query)}>
                            <p className="text-[9px] text-slate-400 mb-1">{new Date(h.timestamp).toLocaleTimeString()}</p>
                            <code className="text-[9px] text-slate-600 block line-clamp-2 font-mono whitespace-pre">{h.query}</code>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
               </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {explanation && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-blue-50 border border-blue-100 rounded-xl p-6 relative overflow-hidden shadow-sm"
          >
            <button onClick={() => setExplanation("")} className="absolute top-4 right-4 text-blue-300 hover:text-blue-500 font-bold text-lg">×</button>
            <h4 className="text-sm font-bold text-blue-800 mb-2 flex items-center gap-2">
              <BrainCircuit className="w-4 h-4" /> AI Analysis
            </h4>
            <div className="text-sm text-blue-700 prose prose-sm max-w-none prose-blue">
              <ReactMarkdown>{explanation}</ReactMarkdown>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col bg-white">
        <div className="bg-slate-50 px-6 py-3 border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Results ({results.length})</span>
            {results.length > 0 && (
              <>
                <button 
                  onClick={suggestChart}
                  disabled={suggestingChart}
                  className="text-[10px] bg-indigo-50 text-indigo-600 border border-indigo-100 px-3 py-1 rounded-full font-bold flex items-center gap-1.5 hover:bg-indigo-100 transition-colors disabled:opacity-50"
                >
                  {suggestingChart ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <BarChart3 className="w-2.5 h-2.5" />}
                  Smart Visualize
                </button>
                <button 
                  onClick={generateReport}
                  disabled={generatingInsights}
                  className="text-[10px] bg-emerald-50 text-emerald-600 border border-emerald-100 px-3 py-1 rounded-full font-bold flex items-center gap-1.5 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                >
                  {generatingInsights ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <FileText className="w-2.5 h-2.5" />}
                  AI Insights
                </button>
                <button 
                  onClick={() => {
                    if (setSelectedDatasetId && setActiveTab) {
                      setSelectedDatasetId("latest_sql_result");
                      setActiveTab("analyzer");
                    }
                  }}
                  className="text-[10px] bg-blue-600 text-white px-3 py-1 rounded-full font-bold flex items-center gap-1.5 hover:bg-blue-700 transition-colors shadow-sm"
                >
                  Analyze these Results →
                </button>
              </>
            )}
          </div>
          {results.length > 0 && (
            <button onClick={exportCsv} className="text-xs text-slate-600 hover:text-slate-900 font-medium flex items-center gap-1">
              <Download className="w-3 h-3" /> Export CSV
            </button>
          )}
        </div>
        
        <div className="flex-1 overflow-auto">
          <AnimatePresence>
            {insights && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-6 bg-emerald-50/50 border-b border-emerald-100 flex items-start gap-4 relative"
              >
                 <Sparkles className="w-5 h-5 text-emerald-500 mt-1 shrink-0" />
                 <div className="flex-1">
                    <h5 className="text-xs font-bold text-emerald-800 uppercase tracking-widest mb-1">Executive Summary</h5>
                    <p className="text-sm text-emerald-700 leading-relaxed font-medium italic">"{insights}"</p>
                 </div>
                 <button onClick={() => setInsights("")} className="text-emerald-300 hover:text-emerald-500 font-bold px-2">×</button>
              </motion.div>
            )}
          </AnimatePresence>

          {results.length > 0 ? (
            <table className="w-full text-left border-collapse min-w-full">
              <thead>
                <tr className="bg-slate-50/50 sticky top-0 z-10 shadow-sm">
                  {Object.keys(results[0]).map(k => (
                    <th key={k} className="px-6 py-3 text-xs font-bold text-slate-500 uppercase border-b border-slate-100">{k}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {results.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    {Object.values(row).map((v: any, j) => (
                      <td key={j} className="px-6 py-3 text-sm text-slate-600 whitespace-nowrap">{String(v)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : errorLog ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">Query Failed</h3>
              <p className="text-sm text-slate-500 max-w-2xl mb-6 font-mono bg-slate-50 p-4 rounded-lg border border-slate-100 break-words text-left overflow-auto max-h-48 custom-scrollbar">
                {errorLog}
              </p>
              <button 
                onClick={fixSqlWithAi}
                disabled={fixing}
                className="px-8 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-all flex items-center gap-3 shadow-lg shadow-slate-200 active:scale-95"
              >
                {fixing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                AI Fix Query
              </button>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-slate-300 space-y-3">
              <Database className="w-12 h-12 text-slate-100" />
              <div className="text-center">
                <p className="text-sm font-semibold uppercase tracking-widest mb-1">Ready for Query</p>
                <p className="text-xs opacity-60">Run a SELECT statement to see insights.</p>
              </div>
            </div>
          )}
        </div>
      </div>
      
      <AnimatePresence>
        {smartChart && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden"
            >
              <div className="p-4 border-b bg-slate-50 flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-indigo-600" /> {smartChart.title}
                </h4>
                <button onClick={() => setSmartChart(null)} className="text-slate-400 hover:text-slate-600 font-bold px-2 text-xl">×</button>
              </div>
              <div className="p-8 h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  {renderSmartChart() || <div />}
                </ResponsiveContainer>
              </div>
              <div className="p-4 bg-slate-50 border-t flex justify-end gap-2 text-xs text-slate-500">
                <span>AI selected <b>{smartChart.type}</b> chart based on your data columns.</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showConnectModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="p-6 border-b bg-slate-50">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Server className="w-5 h-5 text-blue-600" /> Database Connection
                  </h3>
                  <button onClick={() => setShowConnectModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-xl">×</button>
                </div>
                <p className="text-sm text-slate-500">Connect to external Cloud, Azure, or on-premise databases.</p>
              </div>

              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Database Type</label>
                    <select 
                      value={dbType}
                      onChange={(e) => {
                        setDbType(e.target.value);
                        setDbConfig({...dbConfig, port: e.target.value === "pg" ? "5432" : "3306"});
                      }}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="pg">PostgreSQL (Cloud, Azure)</option>
                      <option value="mysql2">MySQL / MariaDB</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Host / Endpoint</label>
                    <input 
                      type="text" 
                      placeholder="db.example.com"
                      value={dbConfig.host}
                      onChange={(e) => setDbConfig({...dbConfig, host: e.target.value})}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Port</label>
                    <input 
                      type="text" 
                      value={dbConfig.port}
                      onChange={(e) => setDbConfig({...dbConfig, port: e.target.value})}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Database Name</label>
                    <input 
                      type="text" 
                      placeholder="main_db"
                      value={dbConfig.database}
                      onChange={(e) => setDbConfig({...dbConfig, database: e.target.value})}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Username</label>
                    <input 
                      type="text" 
                      value={dbConfig.user}
                      onChange={(e) => setDbConfig({...dbConfig, user: e.target.value})}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Password</label>
                    <input 
                      type="password" 
                      value={dbConfig.password}
                      onChange={(e) => setDbConfig({...dbConfig, password: e.target.value})}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 py-2">
                  <input 
                    type="checkbox" 
                    id="ssl"
                    checked={dbConfig.ssl}
                    onChange={(e) => setDbConfig({...dbConfig, ssl: e.target.checked})}
                    className="w-4 h-4 text-blue-600"
                  />
                  <label htmlFor="ssl" className="text-xs font-medium text-slate-600 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Enable SSL (Required for most cloud DBs)
                  </label>
                </div>
              </div>

              <div className="p-6 bg-slate-50 border-t flex justify-end gap-3">
                <button 
                  onClick={() => setShowConnectModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleConnect}
                  disabled={loading || !dbConfig.host || !dbConfig.database}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 disabled:opacity-50 shadow-lg shadow-blue-200 flex items-center gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link className="w-4 h-4" />}
                  Connect Database
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

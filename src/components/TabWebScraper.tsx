import React, { useState, useEffect } from "react";
import { Globe, Search, Database, Loader2, AlertCircle, CheckCircle2, Download, Copy, Sparkles, Zap, Layers, Shield, ArrowRight, Terminal, Table as TableIcon, Info } from "lucide-react";
import axios from "axios";
import { Dataset } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

interface TabWebScraperProps {
  onDatasetAdded: (dataset: Dataset) => void;
  onRefresh?: () => void;
}

interface ScrapingLog {
  id: string;
  msg: string;
  type: "info" | "success" | "error" | "ai";
  timestamp: string;
}

export function TabWebScraper({ onDatasetAdded, onRefresh }: TabWebScraperProps) {
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState("smart");
  const [jsRender, setJsRender] = useState(false);
  const [paginationDepth, setPaginationDepth] = useState(1);
  const [proxyEnabled, setProxyEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scrapedData, setScrapedData] = useState<any>(null);
  const [logs, setLogs] = useState<ScrapingLog[]>([]);
  const [progress, setProgress] = useState(0);
  const [nlFocus, setNlFocus] = useState("");
  const [isPreScanning, setIsPreScanning] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [suggestedSchema, setSuggestedSchema] = useState<string[]>([]);

  const addLog = (msg: string, type: ScrapingLog["type"] = "info") => {
    const newLog: ScrapingLog = {
      id: Math.random().toString(36).substr(2, 9),
      msg,
      type,
      timestamp: new Date().toLocaleTimeString().split(" ")[0],
    };
    setLogs(prev => [newLog, ...prev].slice(0, 50));
  };

  const handlePreScan = async () => {
    if (!url) return;
    setIsPreScanning(true);
    addLog(`Pre-scanning ${url} for schema patterns...`, "ai");
    try {
      const res = await axios.post("/api/scrape-pre-scan", { url });
      const htmlText = res.data.text;

      const prompt = `Analyze this webpage content and suggest a list of column names that represent the structured data present (like products, articles, or table data).
      
      Content:
      ${htmlText}
      
      Return ONLY a JSON array of strings.`;

      const result = await ai.models.generateContent({
        model: "gemini-flash-latest",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });
      
      const columns = JSON.parse(result.text.replace(/```json|```/g, "").trim());
      setSuggestedSchema(columns || []);
      addLog(`Suggested columns identified: ${columns?.join(", ")}`, "success");
    } catch (err) {
      addLog("Pre-scan failed. Using generic detection.", "error");
    } finally {
      setIsPreScanning(false);
    }
  };

  const handleScrape = async () => {
    if (!url) return;
    setLoading(true);
    setScrapedData(null);
    setLogs([]);
    setProgress(10);
    addLog(`Initiating scraping for ${url}...`);

    try {
      addLog("Fetching page content...", "info");
      setProgress(30);
      
      const res = await axios.post("/api/scrape", { 
        url, 
        mode,
        jsRender,
        paginationDepth,
        proxyEnabled,
      });
      
      setProgress(70);
      let finalResults = res.data.results;

      if (mode === "smart" || nlFocus) {
        addLog("AI processing HTML structure to extract clean data...", "ai");
        const htmlBody = res.data.html;

        const prompt = `You are a professional data scraper. 
        Instruction: ${nlFocus || "Extract structured data in tabular format."}
        
        HTML:
        ${htmlBody}
        
        Return ONLY a JSON object:
        {
          "tables": [
            [["Col1", "Col2"], ["Val1", "Val2"]]
          ],
          "summary": "..."
        }`;

        const result = await ai.models.generateContent({
          model: "gemini-flash-latest",
          contents: [{ role: "user", parts: [{ text: prompt }] }]
        });
        
        finalResults = JSON.parse(result.text.replace(/```json|```/g, "").trim());
      }

      setScrapedData(finalResults);
      addLog("Scraping completed successfully!", "success");
      setProgress(100);
      
      if (finalResults.tables?.length > 0) {
        addLog(`Found ${finalResults.tables.length} structured tables.`, "success");
      }
    } catch (err: any) {
      const errorMsg = err.message;
      addLog(`Error: ${errorMsg}`, "error");
      alert("Scraping failed: " + errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const saveToDatasets = async () => {
    if (!scrapedData || !scrapedData.tables || scrapedData.tables.length === 0) return;
    
    setLoading(true);
    addLog("Converting data to SQL table...", "info");
    try {
      const table = scrapedData.tables[0];
      const columns = table[0];
      const rows = table.slice(1).map((r: any[]) => {
        const obj: any = {};
        columns.forEach((col: string, i: number) => {
          obj[col] = r[i];
        });
        return obj;
      });

      const hostname = new URL(url).hostname.replace(/[^a-z0-9]/gi, "_").toLowerCase();
      const tableName = `scraped_${hostname}_${Date.now().toString().slice(-4)}`;

      const res = await axios.post("/api/create-table", { tableName, data: rows });
      
      const dataset: Dataset = {
        id: res.data.tableName,
        name: `Scraped: ${hostname}`,
        data: res.data.metadata.sample,
        metadata: res.data.metadata
      };
      
      onDatasetAdded(dataset);
      if (onRefresh) onRefresh();
      addLog(`Successfully moved data to SQL runner as table "${res.data.tableName}"`, "success");
      alert("Successfully converted website table into a SQL database table!");
    } catch (err: any) {
      addLog("Failed to create SQL table.", "error");
      alert("Failed to create table: " + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const downloadCsv = (table: any[], index: number = 0) => {
    if (!table || table.length === 0) return;
    try {
      const csvContent = table.map((row: any[]) => 
        row.map(cell => {
          const str = String(cell ?? "");
          return `"${str.replace(/"/g, '""')}"`;
        }).join(",")
      ).join("\n");
      
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const u = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = u;
      const hostname = url ? new URL(url).hostname : "scraped_data";
      link.download = `scraped_${hostname.replace(/[^a-z0-9]/gi, "_")}_table_${index + 1}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(u);
      addLog(`Downloaded Table ${index + 1} as CSV`, "success");
    } catch (err) {
      console.error("Download failed:", err);
      addLog("Failed to generate CSV download", "error");
    }
  };

  const copyTableToClipboard = (table: any[], id: string) => {
    if (!table || table.length === 0) return;
    try {
      const tsvContent = table.map((row: any[]) => row.join("\t")).join("\n");
      navigator.clipboard.writeText(tsvContent)
        .then(() => {
          setCopiedId(id);
          setTimeout(() => setCopiedId(null), 2000);
          addLog("Table copied to clipboard (TSV format)", "success");
        })
        .catch(err => {
          console.error("Clipboard copy failed:", err);
          alert("Copy failed. Please try manually.");
        });
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Advanced Web Scraper</h2>
          <p className="text-slate-500 text-sm">Turn any website into a clean dataset using AI-powered extraction.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configuration Panel */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col gap-4 mb-6">
              <div className="flex gap-3">
                <div className="flex-1 relative group">
                  <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                  <input 
                    type="text" 
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="Paste URL to scrape (e.g., https://news.google.com)"
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-inner"
                  />
                </div>
                <button 
                  onClick={handlePreScan}
                  disabled={isPreScanning || !url}
                  className="px-4 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  {isPreScanning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                  Pre-Scan
                </button>
                <button 
                  onClick={handleScrape}
                  disabled={loading || !url}
                  className="px-8 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-all shadow-lg disabled:opacity-50 flex items-center gap-2 group whitespace-nowrap"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 group-hover:scale-125 transition-transform" />}
                  {loading ? "Capturing..." : "Scrape Now"}
                </button>
              </div>

              <div className="relative group">
                <Sparkles className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400" />
                <input 
                  type="text"
                  value={nlFocus}
                  onChange={(e) => setNlFocus(e.target.value)}
                  placeholder="AI Instruction: 'Filter for laptops under $1000' or 'Extract only stock prices'..."
                  className="w-full pl-11 pr-4 py-3 bg-blue-50/50 border border-blue-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>

              {suggestedSchema.length > 0 && (
                <div className="flex flex-wrap gap-2 animate-in fade-in slide-in-from-top-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1 py-1">AI Detected:</span>
                  {suggestedSchema.map((col, i) => (
                    <span key={i} className="px-2 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-lg border border-emerald-100">
                      {col}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                  <Layers className="w-3 h-3" /> Mode
                </label>
                <select 
                  value={mode}
                  onChange={(e) => setMode(e.target.value)}
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="smart">AI Smart Filter</option>
                  <option value="tables">Tables Only</option>
                  <option value="text">Full Content</option>
                  <option value="links">Links Discovery</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                  <ArrowRight className="w-3 h-3" /> Max Depth
                </label>
                <input 
                  type="number" 
                  min="1" max="5" 
                  value={paginationDepth}
                  onChange={(e) => setPaginationDepth(parseInt(e.target.value))}
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-4">
                <input 
                  type="checkbox" 
                  id="js-render"
                  checked={jsRender}
                  onChange={(e) => setJsRender(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <label htmlFor="js-render" className="text-xs font-bold text-slate-600 cursor-pointer select-none">JS Rendering</label>
              </div>

              <div className="flex items-center gap-2 pt-4">
                <input 
                  type="checkbox" 
                  id="proxy"
                  checked={proxyEnabled}
                  onChange={(e) => setProxyEnabled(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <label htmlFor="proxy" className="text-xs font-bold text-slate-600 cursor-pointer select-none flex items-center gap-1">
                  <Shield className="w-3 h-3 text-slate-400" /> Use Proxies
                </label>
              </div>
            </div>
          </div>

          <AnimatePresence>
            {loading && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="overflow-hidden"
              >
                <div className="w-full h-1 bg-slate-100 rounded-full mb-2">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    className="h-full bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Result View */}
          {scrapedData && (
             <div className="space-y-6">
                {scrapedData.tables?.length > 0 ? (
                  scrapedData.tables.map((table: any[][], tIdx: number) => (
                    <div key={tIdx} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col animate-in fade-in slide-in-from-bottom-4" style={{ animationDelay: `${tIdx * 100}ms` }}>
                       <div className="bg-slate-50 px-6 py-3 border-b flex items-center justify-between">
                         <div className="flex items-center gap-4">
                           <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                             <TableIcon className="w-3 h-3" /> Table {tIdx + 1} ({table.length} rows)
                           </span>
                         </div>
                         <div className="flex gap-2">
                           <button 
                             onClick={() => copyTableToClipboard(table, `copy_${tIdx}`)}
                             className={cn(
                               "px-3 py-1 text-[10px] font-bold border rounded transition-all flex items-center gap-1.5 shadow-sm",
                               copiedId === `copy_${tIdx}` 
                                 ? "bg-emerald-500 border-emerald-600 text-white" 
                                 : "bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                             )}
                             title="Copy to Clipboard (TSV)"
                           >
                             <AnimatePresence mode="wait">
                               {copiedId === `copy_${tIdx}` ? (
                                 <motion.div
                                   key="check"
                                   initial={{ scale: 0 }}
                                   animate={{ scale: 1 }}
                                   exit={{ scale: 0 }}
                                 >
                                   <CheckCircle2 className="w-3 h-3" />
                                 </motion.div>
                               ) : (
                                 <motion.div
                                   key="copy"
                                   initial={{ scale: 0 }}
                                   animate={{ scale: 1 }}
                                   exit={{ scale: 0 }}
                                 >
                                   <Copy className="w-3 h-3" />
                                 </motion.div>
                               )}
                             </AnimatePresence>
                             {copiedId === `copy_${tIdx}` ? "Copied!" : "Copy"}
                           </button>
                           <button 
                             onClick={() => downloadCsv(table, tIdx)}
                             className="px-3 py-1 text-[10px] font-bold text-slate-600 hover:text-slate-900 border border-slate-200 rounded transition-all bg-white flex items-center gap-1.5 hover:bg-slate-50 shadow-sm"
                             title="Download as CSV"
                           >
                             <Download className="w-3 h-3 text-blue-500" />
                             CSV
                           </button>
                           <button 
                             onClick={() => {
                               // Quick fix to reuse the save logic for a specific table
                               const originalTables = scrapedData.tables;
                               setScrapedData({ ...scrapedData, tables: [table] });
                               setTimeout(() => {
                                 saveToDatasets();
                                 setScrapedData({ ...scrapedData, tables: originalTables });
                               }, 0);
                             }}
                             className="px-3 py-1 text-[10px] font-bold text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors flex items-center gap-1 shadow-sm shadow-blue-200"
                           >
                             <Database className="w-3 h-3" /> SQL
                           </button>
                         </div>
                       </div>
                       
                       <div className="overflow-auto max-h-[400px]">
                          <table className="w-full text-left border-collapse">
                            <thead className="bg-[#F8FAFC]/80 backdrop-blur sticky top-0">
                              <tr>
                                {table[0]?.map((col: string, i: number) => (
                                  <th key={i} className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-tighter border-b border-slate-100">{col}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {table.slice(1, 20).map((row: string[], i: number) => (
                                <tr key={i} className="hover:bg-blue-50/30 transition-colors group">
                                  {row.map((cell, j) => (
                                    <td key={j} className="px-6 py-3 text-xs text-slate-600 truncate max-w-[200px] border-r border-slate-50/50 last:border-0 group-hover:text-blue-700 transition-colors">{cell}</td>
                                  ))}
                                </tr>
                              ))}
                              {table.length > 20 && (
                                <tr>
                                  <td colSpan={table[0].length} className="px-6 py-4 text-center text-[10px] font-bold text-slate-400 bg-slate-50/50">
                                    + {table.length - 20} more rows (not showing in preview)
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                       </div>
                    </div>
                  ))
                ) : (
                  <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-400 italic text-sm shadow-sm">
                    No tabular data found matching the current filter.
                  </div>
                )}
             </div>
          )}
        </div>

        {/* Status Terminal & Metrics */}
        <div className="lg:col-span-1 space-y-4">
           <div className="bg-slate-900 text-slate-300 rounded-2xl p-5 shadow-xl flex flex-col h-[500px]">
              <div className="flex items-center gap-2 mb-4">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Scraping Console</span>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2.5 custom-scrollbar-dark font-mono text-[10px]">
                {logs.length === 0 ? (
                  <p className="text-slate-600 italic">Console ready. Waiting for input...</p>
                ) : (
                  logs.map(log => (
                    <div key={log.id} className="flex gap-2 animate-in fade-in slide-in-from-left-4">
                      <span className="text-slate-600 shrink-0">[{log.timestamp}]</span>
                      <span className={cn(
                        log.type === "info" ? "text-slate-400" :
                        log.type === "success" ? "text-emerald-400" :
                        log.type === "error" ? "text-rose-400" :
                        "text-blue-300 flex items-center gap-1"
                      )}>
                        {log.type === "ai" && <Sparkles className="w-2.5 h-2.5" />}
                        {log.msg}
                      </span>
                    </div>
                  ))
                )}
              </div>
              
              <div className="mt-4 pt-4 border-t border-slate-800 space-y-3">
                 <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold text-slate-500 uppercase">Detection Mode</span>
                    <span className="text-[10px] text-emerald-500 font-bold">{mode.toUpperCase()}</span>
                 </div>
                 <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold text-slate-500 uppercase">JS Engine</span>
                    <span className={cn("text-[10px] font-bold", jsRender ? "text-blue-400" : "text-slate-600")}>
                      {jsRender ? "ENABLED" : "DISABLED"}
                    </span>
                 </div>
              </div>
           </div>

           <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 shadow-sm">
              <h4 className="text-xs font-bold text-blue-800 uppercase tracking-widest flex items-center gap-2 mb-3">
                <Info className="w-4 h-4" /> Pro Tip
              </h4>
              <p className="text-xs text-blue-700 leading-relaxed">
                Use <b>AI Smart Filter</b> to automatically extract clean data from messy pages. It understands dynamic layouts and ignores non-data elements.
              </p>
           </div>
        </div>
      </div>
    </div>
  );
}

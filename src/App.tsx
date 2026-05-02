import React, { useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { TabHome } from "./components/TabHome";
import { TabSettings } from "./components/TabSettings";
import { TabSqlRunner } from "./components/TabSqlRunner";
import { TabWebScraper } from "./components/TabWebScraper";
import { TabAiAnalyzer } from "./components/TabAiAnalyzer";
import { TabDashboardBuilder } from "./components/TabDashboardBuilder";
import { Dataset, Tab, AppHistoryItem, SavedWorkItem, AppSettings } from "./types";
import { motion, AnimatePresence } from "motion/react";
import axios from "axios";

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState("");
  const [initialSqlQuery, setInitialSqlQuery] = useState("");
  const [analysisReport, setAnalysisReport] = useState<{ insights: string; suggestions: any[] } | null>(null);
  const [history, setHistory] = useState<AppHistoryItem[]>([]);
  const [savedWork, setSavedWork] = useState<SavedWorkItem[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    engine: "python",
    developerMode: false,
    dbConnectionString: "",
    storageType: "cache",
    autoCleanup: true,
    model: "gemini-1.5-flash",
    temperature: 0.7,
    theme: "cyberpunk",
    layout: "side-by-side",
    exportFormat: "pdf"
  });

  const fetchTables = async () => {
    try {
      const res = await axios.get("/api/tables");
      const mapped = res.data.tables.map((t: any) => ({
        id: t.name,
        name: t.name,
        data: t.metadata.sample,
        metadata: t.metadata
      }));
      setDatasets(mapped);
      if (mapped.length > 0 && !selectedDatasetId) {
        setSelectedDatasetId(mapped[0].id);
      }
    } catch (err) {
      console.error("Failed to fetch tables", err);
    }
  };

  React.useEffect(() => {
    fetchTables();
  }, []);

  React.useEffect(() => {
    if (datasets.length > 0) {
      if (!selectedDatasetId || !datasets.some(d => d.id === selectedDatasetId)) {
        setSelectedDatasetId(datasets[0].id);
      }
    } else if (selectedDatasetId) {
      setSelectedDatasetId("");
    }
  }, [datasets, selectedDatasetId]);

  const addDataset = (dataset: Dataset) => {
    setDatasets((prev) => {
      const exists = prev.findIndex(d => d.id === dataset.id);
      if (exists !== -1) {
        const next = [...prev];
        next[exists] = dataset;
        return next;
      }
      return [...prev, dataset];
    });
    if (!selectedDatasetId) {
      setSelectedDatasetId(dataset.id);
    }
  };

  const renderTab = () => {
    switch (activeTab) {
      case "home":
        return <TabHome 
          setActiveTab={(tab) => {
            setHistory(prev => [{
              id: Date.now().toString(),
              tab: activeTab, // Correctly use current tab as source
              action: `Switched to ${tab}`,
              timestamp: Date.now()
            } as AppHistoryItem, ...prev].slice(0, 10));
            setActiveTab(tab);
          }} 
          history={history} 
          savedWork={savedWork} 
        />;
      case "settings":
        return <TabSettings settings={settings} setSettings={setSettings} />;
      case "sql":
        return <TabSqlRunner 
          datasets={datasets} 
          onDatasetAdded={addDataset} 
          onRefresh={fetchTables}
          selectedDatasetId={selectedDatasetId}
          setSelectedDatasetId={setSelectedDatasetId}
          setActiveTab={setActiveTab}
          initialQuery={initialSqlQuery} 
          onClearInitialQuery={() => setInitialSqlQuery("")} 
        />;
      case "scraper":
        return <TabWebScraper onDatasetAdded={addDataset} onRefresh={fetchTables} />;
      case "analyzer":
        return <TabAiAnalyzer 
          datasets={datasets} 
          selectedDatasetId={selectedDatasetId} 
          setSelectedDatasetId={setSelectedDatasetId} 
          onRefresh={fetchTables} 
          setActiveTab={setActiveTab}
          onDatasetAdded={addDataset}
          onAnalysisComplete={(report) => setAnalysisReport(report)}
          onTransferSql={(sql) => {
            setInitialSqlQuery(sql);
            setActiveTab("sql");
          }}
        />;
      case "dashboard":
        return <TabDashboardBuilder 
          datasets={datasets} 
          selectedDatasetId={selectedDatasetId} 
          setSelectedDatasetId={setSelectedDatasetId} 
          onRefresh={fetchTables}
          onDatasetAdded={addDataset}
          analysisReport={analysisReport}
        />;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC]">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="flex-1 overflow-auto bg-white shadow-sm m-4 rounded-xl border border-slate-200">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="h-full p-8"
          >
            {renderTab()}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

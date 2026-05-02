export interface TableMetadata {
  name: string;
  columns: string[];
  rowCount: number;
  sample: any[];
  stats?: Record<string, { missing: number; type: string }>;
}

export interface Dataset {
  id: string;
  name: string;
  data: any[];
  metadata: TableMetadata;
}

export interface ChartConfig {
  id: string;
  type: "bar" | "line" | "pie" | "scatter" | "area" | "radar";
  title: string;
  xKey: string;
  yKey: string;
  color: string;
}

export interface DashboardConfig {
  title?: string;
  summary?: string;
  kpis: { label: string; value: string; change: string; trend: "up" | "down" }[];
  charts: ChartConfig[];
  layout: string;
}

export type Tab = "home" | "sql" | "scraper" | "analyzer" | "dashboard" | "settings";

export interface AppSettings {
  engine: "python" | "r";
  developerMode: boolean;
  dbConnectionString: string;
  storageType: "cache" | "permanent";
  autoCleanup: boolean;
  model: "gemini-1.5-pro" | "gemini-1.5-flash";
  temperature: number;
  theme: "cyberpunk" | "light" | "contrast";
  layout: "side-by-side" | "stacked";
  exportFormat: "pdf" | "excel" | "markdown";
}

export interface AppHistoryItem {
  id: string;
  tab: Tab;
  action: string;
  timestamp: number;
}

export interface SavedWorkItem {
  id: string;
  type: "query" | "dashboard" | "report";
  name: string;
  timestamp: number;
}

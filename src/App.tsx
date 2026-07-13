import React, { useState, useEffect, useMemo } from "react";
import { LayoutDashboard, Sparkles, BarChart3, HelpCircle, FileText, AlertCircle, ShoppingBag, Database, ArrowRight } from "lucide-react";
import UploadZone from "./components/UploadZone";
import FilterPanel from "./components/FilterPanel";
import KPICards from "./components/KPICards";
import ChartPanel from "./components/ChartPanel";
import InsightPanel from "./components/InsightPanel";
import DatabaseTable from "./components/DatabaseTable";
import { FilterState, KPIStats, RetailRecord } from "./types";

export default function App() {
  const [data, setData] = useState<RetailRecord[]>([]);
  const [customDatasetName, setCustomDatasetName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [filters, setFilters] = useState<FilterState>({
    week: [],
    region: [],
    store: [],
    city: [],
    storeFormat: [],
    category: []
  });

  // Tab state: "overview" | "charts" | "ledger" | "sources"
  const [activeTab, setActiveTab] = useState<"overview" | "charts" | "ledger" | "sources">("overview");

  // Load from localStorage or fetch demo data on mount
  useEffect(() => {
    const loadDataOnMount = async () => {
      setLoading(true);
      setError(null);

      // Check for user-uploaded data in local storage
      const storedData = localStorage.getItem("aura_retail_data");
      const storedName = localStorage.getItem("aura_retail_dataset_name");

      if (storedData) {
        try {
          const parsed = JSON.parse(storedData);
          if (Array.isArray(parsed) && parsed.length > 0) {
            console.log("Restoring active user-uploaded dataset:", storedName);
            setData(parsed);
            setCustomDatasetName(storedName || "User Uploaded Dataset");
            setLoading(false);
            return;
          }
        } catch (e) {
          console.error("Failed to parse stored retail data from localStorage. Clearing stale entries...", e);
          localStorage.removeItem("aura_retail_data");
          localStorage.removeItem("aura_retail_dataset_name");
        }
      }

      // Fallback to fetch demo data
      try {
        const response = await fetch("/api/sample-data");
        const result = await response.json();
        if (result.success) {
          setData(result.data);
          setCustomDatasetName(null);
        } else {
          setError(result.error || "Failed to load mock retail database.");
        }
      } catch (err: any) {
        setError("Error connecting to retail server. Verify the container state.");
      } finally {
        setLoading(false);
      }
    };
    loadDataOnMount();
  }, []);

  // Reset local storage back to standard demo dataset
  const handleResetToDemo = async () => {
    setLoading(true);
    setError(null);
    localStorage.removeItem("aura_retail_data");
    localStorage.removeItem("aura_retail_dataset_name");
    setCustomDatasetName(null);
    setFilters({
      week: [],
      region: [],
      store: [],
      city: [],
      storeFormat: [],
      category: []
    });
    try {
      const response = await fetch("/api/sample-data");
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      } else {
        setError("Failed to reload demo retail database.");
      }
    } catch (e) {
      setError("Error reloading demo retail database.");
    } finally {
      setLoading(false);
    }
  };

  // Compute filtered dataset
  const filteredData = useMemo(() => {
    return data.filter(r => {
      if (filters.week.length > 0 && !filters.week.includes(r.week)) return false;
      if (filters.region.length > 0 && !filters.region.includes(r.region)) return false;
      if (filters.store.length > 0 && !filters.store.includes(r.store)) return false;
      if (filters.city.length > 0 && !filters.city.includes(r.city)) return false;
      if (filters.storeFormat.length > 0 && !filters.storeFormat.includes(r.storeFormat)) return false;
      if (filters.category.length > 0 && !filters.category.includes(r.category)) return false;
      return true;
    });
  }, [data, filters]);

  // Compute KPI Statistics from the filtered data
  const stats = useMemo((): KPIStats => {
    if (filteredData.length === 0) {
      return {
        netSales: 0,
        grossSales: 0,
        discountAmount: 0,
        returnAmount: 0,
        targetSales: 0,
        targetAchievement: 0,
        averageTransactionValue: 0,
        returnRate: 0,
        discountRate: 0,
        transactionCount: 0
      };
    }

    const grossSales = filteredData.reduce((sum, r) => sum + r.grossSales, 0);
    const discountAmount = filteredData.reduce((sum, r) => sum + r.discountAmount, 0);
    const returnAmount = filteredData.reduce((sum, r) => sum + r.returnAmount, 0);
    const netSales = filteredData.reduce((sum, r) => sum + r.netSales, 0);
    const targetSales = filteredData.reduce((sum, r) => sum + r.targetSales, 0);

    const targetAchievement = targetSales > 0 ? (netSales / targetSales) * 100 : 100;
    const averageTransactionValue = filteredData.length > 0 ? netSales / filteredData.length : 0;
    const returnRate = netSales > 0 ? (returnAmount / netSales) * 100 : 0;
    const discountRate = grossSales > 0 ? (discountAmount / grossSales) * 100 : 0;

    return {
      netSales,
      grossSales,
      discountAmount,
      returnAmount,
      targetSales,
      targetAchievement,
      averageTransactionValue,
      returnRate,
      discountRate,
      transactionCount: filteredData.length
    };
  }, [filteredData]);

  // Compute if dataset contains Indian stores for native regional currency and number formatting
  const isIndianDataset = useMemo(() => {
    const indianKeywords = [
      "mumbai", "delhi", "bangalore", "bengaluru", "chennai", "kolkata", "hyderabad", "pune", "ahmedabad", 
      "jaipur", "lucknow", "chandigarh", "kochi", "patna", "bhopal", "indore", "surat", "nagpur", "coimbatore",
      "visakhapatnam", "trivandrum", "bhubaneswar", "guwahati", "goa", "noida", "gurugram", "india"
    ];
    return data.some(r => {
      const cityLower = (r.city || "").toLowerCase();
      const regionLower = (r.region || "").toLowerCase();
      const storeLower = (r.store || "").toLowerCase();
      return indianKeywords.some(keyword => 
        cityLower.includes(keyword) || regionLower.includes(keyword) || storeLower.includes(keyword)
      );
    });
  }, [data]);

  const handleDataLoaded = (loadedData: RetailRecord[], filename?: string) => {
    setData(loadedData);
    if (filename) {
      setCustomDatasetName(filename);
      try {
        localStorage.setItem("aura_retail_data", JSON.stringify(loadedData));
        localStorage.setItem("aura_retail_dataset_name", filename);
      } catch (e) {
        console.warn("Could not save dataset to localStorage (might exceed quota limit):", e);
      }
    } else {
      setCustomDatasetName(null);
      localStorage.removeItem("aura_retail_data");
      localStorage.removeItem("aura_retail_dataset_name");
    }
    
    // Reset filters on fresh file upload to prevent lockouts
    setFilters({
      week: [],
      region: [],
      store: [],
      city: [],
      storeFormat: [],
      category: []
    });
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans text-slate-900" id="app-root-container">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-600 rounded text-white shadow-xs">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-xs font-bold text-slate-800 tracking-tight flex items-center gap-1.5 uppercase">
                Aura Retail Analytics
                <span className="text-[9px] bg-emerald-100 text-emerald-700 border border-emerald-200 rounded px-1.5 py-0.5 font-bold uppercase tracking-wider">
                  Live
                </span>
              </h1>
              <p className="text-[10px] text-slate-400 font-medium">
                Strategic KPI Cockpit & Decision Synthesizer
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {customDatasetName ? (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded font-semibold flex items-center gap-1.5 shadow-2xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block"></span>
                  Active Data: <span className="font-bold max-w-[150px] truncate">{customDatasetName}</span>
                </span>
                <button
                  onClick={handleResetToDemo}
                  className="text-[9px] font-bold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded px-2 py-1 transition-colors cursor-pointer uppercase tracking-tight"
                  title="Clear uploaded files and reload original demo database"
                >
                  Reset to Demo
                </button>
              </div>
            ) : (
              <span className="text-[10px] text-slate-500 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded font-semibold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block"></span>
                Active Data: <span className="font-bold">Demo Retail Database</span>
              </span>
            )}

            <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-slate-500 font-semibold bg-slate-50 px-2.5 py-1 rounded border border-slate-200">
              {data.length > 0 ? `${data.length} Records` : "Awaiting Data"}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Stage */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 w-full space-y-4">
        {error && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded flex items-start gap-3 shadow-xs">
            <AlertCircle className="w-4.5 h-4.5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-rose-900">Upload Processing Blocked</h4>
              <p className="text-[11px] text-rose-700 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Upload and File Source zone - rendered when no data loaded */}
        {data.length === 0 && (
          <UploadZone
            onDataLoaded={handleDataLoaded}
            onLoading={setLoading}
            onError={setError}
          />
        )}

        {loading && data.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-8 h-8 border-3 border-blue-500/20 border-t-blue-600 rounded-full animate-spin"></div>
            <p className="text-xs text-slate-500 font-medium">Loading retail intelligence database...</p>
          </div>
        ) : data.length > 0 ? (
          <div className="space-y-4 animate-fade-in">
            {/* Interactive Filter Panel */}
            <FilterPanel
              data={data}
              filters={filters}
              onFilterChange={setFilters}
            />

            {/* Tactical High-Resolution Tab bar */}
            <div className="bg-white border border-slate-200 rounded p-1.5 flex flex-wrap gap-1.5 shadow-xs" id="dashboard-tab-bar">
              <button
                onClick={() => setActiveTab("overview")}
                className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded transition-all cursor-pointer ${
                  activeTab === "overview"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                }`}
                id="tab-btn-overview"
              >
                <LayoutDashboard className="w-3.5 h-3.5 shrink-0" />
                Strategic Overview
                <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold uppercase tracking-tight ml-1.5 ${
                  activeTab === "overview" ? "bg-blue-500/30 text-white" : "bg-blue-50 text-blue-700"
                }`}>
                  AI Insight
                </span>
              </button>

              <button
                onClick={() => setActiveTab("charts")}
                className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded transition-all cursor-pointer ${
                  activeTab === "charts"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                }`}
                id="tab-btn-charts"
              >
                <BarChart3 className="w-3.5 h-3.5 shrink-0" />
                Performance Charts
              </button>

              <button
                onClick={() => setActiveTab("ledger")}
                className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded transition-all cursor-pointer ${
                  activeTab === "ledger"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                }`}
                id="tab-btn-ledger"
              >
                <Database className="w-3.5 h-3.5 shrink-0" />
                Store Ledger
                <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold uppercase tracking-tight ml-1.5 ${
                  activeTab === "ledger" ? "bg-blue-500/30 text-white" : "bg-emerald-50 text-emerald-700"
                }`}>
                  {filteredData.length} records
                </span>
              </button>

              <button
                onClick={() => setActiveTab("sources")}
                className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded transition-all cursor-pointer ${
                  activeTab === "sources"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                }`}
                id="tab-btn-sources"
              >
                <FileText className="w-3.5 h-3.5 shrink-0" />
                Data Sources & Joiner
              </button>
            </div>

            {/* Tab Panels with selective display */}
            {filteredData.length === 0 && activeTab !== "sources" ? (
              <div className="bg-white border border-slate-200 rounded p-12 text-center shadow-xs">
                <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                <h4 className="text-xs font-bold text-slate-800 uppercase">No matching records</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  Selected filters returned zero results. Please clear or expand filters.
                </p>
                <button
                  onClick={() => setFilters({ week: [], region: [], store: [], city: [], storeFormat: [], category: [] })}
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded transition-all cursor-pointer"
                >
                  Reset Active Filters
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {activeTab === "overview" && (
                  <div className="space-y-4 animate-fade-in" id="panel-overview">
                    {/* KPI metrics cards row */}
                    <KPICards stats={stats} isIndian={isIndianDataset} />

                    {/* Gemini AI Strategic Insight Panel */}
                    <InsightPanel
                      filteredData={filteredData}
                      stats={stats}
                      activeFilters={filters}
                      isIndian={isIndianDataset}
                    />
                  </div>
                )}

                {activeTab === "charts" && (
                  <div className="animate-fade-in" id="panel-charts">
                    {/* Rich Recharts Panel */}
                    <ChartPanel filteredData={filteredData} isIndian={isIndianDataset} />
                  </div>
                )}

                {activeTab === "ledger" && (
                  <div className="animate-fade-in" id="panel-ledger">
                    {/* Joined database ledger view */}
                    <DatabaseTable data={filteredData} isIndian={isIndianDataset} />
                  </div>
                )}

                {activeTab === "sources" && (
                  <div className="space-y-4 animate-fade-in" id="panel-sources">
                    {/* Upload and File Source zone - rendered in sources tab */}
                    <UploadZone
                      onDataLoaded={handleDataLoaded}
                      onLoading={setLoading}
                      onError={setError}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Landing State Empty View */
          <div className="bg-white border border-slate-200 rounded p-10 text-center max-w-lg mx-auto shadow-xs space-y-5">
            <div className="mx-auto w-12 h-12 rounded bg-blue-50 flex items-center justify-center text-blue-600 shadow-sm">
              <LayoutDashboard className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-sm font-bold text-slate-800 tracking-tight uppercase">
                Analyze Retail Performance
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Connect your business spreadsheets or explore using our built-in high-fidelity retail database to instantly visualize weekly trends, target achievements, stockout alerts, and return metrics.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
              <button
                onClick={async () => {
                  setLoading(true);
                  try {
                    const response = await fetch("/api/sample-data");
                    const result = await response.json();
                    if (result.success) setData(result.data);
                  } catch (e) {
                    setError("Failed to connect to retail server.");
                  } finally {
                    setLoading(false);
                  }
                }}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded transition-all shadow-xs cursor-pointer"
              >
                <Database className="w-3.5 h-3.5" />
                Explore Demo Cockpit
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4 text-[10px] text-slate-400 font-medium">
          <p>© 2026 Aura Retail Analytics. High-Density Tactical Console.</p>
          <div className="flex items-center gap-3">
            <span>Powered by Gemini 3.5 Flash</span>
            <span className="text-slate-200">|</span>
            <span>Platform Server Active</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

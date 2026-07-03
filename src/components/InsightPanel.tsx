import React, { useState, useEffect } from "react";
import { Sparkles, RefreshCw, AlertTriangle, CheckCircle, ArrowUpRight, ArrowDownRight, Package, ClipboardList, Lightbulb } from "lucide-react";
import { BusinessInsights, FilterState, KPIStats, RetailRecord } from "../types";

interface InsightPanelProps {
  filteredData: RetailRecord[];
  stats: KPIStats;
  activeFilters: FilterState;
}

export default function InsightPanel({ filteredData, stats, activeFilters }: InsightPanelProps) {
  const [insights, setInsights] = useState<BusinessInsights | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState<string>("");

  // Simple custom Markdown formatter to render bold, list, and headings with elegant Tailwind style
  const renderMarkdown = (text: string) => {
    if (!text) return null;
    
    const lines = text.split("\n");
    return lines.map((line, idx) => {
      let trimmed = line.trim();
      if (!trimmed) return <div key={idx} className="h-2" />;

      // Match headings e.g. ### Heading
      if (trimmed.startsWith("###")) {
        return (
          <h4 key={idx} className="text-xs font-bold text-gray-800 uppercase tracking-wider mt-4 mb-2 flex items-center gap-1.5">
            <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
            {trimmed.replace(/^###\s*/, "")}
          </h4>
        );
      }
      if (trimmed.startsWith("##")) {
        return (
          <h3 key={idx} className="text-sm font-bold text-gray-900 mt-4 mb-2">
            {trimmed.replace(/^##\s*/, "")}
          </h3>
        );
      }

      // Match bullet points e.g. - list item or * list item
      if (trimmed.startsWith("-") || trimmed.startsWith("*")) {
        const itemContent = trimmed.replace(/^[-*]\s*/, "");
        return (
          <li key={idx} className="text-xs text-gray-600 ml-4 list-disc pl-1 mb-1 leading-relaxed">
            {parseInlineBolding(itemContent)}
          </li>
        );
      }

      // Standard paragraph
      return (
        <p key={idx} className="text-xs text-gray-600 leading-relaxed mb-3">
          {parseInlineBolding(trimmed)}
        </p>
      );
    });
  };

  const parseInlineBolding = (text: string) => {
    const parts = text.split(/\*\*([^*]+)\*\*/g);
    if (parts.length === 1) return text;
    return parts.map((part, i) => (i % 2 === 1 ? <strong key={i} className="font-bold text-slate-100">{part}</strong> : part));
  };

  // Rule-based heuristic insight engine (fallback & instant loader)
  const generateHeuristicInsights = (): BusinessInsights => {
    // 1. Regions
    const regionSales: Record<string, number> = {};
    filteredData.forEach(r => {
      regionSales[r.region] = (regionSales[r.region] || 0) + r.netSales;
    });
    
    let bestReg = { name: "N/A", sales: 0 };
    let worstReg = { name: "N/A", sales: Infinity };
    
    Object.entries(regionSales).forEach(([name, sales]) => {
      if (sales > bestReg.sales) bestReg = { name, sales };
      if (sales < worstReg.sales) worstReg = { name, sales };
    });
    if (worstReg.sales === Infinity) worstReg = { name: "N/A", sales: 0 };

    // 2. Missing target
    const storeTargetDeficit: Record<string, { sales: number; target: number }> = {};
    filteredData.forEach(r => {
      if (!storeTargetDeficit[r.store]) storeTargetDeficit[r.store] = { sales: 0, target: 0 };
      storeTargetDeficit[r.store].sales += r.netSales;
      storeTargetDeficit[r.store].target += r.targetSales;
    });

    const storesMissingTarget = Object.entries(storeTargetDeficit)
      .map(([store, val]) => {
        const deficit = val.target - val.sales;
        const achievement = val.target > 0 ? (val.sales / val.target) * 100 : 100;
        return { store, sales: val.sales, target: val.target, deficit, achievement };
      })
      .filter(item => item.deficit > 0)
      .sort((a, b) => b.deficit - a.deficit)
      .slice(0, 3);

    // 3. High returns
    const categoryReturns: Record<string, { returns: number; sales: number }> = {};
    filteredData.forEach(r => {
      if (!categoryReturns[r.category]) categoryReturns[r.category] = { returns: 0, sales: 0 };
      categoryReturns[r.category].returns += r.returnAmount;
      categoryReturns[r.category].sales += r.netSales;
    });

    const highReturnCategories = Object.entries(categoryReturns)
      .map(([category, val]) => {
        const returnRate = val.sales > 0 ? (val.returns / val.sales) * 100 : 0;
        return { category, returnAmount: val.returns, returnRate };
      })
      .sort((a, b) => b.returnRate - a.returnRate)
      .slice(0, 3);

    // 4. Stockout risk
    const stockoutRiskItems = filteredData
      .filter(r => r.stockLevel <= r.reorderPoint)
      .map(r => ({
        category: r.category,
        store: r.store,
        stockLevel: r.stockLevel,
        reorderPoint: r.reorderPoint
      }))
      .slice(0, 3);

    // Dynamic executive summary paragraphs based on data
    const activeFilterNames = Object.entries(activeFilters)
      .filter(([_, val]) => val.length > 0)
      .map(([key, _]) => key)
      .join(", ");
    
    const filterContext = activeFilterNames ? `with active filters applied for ${activeFilterNames}` : "across all operating regions";
    
    const achievementDesc = stats.targetAchievement >= 100 
      ? `exceeded aggregate sales goals at **${stats.targetAchievement.toFixed(1)}%** achievement` 
      : `reached **${stats.targetAchievement.toFixed(1)}%** of the targeted target sales, indicating a deficit of **${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(stats.targetSales - stats.netSales)}**`;

    const executiveSummary = `
      ### Business Health Analysis
      The retail segment has generated total Net Sales of **${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(stats.netSales)}** ${filterContext}. Performance analysis shows that we have ${achievementDesc}. The Average Transaction Value (ATV) is stabilizing at **${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(stats.averageTransactionValue)}** per basket.
      
      ### Operational Hotspots
      The **${bestReg.name}** region is leading performance with **${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(bestReg.sales)}** in net sales. However, return burdens require active mitigation, specifically in categories like **${highReturnCategories[0]?.category || "Apparel"}** which exhibits return Rates of **${highReturnCategories[0]?.returnRate.toFixed(1) || 0}%**.
    `;

    const actionItems = [
      `Initiate inventory audits at **${stockoutRiskItems[0]?.store || "key outlets"}** where **${stockoutRiskItems[0]?.category || "critical inventory"}** has fallen below reorder levels.`,
      `Review discounting thresholds for lower-performing categories to protect the overall net margin.`,
      `Engage store leads at **${storesMissingTarget[0]?.store || "high-deficit stores"}** to formulate local promotions to address the target sales shortfall.`,
      `Address product returns in the **${highReturnCategories[0]?.category || "Apparel"}** category by investigating supplier material quality.`,
    ];

    return {
      bestRegion: bestReg,
      worstRegion: worstReg,
      storesMissingTarget,
      highReturnCategories,
      stockoutRiskItems,
      executiveSummary,
      actionItems
    };
  };

  const fetchAiInsights = async () => {
    if (filteredData.length === 0) return;
    setLoading(true);
    setError(null);
    setLoadingStep("Extracting retail metrics...");

    try {
      setTimeout(() => setLoadingStep("Running KPI correlations..."), 800);
      setTimeout(() => setLoadingStep("Evaluating regional targets..."), 1500);
      setTimeout(() => setLoadingStep("Drafting executive action items..."), 2200);

      const response = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kpi: stats,
          filteredData: filteredData.slice(0, 350), // prevent payload bloating
          activeFilters
        })
      });

      const result = await response.json();
      if (result.success && result.insights) {
        setInsights(result.insights);
      } else {
        // Handle gracefully, load fallback heuristic insights
        const fallback = generateHeuristicInsights();
        setInsights(fallback);
        setError("Note: Running on instant-on heuristics. Configure GEMINI_API_KEY in Settings > Secrets for full executive analysis.");
      }
    } catch (err: any) {
      console.warn("AI generation error, using heuristics:", err);
      const fallback = generateHeuristicInsights();
      setInsights(fallback);
      setError("Note: Running on offline-mode business logic. Connect server to enable live Gemini AI summaries.");
    } finally {
      setLoading(false);
      setLoadingStep("");
    }
  };

  // Generate initial insights on data load
  useEffect(() => {
    if (filteredData.length > 0) {
      // Create initial local rule insights instantly to avoid empty screen
      const localInsights = generateHeuristicInsights();
      setInsights(localInsights);
      
      // Proactively trigger Live Gemini API (this is excellent UX)
      fetchAiInsights();
    }
  }, [filteredData]);

  if (filteredData.length === 0) {
    return null;
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0
    }).format(val);
  };

  return (
    <div className="bg-slate-900 rounded p-4 text-white shadow-md border border-slate-800" id="insight-panel-container">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-gradient-to-tr from-blue-500 to-indigo-600 rounded text-white shadow-xs">
            <Sparkles className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h3 className="text-xs font-bold tracking-tight uppercase">AI & Strategic Business Summaries</h3>
            <p className="text-[10px] text-slate-400 font-medium">
              Real-time performance diagnosis and operation recommendations
            </p>
          </div>
        </div>

        <button
          onClick={fetchAiInsights}
          disabled={loading}
          className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-800/50 text-slate-200 disabled:text-slate-400 font-semibold text-[10px] rounded border border-slate-700/60 cursor-pointer uppercase tracking-tight"
          id="btn-regenerate-insights"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin text-blue-400" : ""}`} />
          {loading ? "Analyzing..." : "Re-Analyze Dataset"}
        </button>
      </div>

      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-full border-3 border-blue-500/20 border-t-blue-500 animate-spin"></div>
            <Sparkles className="w-4 h-4 text-blue-400 absolute inset-0 m-auto animate-pulse" />
          </div>
          <div className="space-y-0.5">
            <p className="text-[10px] font-bold text-slate-200 uppercase tracking-widest animate-pulse">
              {loadingStep || "Consulting Gemini AI..."}
            </p>
            <p className="text-[9px] text-slate-400">
              Aggregating active filters & modeling business recommendations
            </p>
          </div>
        </div>
      ) : (
        <>
          {error && (
            <div className="mb-3 p-2.5 bg-blue-950/40 border border-blue-900/60 rounded flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
              <p className="text-[10px] text-blue-200 leading-snug">
                {error}
              </p>
            </div>
          )}

          {insights && (
            <div className="space-y-4">
              {/* Top Row Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                {/* Best Region */}
                <div className="bg-slate-950/60 border border-slate-800 rounded p-3 flex items-center justify-between">
                  <div>
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5">
                      Leading Territory
                    </span>
                    <h4 className="text-sm font-extrabold text-slate-100">{insights.bestRegion.name}</h4>
                    <span className="text-[10px] text-emerald-400 font-semibold mt-0.5 block">
                      {formatCurrency(insights.bestRegion.sales)} Net
                    </span>
                  </div>
                  <div className="p-1.5 bg-emerald-950/40 border border-emerald-900/40 text-emerald-400 rounded">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                </div>

                {/* Worst Region */}
                <div className="bg-slate-950/60 border border-slate-800 rounded p-3 flex items-center justify-between">
                  <div>
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5">
                      Trailing Territory
                    </span>
                    <h4 className="text-sm font-extrabold text-slate-100">{insights.worstRegion.name}</h4>
                    <span className="text-[10px] text-rose-400 font-semibold mt-0.5 block">
                      {formatCurrency(insights.worstRegion.sales)} Net
                    </span>
                  </div>
                  <div className="p-1.5 bg-rose-950/40 border border-rose-900/40 text-rose-400 rounded">
                    <ArrowDownRight className="w-4 h-4" />
                  </div>
                </div>

                {/* Return burden */}
                <div className="bg-slate-950/60 border border-slate-800 rounded p-3 flex items-center justify-between">
                  <div>
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5">
                      Return Exposure
                    </span>
                    <h4 className="text-xs font-extrabold text-slate-100 truncate max-w-[120px]">
                      {insights.highReturnCategories[0]?.category || "N/A"}
                    </h4>
                    <span className="text-[10px] text-amber-400 font-semibold mt-0.5 block">
                      {insights.highReturnCategories[0]?.returnRate.toFixed(1) || 0}% Return Rate
                    </span>
                  </div>
                  <div className="p-1.5 bg-amber-950/40 border border-amber-900/40 text-amber-400 rounded">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                </div>

                {/* Stockout warning count */}
                <div className="bg-slate-950/60 border border-slate-800 rounded p-3 flex items-center justify-between">
                  <div>
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5">
                      Low Inventory Risk
                    </span>
                    <h4 className="text-sm font-extrabold text-slate-100">
                      {insights.stockoutRiskItems.length} Categories
                    </h4>
                    <span className="text-[10px] text-rose-400 font-semibold mt-0.5 block">
                      Below Reorder Point
                    </span>
                  </div>
                  <div className="p-1.5 bg-rose-950/40 border border-rose-900/40 text-rose-400 rounded">
                    <Package className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* Core Content Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-1">
                {/* Executive Summary Markdown */}
                <div className="lg:col-span-2 space-y-2">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <ClipboardList className="w-3.5 h-3.5 text-blue-400" />
                    Executive Business Summary
                  </h4>
                  <div className="bg-slate-950/30 border border-slate-800/40 rounded p-4 space-y-1.5">
                    {renderMarkdown(insights.executiveSummary)}
                  </div>
                </div>

                {/* Side Performance Tables */}
                <div className="space-y-4">
                  {/* Stores Missing Target */}
                  <div className="space-y-1.5">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                      Target Deficits (Top missing)
                    </h4>
                    <div className="bg-slate-950/40 border border-slate-800/60 rounded p-3 space-y-2">
                      {insights.storesMissingTarget.length === 0 ? (
                        <p className="text-[10px] text-slate-400 text-center py-3">All stores achieved target!</p>
                      ) : (
                        insights.storesMissingTarget.map((item, index) => (
                          <div key={index} className="flex flex-col gap-1 border-b border-slate-800/40 pb-1.5 last:border-0 last:pb-0">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-slate-200 truncate max-w-[120px]">{item.store}</span>
                              <span className="text-[9px] bg-amber-950/40 border border-amber-900/30 text-amber-400 px-1 py-0.5 rounded">
                                -{formatCurrency(item.deficit)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[9px] text-slate-400">
                              <span>Sales: {formatCurrency(item.sales)}</span>
                              <span className="font-medium text-slate-300">{item.achievement.toFixed(0)}% achv</span>
                            </div>
                            <div className="w-full bg-slate-900 rounded h-1 mt-0.5 overflow-hidden">
                              <div className="bg-amber-500 h-full rounded" style={{ width: `${Math.min(item.achievement, 100)}%` }} />
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* High Return Categories */}
                  <div className="space-y-1.5">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5 text-rose-500" />
                      Return Rates by Category
                    </h4>
                    <div className="bg-slate-950/40 border border-slate-800/60 rounded p-3 space-y-2">
                      {insights.highReturnCategories.length === 0 ? (
                        <p className="text-[10px] text-slate-400 text-center py-3">No product returns.</p>
                      ) : (
                        insights.highReturnCategories.map((item, index) => (
                          <div key={index} className="flex items-center justify-between text-xs border-b border-slate-800/40 pb-1.5 last:border-0 last:pb-0">
                            <div>
                              <span className="font-semibold text-slate-200 block truncate max-w-[120px]">{item.category}</span>
                              <span className="text-[9px] text-slate-400">Ret: {formatCurrency(item.returnAmount)}</span>
                            </div>
                            <div className="text-right">
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                item.returnRate > 12 
                                  ? "bg-rose-950/40 text-rose-400 border border-rose-900/30" 
                                  : "bg-amber-950/40 text-amber-400 border border-amber-900/30"
                              }`}>
                                {item.returnRate.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action items checklist */}
              <div className="space-y-2 pt-3 border-t border-slate-800/60">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <ClipboardList className="w-4 h-4 text-emerald-400" />
                  Recommended Operational Action Items
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {insights.actionItems.map((item, index) => (
                    <div key={index} className="flex items-start gap-2 bg-slate-950/40 border border-slate-800 hover:border-slate-700 rounded p-2.5 transition-colors">
                      <div className="mt-0.5 p-0.5 bg-emerald-950/50 border border-emerald-900/40 text-emerald-400 rounded">
                        <CheckCircle className="w-3.5 h-3.5" />
                      </div>
                      <p className="text-[11px] text-slate-200 leading-normal font-medium">
                        {item}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

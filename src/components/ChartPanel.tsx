import React from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  BarChart,
  ReferenceLine
} from "recharts";
import { AlertTriangle, TrendingUp, BarChart3, PieChartIcon, ShieldAlert } from "lucide-react";
import { RetailRecord } from "../types";

interface ChartPanelProps {
  filteredData: RetailRecord[];
  isIndian?: boolean;
}

export default function ChartPanel({ filteredData, isIndian }: ChartPanelProps) {
  // 1. Weekly Trend (Weekly Net Sales vs Targets)
  const getWeeklyTrend = () => {
    const weeklyMap: Record<string, { week: string; Sales: number; Target: number }> = {};
    filteredData.forEach(r => {
      if (!weeklyMap[r.week]) {
        weeklyMap[r.week] = { week: r.week, Sales: 0, Target: 0 };
      }
      weeklyMap[r.week].Sales += r.netSales;
      weeklyMap[r.week].Target += r.targetSales;
    });
    return Object.values(weeklyMap).sort((a, b) => a.week.localeCompare(b.week));
  };

  // 2. Sales by Region
  const getRegionSales = () => {
    const regionMap: Record<string, number> = {};
    filteredData.forEach(r => {
      regionMap[r.region] = (regionMap[r.region] || 0) + r.netSales;
    });
    return Object.entries(regionMap).map(([name, value]) => ({ name, value }));
  };

  // 3. Category Performance (Gross Sales, Net Sales, Return Amount)
  const getCategoryPerformance = () => {
    const catMap: Record<string, { name: string; Gross: number; Net: number; Returns: number }> = {};
    filteredData.forEach(r => {
      if (!catMap[r.category]) {
        catMap[r.category] = { name: r.category, Gross: 0, Net: 0, Returns: 0 };
      }
      catMap[r.category].Gross += r.grossSales;
      catMap[r.category].Net += r.netSales;
      catMap[r.category].Returns += r.returnAmount;
    });
    return Object.values(catMap);
  };

  // 4. Store Leaderboard
  const getStoreLeaderboard = () => {
    const storeMap: Record<string, { name: string; Sales: number; Target: number }> = {};
    filteredData.forEach(r => {
      if (!storeMap[r.store]) {
        storeMap[r.store] = { name: r.store, Sales: 0, Target: 0 };
      }
      storeMap[r.store].Sales += r.netSales;
      storeMap[r.store].Target += r.targetSales;
    });
    return Object.values(storeMap)
      .sort((a, b) => b.Sales - a.Sales)
      .slice(0, 8); // top 8 stores
  };

  // 5. Stockout Risk by Category
  const getStockoutRisk = () => {
    const riskMap: Record<string, { name: string; riskCount: number; criticalCount: number }> = {};
    filteredData.forEach(r => {
      if (!riskMap[r.category]) {
        riskMap[r.category] = { name: r.category, riskCount: 0, criticalCount: 0 };
      }
      if (r.stockLevel <= r.reorderPoint) {
        riskMap[r.category].riskCount += 1;
        if (r.stockLevel <= 2) {
          riskMap[r.category].criticalCount += 1;
        }
      }
    });
    return Object.values(riskMap).filter(item => item.riskCount > 0);
  };

  const formatCurrencyLabel = (value: number) => {
    if (isIndian) {
      if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
      if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
      if (value >= 1000) return `₹${(value / 1000).toFixed(0)}k`;
      return `₹${value}`;
    }
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`;
    return `$${value}`;
  };

  const customTooltipFormatter = (value: any) => {
    if (typeof value === "number") {
      return [
        new Intl.NumberFormat(isIndian ? "en-IN" : "en-US", {
          style: "currency",
          currency: isIndian ? "INR" : "USD",
          maximumFractionDigits: 0
        }).format(value),
        undefined
      ];
    }
    return [value, undefined];
  };

  const weeklyTrendData = getWeeklyTrend();
  const regionSalesData = getRegionSales();
  const categoryPerfData = getCategoryPerformance();
  const storeLeaderboardData = getStoreLeaderboard();
  const stockoutRiskData = getStockoutRisk();

  // Premium colors
  const COLORS_REGION = ["#0d9488", "#4f46e5", "#0ea5e9", "#f59e0b", "#ec4899", "#8b5cf6"];
  const COLORS_RISK = ["#f43f5e", "#fb7185", "#fda4af"];

  return (
    <div className="space-y-3.5">
      {/* Row 1: Weekly Trend and Region Sales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        {/* Weekly Trend */}
        <div className="bg-white rounded border border-slate-200 p-3.5 shadow-xs" id="chart-weekly-trend">
          <div className="flex items-center gap-1.5 mb-2.5">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-tight">Weekly Performance Trend</h3>
          </div>
          <div className="h-[230px] w-full text-[10px]">
            {weeklyTrendData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400">No data available</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={weeklyTrendData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="week" stroke="#94a3b8" fontSize={9} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} axisLine={false} tickFormatter={formatCurrencyLabel} />
                  <Tooltip formatter={customTooltipFormatter} contentStyle={{ background: "#ffffff", borderRadius: "4px", border: "1px solid #e2e8f0", fontSize: "11px" }} />
                  <Legend verticalAlign="top" height={28} iconType="circle" iconSize={6} wrapperStyle={{ fontSize: '10px' }} />
                  <Bar dataKey="Sales" fill="#2563eb" radius={[2, 2, 0, 0]} name="Net Sales" maxBarSize={20} />
                  <Line type="monotone" dataKey="Target" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} name="Weekly Target" />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Sales by Region */}
        <div className="bg-white rounded border border-slate-200 p-3.5 shadow-xs" id="chart-sales-region">
          <div className="flex items-center gap-1.5 mb-2.5">
            <PieChartIcon className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-tight">Sales Distribution by Region</h3>
          </div>
          <div className="h-[230px] w-full text-[10px] flex flex-col sm:flex-row items-center justify-center">
            {regionSalesData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400">No data available</div>
            ) : (
              <>
                <div className="w-full sm:w-[50%] h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={regionSalesData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={75}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {regionSalesData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS_REGION[index % COLORS_REGION.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={customTooltipFormatter} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-full sm:w-[50%] flex flex-col gap-1 px-2">
                  {regionSalesData.map((entry, index) => {
                    const total = regionSalesData.reduce((acc, curr) => acc + curr.value, 0);
                    const pct = total > 0 ? (entry.value / total) * 100 : 0;
                    return (
                      <div key={entry.name} className="flex items-center justify-between text-[11px] border-b border-slate-50 pb-1 last:border-0 last:pb-0">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS_REGION[index % COLORS_REGION.length] }}></span>
                          <span className="font-semibold text-slate-600">{entry.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-slate-800">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(entry.value)}</span>
                          <span className="text-[9px] text-slate-400 inline ml-1">({pct.toFixed(0)}%)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Row 2: Category Performance and Store Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        {/* Category Performance */}
        <div className="bg-white rounded border border-slate-200 p-3.5 shadow-xs" id="chart-category-performance">
          <div className="flex items-center gap-1.5 mb-2.5">
            <BarChart3 className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-tight">Category Sales & Return Burden</h3>
          </div>
          <div className="h-[230px] w-full text-[10px]">
            {categoryPerfData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400">No data available</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryPerfData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} axisLine={false} tickFormatter={formatCurrencyLabel} />
                  <Tooltip formatter={customTooltipFormatter} contentStyle={{ background: "#ffffff", borderRadius: "4px", border: "1px solid #e2e8f0" }} />
                  <Legend verticalAlign="top" height={28} iconType="circle" iconSize={6} wrapperStyle={{ fontSize: '10px' }} />
                  <Bar dataKey="Gross" fill="#4f46e5" name="Gross Sales" radius={[2, 2, 0, 0]} maxBarSize={15} />
                  <Bar dataKey="Net" fill="#2563eb" name="Net Sales" radius={[2, 2, 0, 0]} maxBarSize={15} />
                  <Bar dataKey="Returns" fill="#ef4444" name="Return Amount" radius={[2, 2, 0, 0]} maxBarSize={15} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Store Leaderboard */}
        <div className="bg-white rounded border border-slate-200 p-3.5 shadow-xs" id="chart-store-leaderboard">
          <div className="flex items-center gap-1.5 mb-2.5">
            <BarChart3 className="w-4 h-4 text-emerald-600 rotate-90" />
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-tight">Store Performance Leaderboard (Top Sales)</h3>
          </div>
          <div className="h-[230px] w-full text-[10px]">
            {storeLeaderboardData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400">No data available</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={storeLeaderboardData}
                  layout="vertical"
                  margin={{ top: 5, right: 5, bottom: 5, left: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" stroke="#94a3b8" fontSize={9} tickLine={false} axisLine={false} tickFormatter={formatCurrencyLabel} />
                  <YAxis type="category" dataKey="name" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} width={80} />
                  <Tooltip formatter={customTooltipFormatter} />
                  <Legend verticalAlign="top" height={24} iconType="circle" iconSize={6} wrapperStyle={{ fontSize: '10px' }} />
                  <Bar dataKey="Sales" fill="#2563eb" name="Net Sales" radius={[0, 2, 2, 0]} maxBarSize={10} />
                  <Bar dataKey="Target" fill="#cbd5e1" name="Store Target" radius={[0, 2, 2, 0]} maxBarSize={10} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Row 3: Stockout Risk */}
      <div className="bg-white rounded border border-slate-200 p-3.5 shadow-xs" id="chart-stockout-risk">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-tight">Stockout Risk Inventory Alert</h3>
          </div>
          <span className="text-[10px] text-slate-500">
            Quantity of products reaching or falling below their pre-configured Reorder Point.
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          {/* Chart of count */}
          <div className="md:col-span-2 h-[180px] w-full text-[10px]">
            {stockoutRiskData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 bg-emerald-50/20 border border-emerald-100 rounded p-4">
                <div className="text-center space-y-0.5">
                  <span className="inline-block px-2 py-0.5 text-[9px] font-bold bg-emerald-100 text-emerald-800 rounded">All clear</span>
                  <p className="font-semibold text-slate-700">Healthy stock levels throughout all stores!</p>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stockoutRiskData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} axisLine={false} allowDecimals={false} label={{ value: "Low Stock SKU Count", angle: -90, position: "insideLeft", offset: 0, style: { fill: "#94a3b8", fontSize: "9px" } }} />
                  <Tooltip />
                  <Bar dataKey="riskCount" fill="#ef4444" name="Items at Risk" radius={[2, 2, 0, 0]} maxBarSize={20}>
                    {stockoutRiskData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS_RISK[index % COLORS_RISK.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Quick Critical Stock Outbound Items Summary */}
          <div className="bg-rose-50/30 rounded border border-rose-100 p-3 space-y-2">
            <h4 className="text-[10px] font-bold text-rose-800 flex items-center gap-1 uppercase tracking-wider">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
              Critical Stock Outposts
            </h4>
            
            {stockoutRiskData.length === 0 ? (
              <p className="text-[10px] text-emerald-700 font-medium">
                No active stock levels are currently at risk. Safe buffer verified.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-1">
                {filteredData
                  .filter(r => r.stockLevel <= r.reorderPoint)
                  .slice(0, 4)
                  .map((item, index) => {
                    const diff = item.reorderPoint - item.stockLevel;
                    return (
                      <div key={index} className="bg-white border border-rose-100 rounded p-2 flex items-center justify-between gap-1.5">
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-bold text-slate-700 truncate">
                            {item.category}
                          </p>
                          <p className="text-[9px] text-slate-400 truncate">
                            {item.store} ({item.city})
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[9px] font-bold text-rose-600 bg-rose-50 border border-rose-100 px-1 py-0.5 rounded">
                            Qty: {item.stockLevel} (ROP: {item.reorderPoint})
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

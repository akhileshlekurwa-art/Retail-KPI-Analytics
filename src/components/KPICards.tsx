import React from "react";
import { DollarSign, IndianRupee, Percent, TrendingUp, RefreshCw, ShoppingCart, Target } from "lucide-react";
import { KPIStats } from "../types";

interface KPICardsProps {
  stats: KPIStats;
  isIndian?: boolean;
}

export default function KPICards({ stats, isIndian }: KPICardsProps) {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat(isIndian ? "en-IN" : "en-US", {
      style: "currency",
      currency: isIndian ? "INR" : "USD",
      maximumFractionDigits: 0
    }).format(val);
  };

  const formatPercentage = (val: number) => {
    return `${val.toFixed(1)}%`;
  };

  const cards = [
    {
      title: "Net Sales",
      value: formatCurrency(stats.netSales),
      subtitle: `Gross: ${formatCurrency(stats.grossSales)}`,
      icon: isIndian ? IndianRupee : DollarSign,
      color: "blue",
      badge: "Total Revenue"
    },
    {
      title: "Target Achv.",
      value: formatPercentage(stats.targetAchievement),
      subtitle: `Target: ${formatCurrency(stats.targetSales)}`,
      icon: Target,
      color: stats.targetAchievement >= 100 ? "emerald" : stats.targetAchievement >= 85 ? "blue" : "amber",
      badge: stats.targetAchievement >= 100 ? "Exceeded" : stats.targetAchievement >= 85 ? "On Track" : "Below Target"
    },
    {
      title: "Avg. Trans. Value",
      value: formatCurrency(stats.averageTransactionValue),
      subtitle: `From ${stats.transactionCount} txs`,
      icon: ShoppingCart,
      color: "indigo",
      badge: "ATV / Ticket"
    },
    {
      title: "Return Rate",
      value: formatPercentage(stats.returnRate),
      subtitle: `Returned: ${formatCurrency(stats.returnAmount)}`,
      icon: RefreshCw,
      color: stats.returnRate > 10 ? "rose" : stats.returnRate > 5 ? "amber" : "emerald",
      badge: stats.returnRate > 10 ? "Action Required" : "Healthy"
    },
    {
      title: "Discount Rate",
      value: formatPercentage(stats.discountRate),
      subtitle: `Discounts: ${formatCurrency(stats.discountAmount)}`,
      icon: Percent,
      color: stats.discountRate > 15 ? "amber" : "blue",
      badge: "Avg Discount"
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        
        // Define color Tailwind utility maps
        const colorMaps: Record<string, { bg: string; text: string; border: string; iconBg: string; iconText: string; badgeBg: string; badgeText: string }> = {
          emerald: {
            bg: "bg-emerald-50/20",
            text: "text-emerald-900",
            border: "border-emerald-200",
            iconBg: "bg-emerald-50",
            iconText: "text-emerald-600",
            badgeBg: "bg-emerald-100",
            badgeText: "text-emerald-800"
          },
          blue: {
            bg: "bg-blue-50/20",
            text: "text-blue-900",
            border: "border-slate-200",
            iconBg: "bg-blue-50",
            iconText: "text-blue-600",
            badgeBg: "bg-blue-100/70",
            badgeText: "text-blue-800"
          },
          amber: {
            bg: "bg-amber-50/20",
            text: "text-amber-900",
            border: "border-amber-200",
            iconBg: "bg-amber-50",
            iconText: "text-amber-600",
            badgeBg: "bg-amber-100",
            badgeText: "text-amber-800"
          },
          indigo: {
            bg: "bg-indigo-50/20",
            text: "text-indigo-900",
            border: "border-slate-200",
            iconBg: "bg-indigo-50",
            iconText: "text-indigo-600",
            badgeBg: "bg-indigo-100/70",
            badgeText: "text-indigo-800"
          },
          rose: {
            bg: "bg-rose-50/20",
            text: "text-rose-900",
            border: "border-rose-200",
            iconBg: "bg-rose-50",
            iconText: "text-rose-600",
            badgeBg: "bg-rose-100",
            badgeText: "text-rose-800"
          }
        };

        const colors = colorMaps[card.color] || colorMaps.blue;

        return (
          <div
            key={idx}
            className="bg-white rounded border border-slate-200 p-3.5 shadow-xs flex flex-col justify-between hover:shadow-sm transition-all duration-200"
            id={`kpi-card-${card.title.toLowerCase().replace(/\s+/g, "-")}`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className={`p-1.5 rounded ${colors.iconBg} ${colors.iconText}`}>
                <Icon className="w-4 h-4" />
              </div>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${colors.badgeBg} ${colors.badgeText}`}>
                {card.badge}
              </span>
            </div>

            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                {card.title}
              </p>
              <h4 className="text-lg font-bold text-slate-800 tracking-tight leading-none mb-0.5">
                {card.value}
              </h4>
              <p className="text-[11px] text-slate-500 font-medium">
                {card.subtitle}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

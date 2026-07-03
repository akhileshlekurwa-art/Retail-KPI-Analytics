export interface RetailRecord {
  transactionId: string;
  date: string;
  week: string;
  region: string;
  city: string;
  store: string;
  storeFormat: string;
  category: string;
  grossSales: number;
  discountAmount: number;
  returnAmount: number;
  targetSales: number;
  stockLevel: number;
  reorderPoint: number;
  netSales: number; // calculated: grossSales - discountAmount - returnAmount
}

export interface FilterState {
  week: string[];
  region: string[];
  store: string[];
  city: string[];
  storeFormat: string[];
  category: string[];
}

export interface KPIStats {
  netSales: number;
  grossSales: number;
  discountAmount: number;
  returnAmount: number;
  targetSales: number;
  targetAchievement: number; // percentage
  averageTransactionValue: number;
  returnRate: number; // percentage
  discountRate: number; // percentage
  transactionCount: number;
}

export interface BusinessInsights {
  bestRegion: { name: string; sales: number };
  worstRegion: { name: string; sales: number };
  storesMissingTarget: Array<{ store: string; sales: number; target: number; deficit: number; achievement: number }>;
  highReturnCategories: Array<{ category: string; returnAmount: number; returnRate: number }>;
  stockoutRiskItems: Array<{ category: string; store: string; stockLevel: number; reorderPoint: number }>;
  executiveSummary: string;
  actionItems: string[];
}

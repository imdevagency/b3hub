/**
 * lib/api/analytics.ts
 *
 * Analytics API — aggregated metrics for buyer, seller, and carrier roles.
 */
import { apiFetch } from './common';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface MonthlyValue {
  month: string; // "YYYY-MM"
  value: number;
}

export interface OrderBreakdown {
  status: string;
  count: number;
  total: number;
}

export interface MaterialSpend {
  category: string;
  totalSpent: number;
  orderCount: number;
}

export interface ArAgingBucket {
  count: number;
  total: number;
}

export interface ArAging {
  current: ArAgingBucket;
  days30: ArAgingBucket;
  days60: ArAgingBucket;
  days90: ArAgingBucket;
  over90: ArAgingBucket;
}

export interface BuyerAnalytics {
  monthlySpend: MonthlyValue[];
  orderBreakdown: OrderBreakdown[];
  materialBreakdown: MaterialSpend[];
  co2Kg: number;
  arAging?: ArAging;
}

export interface SellerPerformanceStats {
  avgRating: number;
  completionRate: number;
  totalOrders: number;
  completedOrders: number;
  onTimeRate: number;
  totalReviews: number;
}

export interface TopMaterial {
  materialId: string;
  name: string;
  revenue: number;
  orderCount: number;
}

export interface SellerAnalytics {
  monthlyRevenue: MonthlyValue[];
  orderBreakdown: OrderBreakdown[];
  performanceStats: SellerPerformanceStats;
  topMaterials: TopMaterial[];
}

export interface FleetUtilization {
  total: number;
  active: number;
  inUse: number;
  utilizationRate: number;
}

export interface CarrierAnalytics {
  monthlyEarnings: MonthlyValue[];
  jobBreakdown: OrderBreakdown[];
  fleetUtilization: FleetUtilization;
}

export interface AnalyticsOverview {
  buyer: BuyerAnalytics | null;
  seller: SellerAnalytics | null;
  carrier: CarrierAnalytics | null;
}

// ─── API ──────────────────────────────────────────────────────────────────

export const analyticsApi = {
  overview: (token: string) =>
    apiFetch<AnalyticsOverview>('/analytics/overview', {
      headers: { Authorization: `Bearer ${token}` },
    }),
};

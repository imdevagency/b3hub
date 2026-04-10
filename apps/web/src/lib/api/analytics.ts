/**
 * Analytics API module.
 * ERP analytics aggregations for buyer, seller, and carrier roles.
 */
import { apiFetch, API_URL } from './common';

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
  arAging: ArAging;
  /** Spend grouped by material category, sorted descending by totalSpent */
  materialBreakdown: MaterialSpend[];
  /** Estimated total CO2 in kg across all delivered transport jobs */
  co2Kg: number;
}

export interface MaterialSpend {
  category: string;
  totalSpent: number;
  orderCount: number;
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

// ─── Functions ─────────────────────────────────────────────────────────────

export interface SupplierScore {
  supplierId: string;
  name: string;
  avgRating: number;
  totalReviews: number;
  totalOrders: number;
  completedOrders: number;
  completionRate: number;
  onTimeRate: number;
}

export async function getAnalyticsOverview(token: string): Promise<AnalyticsOverview> {
  return apiFetch<AnalyticsOverview>('/analytics/overview', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getSuppliersPerformance(): Promise<SupplierScore[]> {
  return apiFetch<SupplierScore[]>('/analytics/suppliers');
}

// ─── Delivery Calendar ─────────────────────────────────────────────────────

export interface DeliveryCalendarEntry {
  id: string;
  type: 'ORDER' | 'JOB';
  ref: string;
  status: string;
  deliveryDate: string;
  address: string;
  city: string;
  materialName: string | null;
  amount: number;
  role: 'BUYER' | 'SELLER' | 'CARRIER';
}

export async function getDeliveryCalendar(token: string): Promise<DeliveryCalendarEntry[]> {
  return apiFetch<DeliveryCalendarEntry[]>('/analytics/delivery-calendar', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ─── PDF Export ─────────────────────────────────────────────────────────────

export async function exportAnalyticsPdf(token: string): Promise<Blob> {
  const res = await fetch(`${API_URL}/analytics/export-pdf`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.blob();
}

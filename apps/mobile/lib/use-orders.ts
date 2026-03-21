import { useState, useCallback, useMemo } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAuth } from './auth-context';
import { api } from './api';
import type { SkipHireOrder, ApiOrder, ApiTransportJob, QuoteRequest } from './api';

// ── Types ────────────────────────────────────────────────────────────────────────────────────

export type FilterKey = 'ALL' | 'ACTIVE' | 'DONE' | 'CANCELLED';

export type UnifiedOrder =
  | { kind: 'skip'; data: SkipHireOrder; sortDate: number; isActive: boolean }
  | { kind: 'material'; data: ApiOrder; sortDate: number; isActive: boolean }
  | { kind: 'transport'; data: ApiTransportJob; sortDate: number; isActive: boolean }
  | { kind: 'rfq'; data: QuoteRequest; sortDate: number; isActive: boolean };

// ── Bucket helpers (exported for use in card components) ──────

const SKIP_ACTIVE = new Set(['PENDING', 'CONFIRMED', 'DELIVERED']);
const SKIP_DONE = new Set(['COLLECTED', 'COMPLETED']);
const MAT_ACTIVE = new Set([
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'LOADING',
  'DISPATCHED',
  'DELIVERING',
  'SHIPPED',
]);
const TJB_ACTIVE = new Set([
  'AVAILABLE',
  'ASSIGNED',
  'ACCEPTED',
  'EN_ROUTE_PICKUP',
  'AT_PICKUP',
  'LOADED',
  'EN_ROUTE_DELIVERY',
  'AT_DELIVERY',
]);

export function skipBucket(status: string): FilterKey {
  if (SKIP_ACTIVE.has(status)) return 'ACTIVE';
  if (SKIP_DONE.has(status)) return 'DONE';
  return 'CANCELLED';
}

export function matBucket(status: string): FilterKey {
  if (MAT_ACTIVE.has(status)) return 'ACTIVE';
  if (status === 'DELIVERED') return 'DONE';
  return 'CANCELLED';
}

export function reqBucket(status: string): FilterKey {
  if (TJB_ACTIVE.has(status)) return 'ACTIVE';
  if (status === 'DELIVERED') return 'DONE';
  return 'CANCELLED';
}

const RFQ_ACTIVE = new Set(['PENDING', 'QUOTED']);
export function rfqBucket(status: string): FilterKey {
  if (RFQ_ACTIVE.has(status)) return 'ACTIVE';
  if (status === 'ACCEPTED') return 'DONE';
  return 'CANCELLED';
}

// ── Hook ──────────────────────────────────────────────────────

export function useOrders() {
  const { token } = useAuth();
  const [skipOrders, setSkipOrders] = useState<SkipHireOrder[]>([]);
  const [matOrders, setMatOrders] = useState<ApiOrder[]>([]);
  const [reqOrders, setReqOrders] = useState<ApiTransportJob[]>([]);
  const [rfqOrders, setRfqOrders] = useState<QuoteRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterKey>('ALL');

  const load = useCallback(
    async (showSkeleton = true) => {
      if (!token) {
        setLoading(false);
        return;
      }
      if (showSkeleton) setLoading(true);
      const [skipRes, matRes, reqRes, rfqRes] = await Promise.allSettled([
        api.skipHire.myOrders(token),
        api.orders.myOrders(token),
        api.transportJobs.myRequests(token),
        api.quoteRequests.list(token),
      ]);
      setSkipOrders(skipRes.status === 'fulfilled' && Array.isArray(skipRes.value) ? skipRes.value : []);
      setMatOrders(matRes.status === 'fulfilled' && Array.isArray(matRes.value) ? matRes.value : []);
      setReqOrders(reqRes.status === 'fulfilled' && Array.isArray(reqRes.value) ? reqRes.value : []);
      setRfqOrders(rfqRes.status === 'fulfilled' && Array.isArray(rfqRes.value) ? rfqRes.value : []);
      setLoading(false);
      setRefreshing(false);
    },
    [token],
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(false);
  }, [load]);

  // Merge + sort: active first, then newest
  const unified = useMemo<UnifiedOrder[]>(() => {
    const list: UnifiedOrder[] = [];
    skipOrders.forEach((o) => {
      list.push({
        kind: 'skip',
        data: o,
        sortDate: new Date(o.deliveryDate).getTime(),
        isActive: skipBucket(o.status) === 'ACTIVE',
      });
    });
    matOrders.forEach((o) => {
      list.push({
        kind: 'material',
        data: o,
        sortDate: new Date(o.createdAt).getTime(),
        isActive: matBucket(o.status) === 'ACTIVE',
      });
    });
    reqOrders.forEach((o) => {
      list.push({
        kind: 'transport',
        data: o,
        sortDate: new Date(o.pickupDate).getTime(),
        isActive: reqBucket(o.status) === 'ACTIVE',
      });
    });
    rfqOrders.forEach((o) => {
      list.push({
        kind: 'rfq',
        data: o,
        sortDate: new Date(o.createdAt).getTime(),
        isActive: rfqBucket(o.status) === 'ACTIVE',
      });
    });
    return list.sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      return b.sortDate - a.sortDate;
    });
  }, [skipOrders, matOrders, reqOrders, rfqOrders]);

  const filtered = useMemo(() => {
    if (filter === 'ALL') return unified;
    return unified.filter((item) => {
      const bucket =
        item.kind === 'skip'
          ? skipBucket(item.data.status)
          : item.kind === 'transport'
            ? reqBucket(item.data.status)
            : item.kind === 'rfq'
              ? rfqBucket(item.data.status)
              : matBucket(item.data.status);
      return bucket === filter;
    });
  }, [unified, filter]);

  const counts = useMemo(() => {
    const c: Record<FilterKey, number> = { ALL: unified.length, ACTIVE: 0, DONE: 0, CANCELLED: 0 };
    unified.forEach((item) => {
      const b =
        item.kind === 'skip'
          ? skipBucket(item.data.status)
          : item.kind === 'transport'
            ? reqBucket(item.data.status)
            : item.kind === 'rfq'
              ? rfqBucket(item.data.status)
              : matBucket(item.data.status);
      c[b] = (c[b] ?? 0) + 1;
    });
    return c;
  }, [unified]);

  return {
    loading,
    refreshing,
    onRefresh,
    filter,
    setFilter,
    unified,
    filtered,
    counts,
  };
}

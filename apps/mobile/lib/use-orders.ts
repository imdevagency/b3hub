import { useState, useCallback, useMemo } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAuth } from './auth-context';
import { api } from './api';
import type { SkipHireOrder, ApiOrder, ApiTransportJob, QuoteRequest } from './api';
import type { GuestOrderTracking } from './api/guest-orders';
import { getStoredGuestOrders } from './guest-token-storage';

// ── Types ────────────────────────────────────────────────────────────────────────────────────

export type FilterKey = 'ALL' | 'ACTIVE' | 'DONE' | 'CANCELLED';

/** Extract a plain-text searchable string from any unified order. */
export function orderSearchText(item: UnifiedOrder): string {
  const d = item.data as any;
  const parts: string[] = [];
  // order number / job number
  if (d.orderNumber) parts.push(d.orderNumber);
  if (d.jobNumber) parts.push(d.jobNumber);
  // address
  if (d.deliveryAddress) parts.push(d.deliveryAddress);
  if (d.deliveryCity) parts.push(d.deliveryCity);
  if (d.pickupAddress) parts.push(d.pickupAddress);
  if (d.dropoffAddress) parts.push(d.dropoffAddress);
  if (d.fromCity) parts.push(d.fromCity);
  if (d.toCity) parts.push(d.toCity);
  // material
  if (d.material?.name) parts.push(d.material.name);
  if (d.items) (d.items as any[]).forEach((i) => { if (i.material?.name) parts.push(i.material.name); });
  // RFQ
  if (d.title) parts.push(d.title);
  // supplier / buyer names
  if (d.supplier?.name) parts.push(d.supplier.name);
  if (d.buyer?.name) parts.push(d.buyer.name);
  // project
  if (d.project?.name) parts.push(d.project.name);
  return parts.join(' ').toLowerCase();
}

export type UnifiedOrder =
  | { kind: 'skip'; data: SkipHireOrder; sortDate: number; isActive: boolean }
  | { kind: 'material'; data: ApiOrder; sortDate: number; isActive: boolean }
  | { kind: 'transport'; data: ApiTransportJob; sortDate: number; isActive: boolean }
  | { kind: 'disposal'; data: ApiTransportJob; sortDate: number; isActive: boolean }
  | { kind: 'rfq'; data: QuoteRequest; sortDate: number; isActive: boolean }
  | { kind: 'guest'; data: GuestOrderTracking; sortDate: number; isActive: boolean };

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
  const [guestOrders, setGuestOrders] = useState<GuestOrderTracking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterKey>('ALL');
  const [query, setQuery] = useState('');
  const [error, setError] = useState(false);

  const load = useCallback(
    async (showSkeleton = true) => {
      if (!token) {
        // Even unauthenticated users can have stored guest orders
        const storedTokens = await getStoredGuestOrders();
        const guestResults = await Promise.allSettled(
          storedTokens.map((o) => api.guestOrders.track(o.token)),
        );
        setGuestOrders(guestResults.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : [])));
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
      setError([skipRes, matRes, reqRes, rfqRes].every((r) => r.status === 'rejected'));
      // Also fetch any stored guest tokens (user may have placed a guest order before signing up)
      const storedTokens = await getStoredGuestOrders();
      const guestResults = await Promise.allSettled(
        storedTokens.map((o) => api.guestOrders.track(o.token)),
      );
      setGuestOrders(guestResults.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : [])));
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
        kind: o.jobType === 'WASTE_COLLECTION' ? 'disposal' : 'transport',
        data: o,
        sortDate: o.pickupDate ? new Date(o.pickupDate).getTime() : Date.now(),
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
    guestOrders.forEach((o) => {
      list.push({
        kind: 'guest',
        data: o,
        sortDate: new Date(o.createdAt).getTime(),
        isActive: !['CANCELLED', 'CONVERTED'].includes(o.status),
      });
    });
    return list.sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      return b.sortDate - a.sortDate;
    });
  }, [skipOrders, matOrders, reqOrders, rfqOrders, guestOrders]);

  const filtered = useMemo(() => {
    let list = filter === 'ALL' ? unified : unified.filter((item) => {
      if (item.kind === 'guest') {
        const isActive = !['CANCELLED', 'CONVERTED'].includes(item.data.status);
        const bucket: FilterKey = isActive ? 'ACTIVE' : 'DONE';
        return bucket === filter;
      }
      const bucket =
        item.kind === 'skip'
          ? skipBucket(item.data.status)
          : item.kind === 'transport' || item.kind === 'disposal'
            ? reqBucket(item.data.status)
            : item.kind === 'rfq'
              ? rfqBucket(item.data.status)
              : matBucket(item.data.status);
      return bucket === filter;
    });
    if (query.trim().length >= 2) {
      const q = query.trim().toLowerCase();
      list = list.filter((item) => orderSearchText(item).includes(q));
    }
    return list;
  }, [unified, filter, query]);

  const counts = useMemo(() => {
    const c: Record<FilterKey, number> = { ALL: unified.length, ACTIVE: 0, DONE: 0, CANCELLED: 0 };
    unified.forEach((item) => {
      let b: FilterKey;
      if (item.kind === 'guest') {
        b = !['CANCELLED', 'CONVERTED'].includes(item.data.status) ? 'ACTIVE' : 'DONE';
      } else {
        b =
          item.kind === 'skip'
            ? skipBucket(item.data.status)
            : item.kind === 'transport' || item.kind === 'disposal'
              ? reqBucket(item.data.status)
              : item.kind === 'rfq'
                ? rfqBucket(item.data.status)
                : matBucket(item.data.status);
      }
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
    query,
    setQuery,
    unified,
    filtered,
    counts,
    error,
  };
}

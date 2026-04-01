/**
 * useLiveUpdates — Subscribe to real-time order and job status changes.
 *
 * Connects to the /updates WebSocket namespace and keeps local state in sync
 * without requiring a manual pull-to-refresh.
 *
 * Usage:
 *   const { orderStatus, jobStatus, jobLocation } = useLiveUpdates({
 *     orderId: 'abc',   // optional
 *     jobId: 'xyz',     // optional
 *     token,
 *   });
 *
 * Both orderId and jobId are optional — pass only what the screen needs.
 */
import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const WS_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1')
  .replace(/\/api\/v1\/?$/, '');

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LiveOrderUpdate {
  orderId: string;
  status: string;
}

export interface LiveJobUpdate {
  jobId: string;
  status: string;
  orderId?: string;
}

export interface LiveLocationUpdate {
  jobId: string;
  lat: number;
  lng: number;
}

export interface SellerNewOrderUpdate {
  companyId: string;
  orderId: string;
  orderNumber: string;
}

interface UseLiveUpdatesOptions {
  orderId?: string | null;
  jobId?: string | null;
  /** Seller company ID — subscribes to the seller room for new-order push events. */
  sellerCompanyId?: string | null;
  token: string | null;
}

interface UseLiveUpdatesReturn {
  /** Latest order status pushed from the server, or null if not yet received */
  orderStatus: string | null;
  /** Latest job status pushed from the server, or null if not yet received */
  jobStatus: string | null;
  /** Latest driver GPS location, or null if not yet received */
  jobLocation: LiveLocationUpdate | null;
  /** Latest seller new-order push event, or null if not yet received */
  sellerNewOrder: SellerNewOrderUpdate | null;
  connected: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────

export function useLiveUpdates({
  orderId,
  jobId,
  sellerCompanyId,
  token,
}: UseLiveUpdatesOptions): UseLiveUpdatesReturn {
  const [orderStatus, setOrderStatus] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [jobLocation, setJobLocation] = useState<LiveLocationUpdate | null>(null);
  const [sellerNewOrder, setSellerNewOrder] = useState<SellerNewOrderUpdate | null>(null);
  const [connected, setConnected] = useState(false);

  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!token || (!orderId && !jobId && !sellerCompanyId)) return;

    const socket = io(`${WS_URL}/updates`, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      if (orderId) socket.emit('watchOrder', { orderId });
      if (jobId) socket.emit('watchJob', { jobId });
      if (sellerCompanyId) socket.emit('watchSeller', { companyId: sellerCompanyId });
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('orderStatusChanged', (payload: LiveOrderUpdate) => {
      if (orderId && payload.orderId === orderId) {
        setOrderStatus(payload.status);
      }
    });

    socket.on('jobStatusChanged', (payload: LiveJobUpdate) => {
      if (jobId && payload.jobId === jobId) {
        setJobStatus(payload.status);
      }
      // Also update order status when the job linked to this order changes
      if (orderId && payload.orderId === orderId) {
        setJobStatus(payload.status);
      }
    });

    socket.on('jobLocationChanged', (payload: LiveLocationUpdate) => {
      if (jobId && payload.jobId === jobId) {
        setJobLocation(payload);
      }
    });

    socket.on('sellerNewOrder', (payload: SellerNewOrderUpdate) => {
      if (sellerCompanyId && payload.companyId === sellerCompanyId) {
        setSellerNewOrder(payload);
      }
    });

    return () => {
      if (orderId) socket.emit('unwatchOrder', { orderId });
      if (jobId) socket.emit('unwatchJob', { jobId });
      if (sellerCompanyId) socket.emit('unwatchSeller', { companyId: sellerCompanyId });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [orderId, jobId, sellerCompanyId, token]);

  return { orderStatus, jobStatus, jobLocation, sellerNewOrder, connected };
}

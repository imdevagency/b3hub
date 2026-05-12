/**
 * useJobTracking hook.
 * Real-time transport job location + status via WebSocket (/updates namespace).
 * Replaces the 10-second REST poll used on the transport-job and order detail pages.
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

// Strip /api/v1 suffix — socket.io lives at the bare API host root.
const WS_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1').replace(
  /\/api\/v1\/?$/,
  '',
);

export interface LiveTruckPos {
  lat: number;
  lng: number;
  estimatedArrivalMin: number | null;
  updatedAt: string;
}

interface UseJobTrackingOptions {
  jobId: string | null | undefined;
  token: string | null | undefined;
}

interface UseJobTrackingReturn {
  truckPos: LiveTruckPos | null;
  liveStatus: string | null;
  connected: boolean;
}

export function useJobTracking({ jobId, token }: UseJobTrackingOptions): UseJobTrackingReturn {
  const [truckPos, setTruckPos] = useState<LiveTruckPos | null>(null);
  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!jobId || !token) return;

    const socket = io(`${WS_URL}/updates`, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('watchJob', { jobId });
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on(
      'jobLocationChanged',
      (payload: { jobId: string; lat: number; lng: number; estimatedArrivalMin: number | null }) => {
        if (payload.jobId !== jobId) return;
        setTruckPos({
          lat: payload.lat,
          lng: payload.lng,
          estimatedArrivalMin: payload.estimatedArrivalMin,
          updatedAt: new Date().toISOString(),
        });
      },
    );

    socket.on('jobStatusChanged', (payload: { jobId: string; status: string }) => {
      if (payload.jobId !== jobId) return;
      setLiveStatus(payload.status);
    });

    return () => {
      socket.emit('unwatchJob', { jobId });
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [jobId, token]);

  return { truckPos, liveStatus, connected };
}

/**
 * OrderStatusBadge — Renders a StatusPill for an order or transport-job status.
 *
 * Thin wrapper around StatusPill + the canonical status maps in lib/status.ts.
 * Screens should use this instead of:
 *   • Local `getStatusMeta` / `getStatusStyle` functions
 *   • Directly calling `getOrderStatus(s)` and then spreading into StatusPill
 *
 * Usage:
 *   // Order
 *   <OrderStatusBadge status={order.status} />
 *   <OrderStatusBadge status={order.status} size="sm" />
 *
 *   // Transport job
 *   <JobStatusBadge status={job.status} />
 *   <JobStatusBadge status={job.status} size="sm" />
 *
 * Both components accept an optional `label` override for display text.
 */

import React from 'react';
import { getJobStatus, getOrderStatus } from '@/lib/status';
import { StatusPill } from './StatusPill';

interface StatusBadgeProps {
  status: string;
  /** Override the displayed label. Defaults to the canonical Latvian label from status.ts. */
  label?: string;
  size?: 'sm' | 'md';
}

export function OrderStatusBadge({ status, label, size = 'sm' }: StatusBadgeProps) {
  const st = getOrderStatus(status);
  return <StatusPill label={label ?? st.label} bg={st.bg} color={st.color} size={size} />;
}

export function JobStatusBadge({ status, label, size = 'sm' }: StatusBadgeProps) {
  const st = getJobStatus(status);
  return <StatusPill label={label ?? st.label} bg={st.bg} color={st.color} size={size} />;
}

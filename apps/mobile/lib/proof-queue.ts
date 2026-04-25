/**
 * Offline proof queue — stores delivery proofs locally when the network is
 * unavailable and retries them automatically when connectivity is restored.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from './api/common';

const QUEUE_KEY = '@b3hub_proof_queue';

export interface QueuedProof {
  id: string;
  jobId: string;
  token: string;
  recipientName?: string;
  notes?: string;
  photos?: string[];
  loadCondition?: 'FULL' | 'PARTIAL' | 'DAMAGED';
  hasDamage?: boolean;
  damageNote?: string;
  gradeConfirmed?: boolean;
  signatureSvg?: string;
  /** GPS captured at proof submission — may be missing when location was denied */
  proofLat?: number;
  proofLng?: number;
  queuedAt: string;
}

export async function getProofQueue(): Promise<QueuedProof[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedProof[]) : [];
  } catch {
    return [];
  }
}

export async function addToProofQueue(
  proof: Omit<QueuedProof, 'id' | 'queuedAt'>,
): Promise<void> {
  const queue = await getProofQueue();
  const item: QueuedProof = {
    ...proof,
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    queuedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify([...queue, item]));
}

async function removeFromQueue(id: string): Promise<void> {
  const queue = await getProofQueue();
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue.filter((p) => p.id !== id)));
}

/**
 * Attempt to send all queued proofs to the server.
 * Removes each item on success. Leaves failed items for the next retry.
 * @returns { flushed, failed } counts
 */
export async function flushProofQueue(): Promise<{ flushed: number; failed: number }> {
  const queue = await getProofQueue();
  if (queue.length === 0) return { flushed: 0, failed: 0 };

  let flushed = 0;
  let failed = 0;

  for (const item of queue) {
    try {
      await apiFetch(`/transport-jobs/${item.jobId}/delivery-proof`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${item.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipientName: item.recipientName,
          notes: item.notes,
          photos: item.photos,
          loadCondition: item.loadCondition,
          isPartialLoad: item.loadCondition === 'PARTIAL',
          hasDamage: item.hasDamage,
          damageNote: item.damageNote,
          gradeConfirmed: item.gradeConfirmed,
          signatureSvg: item.signatureSvg,
          proofLat: item.proofLat,
          proofLng: item.proofLng,
        }),
      });
      await removeFromQueue(item.id);
      flushed++;
    } catch {
      failed++;
    }
  }

  return { flushed, failed };
}

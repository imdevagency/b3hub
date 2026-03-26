import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── Role combination display name ─────────────────────────────────────────
// Derives a single human-readable role name from the three capability flags.
// Pure flags → short name; combinations → descriptive compound name.

interface RoleFlags {
  canSell?: boolean;
  canTransport?: boolean;
  canSkipHire?: boolean;
}

export function getRoleName(user: RoleFlags | null | undefined): string {
  if (!user) return 'Buyer';
  const { canSell = false, canTransport = false, canSkipHire = false } = user;

  if (canSell && canTransport && canSkipHire) return 'Company';
  if (canSell && canTransport) return 'Trader';
  if (canSell && canSkipHire) return 'Recycler';
  if (canTransport && canSkipHire) return 'Waste Carrier';
  if (canSell) return 'Supplier';
  if (canTransport) return 'Carrier';
  if (canSkipHire) return 'Skip Operator';
  return 'Buyer';
}

import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { useAuth } from './auth-context';

export type AppMode = 'BUYER' | 'SUPPLIER' | 'CARRIER' | 'RECYCLER';

export const MODE_HOME: Record<AppMode, string> = {
  BUYER: '/(buyer)/home',
  SUPPLIER: '/(seller)/home',
  CARRIER: '/(driver)/home',
  RECYCLER: '/(recycler)/home',
};

/**
 * Priority order: RECYCLER > SUPPLIER > CARRIER > BUYER
 * This ensures every user type lands in their primary context on first open.
 */
function defaultModeForUser(
  user: {
    canBuy?: boolean;
    canSell: boolean;
    canTransport: boolean;
    canRecycle?: boolean;
    isCompany: boolean;
    company?: { features?: string[] };
  } | null,
): AppMode {
  if (!user) return 'BUYER';
  if (user.canRecycle) return 'RECYCLER';
  if (user.canSell) return 'SUPPLIER'; // hybrid (canSell+canTransport) → prefer SUPPLIER
  if (user.canTransport) return 'CARRIER';
  return 'BUYER';
}

interface ModeContextValue {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  availableModes: AppMode[];
  isMultiRole: boolean;
}

const ModeContext = createContext<ModeContextValue | null>(null);

export function ModeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  const availableModes = useMemo<AppMode[]>(() => {
    const modes: AppMode[] = [];
    // BUYER mode is gated by canBuy flag (default true for all accounts unless explicitly revoked by admin)
    if (user?.canBuy !== false) modes.push('BUYER');
    if (user?.canSell) modes.push('SUPPLIER');
    if (user?.canTransport) modes.push('CARRIER');
    if ((user as any)?.canRecycle) modes.push('RECYCLER');
    return modes;
  }, [user?.canBuy, user?.canSell, user?.canTransport, (user as any)?.canRecycle]);

  const [mode, setModeState] = useState<AppMode>(() => defaultModeForUser(user));

  // Re-derive mode when user logs in or out so drivers/sellers land in the right UI.
  useEffect(() => {
    setModeState(
      defaultModeForUser(
        user
          ? {
              canBuy: user.canBuy,
              canSell: user.canSell,
              canTransport: user.canTransport,
              canRecycle: (user as any).canRecycle,
              isCompany: user.isCompany,
              company: (user as any).company,
            }
          : null,
      ),
    );
  }, [user?.id]);

  // Re-validate current mode if capabilities change mid-session (e.g. admin revokes canSell).
  // availableModes already recomputes via useMemo; this effect reacts to the result.
  useEffect(() => {
    if (!availableModes.includes(mode)) {
      setModeState(defaultModeForUser(user));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableModes]);

  const setMode = (newMode: AppMode) => {
    if (availableModes.includes(newMode)) {
      setModeState(newMode);
    }
  };

  return (
    <ModeContext.Provider
      value={{
        mode,
        setMode,
        availableModes,
        isMultiRole: availableModes.length > 1,
      }}
    >
      {children}
    </ModeContext.Provider>
  );
}

export function useMode() {
  const ctx = useContext(ModeContext);
  if (!ctx) throw new Error('useMode must be used within ModeProvider');
  return ctx;
}

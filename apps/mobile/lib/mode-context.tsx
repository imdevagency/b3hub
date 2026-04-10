import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { useAuth } from './auth-context';

export type AppMode = 'BUYER' | 'SUPPLIER' | 'CARRIER';

export const MODE_HOME: Record<AppMode, string> = {
  BUYER: '/(buyer)/home',
  SUPPLIER: '/(seller)/home',
  CARRIER: '/(driver)/home',
};

/** Derive the best default mode from the user's role flags. */
function defaultModeForUser(user: { canSell: boolean; canTransport: boolean } | null): AppMode {
  if (!user) return 'BUYER';
  // Capability flags are canonical for seller/driver access.
  if (user.canTransport && !user.canSell) return 'CARRIER';
  if (user.canSell && !user.canTransport) return 'SUPPLIER';
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
    // Pure carrier (approved, no sell) → skip buyer mode
    // Pure supplier (approved, no transport) → skip buyer mode
    // Mixed or unapproved → always include buyer
    const isPureCarrier = !!(user?.canTransport && !user?.canSell);
    const isPureSupplier = !!(user?.canSell && !user?.canTransport);
    if (!isPureCarrier && !isPureSupplier) modes.push('BUYER');
    if (user?.canSell) modes.push('SUPPLIER');
    if (user?.canTransport) modes.push('CARRIER');
    if (modes.length === 0) modes.push('BUYER'); // fallback
    return modes;
  }, [user?.canSell, user?.canTransport]);

  const [mode, setModeState] = useState<AppMode>(() => defaultModeForUser(user));

  // Re-derive mode when user logs in or out so drivers/sellers land in the right UI.
  useEffect(() => {
    setModeState(defaultModeForUser(user));
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

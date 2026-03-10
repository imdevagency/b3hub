import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { useAuth } from './auth-context';

export type AppMode = 'buyer' | 'seller' | 'driver';

export const MODE_HOME: Record<AppMode, string> = {
  buyer: '/(buyer)/home',
  seller: '/(seller)/incoming',
  driver: '/(driver)/jobs',
};

/** Derive the best default mode from the user's role flags. */
function defaultModeForUser(
  user: { userType: string; canSell: boolean; canTransport: boolean } | null,
): AppMode {
  if (!user) return 'buyer';
  // Pure carrier / driver-only user
  if (user.userType === 'CARRIER' || (user.canTransport && !user.canSell)) return 'driver';
  // Pure supplier / seller-only user
  if (user.userType === 'SUPPLIER' || (user.canSell && !user.canTransport)) return 'seller';
  return 'buyer';
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
    if (!isPureCarrier && !isPureSupplier) modes.push('buyer');
    if (user?.canSell) modes.push('seller');
    if (user?.canTransport) modes.push('driver');
    if (modes.length === 0) modes.push('buyer'); // fallback
    return modes;
  }, [user?.canSell, user?.canTransport]);

  const [mode, setModeState] = useState<AppMode>(() => defaultModeForUser(user));

  // Re-derive mode when user logs in or out so drivers/sellers land in the right UI.
  useEffect(() => {
    setModeState(defaultModeForUser(user));
  }, [user?.id]);

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

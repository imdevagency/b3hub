import React, { createContext, useContext, useState, useMemo } from 'react';
import { useAuth } from './auth-context';

export type AppMode = 'buyer' | 'seller' | 'driver';

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
    const modes: AppMode[] = ['buyer'];
    if (user?.canSell) modes.push('seller');
    if (user?.canTransport) modes.push('driver');
    return modes;
  }, [user?.canSell, user?.canTransport]);

  const [mode, setModeState] = useState<AppMode>('buyer');

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

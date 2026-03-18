/**
 * ModeContext & ModeProvider.
 * Tracks the user's active role mode (buyer / supplier / carrier) when a user
 * holds multiple roles, persisted in localStorage.
 */
'use client';

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import { type Mode } from '@/lib/api';

export type { Mode };

const LS_MODE_KEY = 'b3hub_active_mode';

interface ModeContextValue {
  activeMode: Mode;
  setActiveMode: (mode: Mode) => void;
  availableModes: Mode[];
}

const ModeContext = createContext<ModeContextValue>({
  activeMode: 'BUYER',
  setActiveMode: () => {},
  availableModes: ['BUYER'],
});

export function ModeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  // Backend computes available modes — just read them directly
  const availableModes = useMemo<Mode[]>(
    () => (user?.availableModes as Mode[] | undefined) ?? ['BUYER'],
    [user],
  );

  const [activeMode, setActiveModeState] = useState<Mode>(availableModes[0]);

  // Hydrate from localStorage once mounted
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LS_MODE_KEY) as Mode | null;
      if (stored && availableModes.includes(stored)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setActiveModeState(stored);
      } else {
        setActiveModeState(availableModes[0]);
      }
    } catch {
      /* ignore */
    }
  }, [availableModes]);

  const setActiveMode = (mode: Mode) => {
    setActiveModeState(mode);
    try {
      localStorage.setItem(LS_MODE_KEY, mode);
    } catch {
      /* ignore */
    }
  };

  return (
    <ModeContext.Provider value={{ activeMode, setActiveMode, availableModes }}>
      {children}
    </ModeContext.Provider>
  );
}

export function useMode() {
  return useContext(ModeContext);
}

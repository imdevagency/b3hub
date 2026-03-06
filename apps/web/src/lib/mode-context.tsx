'use client';

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';

export type Mode = 'BUYER' | 'SUPPLIER' | 'CARRIER';

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

  const availableModes = useMemo<Mode[]>(() => {
    if (!user) return ['BUYER'];
    const modes: Mode[] = [];
    const isAdmin = user.userType === 'ADMIN';
    const isTransport = user.canTransport || user.userType === 'CARRIER';
    // Buyer mode: BUYER type users, EXCEPT pure-transport individuals (driver with no company/sell flags)
    const isPureTransportIndividual = isTransport && !user.canSell && !user.isCompany;
    const isBuyer = user.userType === 'BUYER' && !isPureTransportIndividual;
    if (isAdmin || isBuyer) modes.push('BUYER');
    if (isAdmin || user.userType === 'SUPPLIER' || user.canSell) modes.push('SUPPLIER');
    if (isAdmin || isTransport) modes.push('CARRIER');
    // Fallback: if no mode resolved (shouldn't happen), give BUYER
    return modes.length > 0 ? modes : ['BUYER'];
  }, [user]);

  const [activeMode, setActiveModeState] = useState<Mode>(availableModes[0]);

  // Hydrate from localStorage once mounted
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LS_MODE_KEY) as Mode | null;
      if (stored && availableModes.includes(stored)) {
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

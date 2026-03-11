import React, { createContext, useContext, useState } from 'react';
import type { WasteType, DisposalTruckType } from './api';

export interface DisposalWizardState {
  location: string;
  locationLat: number | null;
  locationLng: number | null;
  locationCity: string;
  wasteType: WasteType | null;
  truckType: DisposalTruckType;
  truckCount: number;
  description: string;
  requestedDate: string;
}

interface DisposalContextValue {
  state: DisposalWizardState;
  setLocation: (address: string, city: string, lat: number, lng: number) => void;
  setWasteType: (v: WasteType) => void;
  setTruckType: (v: DisposalTruckType) => void;
  setTruckCount: (v: number) => void;
  setDescription: (v: string) => void;
  setRequestedDate: (v: string) => void;
  reset: () => void;
}

const INITIAL: DisposalWizardState = {
  location: '',
  locationLat: null,
  locationLng: null,
  locationCity: '',
  wasteType: null,
  truckType: 'TIPPER_LARGE',
  truckCount: 1,
  description: '',
  requestedDate: '',
};

const DisposalContext = createContext<DisposalContextValue | null>(null);

export function DisposalProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DisposalWizardState>(INITIAL);

  return (
    <DisposalContext.Provider
      value={{
        state,
        setLocation: (location, locationCity, locationLat, locationLng) =>
          setState((s) => ({ ...s, location, locationCity, locationLat, locationLng })),
        setWasteType: (wasteType) => setState((s) => ({ ...s, wasteType })),
        setTruckType: (truckType) => setState((s) => ({ ...s, truckType })),
        setTruckCount: (truckCount) => setState((s) => ({ ...s, truckCount })),
        setDescription: (description) => setState((s) => ({ ...s, description })),
        setRequestedDate: (requestedDate) => setState((s) => ({ ...s, requestedDate })),
        reset: () => setState(INITIAL),
      }}
    >
      {children}
    </DisposalContext.Provider>
  );
}

export function useDisposal(): DisposalContextValue {
  const ctx = useContext(DisposalContext);
  if (!ctx) throw new Error('useDisposal must be used within DisposalProvider');
  return ctx;
}

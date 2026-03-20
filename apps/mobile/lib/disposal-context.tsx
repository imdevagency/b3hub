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

export interface ConfirmedDisposal {
  jobNumber: string;
  pickupAddress: string;
  wasteType: WasteType;
  truckType: DisposalTruckType;
  truckCount: number;
  requestedDate: string;
  estimatedWeight: number;
}

interface DisposalContextValue {
  state: DisposalWizardState;
  confirmedDisposal: ConfirmedDisposal | null;
  setLocation: (address: string, city: string, lat: number, lng: number) => void;
  setWasteType: (v: WasteType) => void;
  setTruckType: (v: DisposalTruckType) => void;
  setTruckCount: (v: number) => void;
  setDescription: (v: string) => void;
  setRequestedDate: (v: string) => void;
  setConfirmedDisposal: (disposal: ConfirmedDisposal | null) => void;
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
  const [confirmedDisposal, setConfirmedDisposal] = useState<ConfirmedDisposal | null>(null);

  return (
    <DisposalContext.Provider
      value={{
        state,
        confirmedDisposal,
        setLocation: (location, locationCity, locationLat, locationLng) =>
          setState((s) => ({ ...s, location, locationCity, locationLat, locationLng })),
        setWasteType: (wasteType) => setState((s) => ({ ...s, wasteType })),
        setTruckType: (truckType) => setState((s) => ({ ...s, truckType })),
        setTruckCount: (truckCount) => setState((s) => ({ ...s, truckCount })),
        setDescription: (description) => setState((s) => ({ ...s, description })),
        setRequestedDate: (requestedDate) => setState((s) => ({ ...s, requestedDate })),
        setConfirmedDisposal,
        reset: () => {
          setState(INITIAL);
          setConfirmedDisposal(null);
        },
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

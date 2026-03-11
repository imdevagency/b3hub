import React, { createContext, useContext, useState } from 'react';
import type { TransportVehicleType } from './api';

export interface TransportWizardState {
  pickupAddress: string;
  pickupCity: string;
  pickupLat: number | null;
  pickupLng: number | null;
  dropoffAddress: string;
  dropoffCity: string;
  dropoffLat: number | null;
  dropoffLng: number | null;
  vehicleType: TransportVehicleType | null;
  loadDescription: string;
  estimatedWeight: number | null;
  requestedDate: string;
}

interface TransportContextValue {
  state: TransportWizardState;
  setPickup: (address: string, city: string, lat: number, lng: number) => void;
  setDropoff: (address: string, city: string, lat: number, lng: number) => void;
  setVehicleType: (v: TransportVehicleType) => void;
  setLoadDescription: (v: string) => void;
  setEstimatedWeight: (v: number | null) => void;
  setRequestedDate: (v: string) => void;
  reset: () => void;
}

const INITIAL: TransportWizardState = {
  pickupAddress: '',
  pickupCity: '',
  pickupLat: null,
  pickupLng: null,
  dropoffAddress: '',
  dropoffCity: '',
  dropoffLat: null,
  dropoffLng: null,
  vehicleType: null,
  loadDescription: '',
  estimatedWeight: null,
  requestedDate: '',
};

const TransportContext = createContext<TransportContextValue | null>(null);

export function TransportProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<TransportWizardState>(INITIAL);

  return (
    <TransportContext.Provider
      value={{
        state,
        setPickup: (pickupAddress, pickupCity, pickupLat, pickupLng) =>
          setState((s) => ({ ...s, pickupAddress, pickupCity, pickupLat, pickupLng })),
        setDropoff: (dropoffAddress, dropoffCity, dropoffLat, dropoffLng) =>
          setState((s) => ({ ...s, dropoffAddress, dropoffCity, dropoffLat, dropoffLng })),
        setVehicleType: (vehicleType: TransportVehicleType) =>
          setState((s) => ({ ...s, vehicleType })),
        setLoadDescription: (loadDescription) => setState((s) => ({ ...s, loadDescription })),
        setEstimatedWeight: (estimatedWeight) => setState((s) => ({ ...s, estimatedWeight })),
        setRequestedDate: (requestedDate) => setState((s) => ({ ...s, requestedDate })),
        reset: () => setState(INITIAL),
      }}
    >
      {children}
    </TransportContext.Provider>
  );
}

export function useTransport(): TransportContextValue {
  const ctx = useContext(TransportContext);
  if (!ctx) throw new Error('useTransport must be used within TransportProvider');
  return ctx;
}

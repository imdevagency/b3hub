import React, { createContext, useContext, useState } from 'react';
import type { SkipHireOrder, SkipWasteCategory, SkipSize } from './api';

export interface WizardState {
  location: string;
  locationLat: number | null;
  locationLng: number | null;
  wasteCategory: SkipWasteCategory | null;
  skipSize: SkipSize | null;
  deliveryDate: string;
  confirmedOrder: SkipHireOrder | null;
  skipPaymentClientSecret: string | null;
}

interface OrderContextValue {
  state: WizardState;
  setLocation: (v: string) => void;
  setLocationWithCoords: (address: string, lat: number, lng: number) => void;
  setWasteCategory: (v: SkipWasteCategory) => void;
  setSkipSize: (v: SkipSize) => void;
  setDeliveryDate: (v: string) => void;
  setConfirmedOrder: (v: SkipHireOrder) => void;
  setSkipPaymentClientSecret: (v: string | null) => void;
  reset: () => void;
}

const INITIAL: WizardState = {
  location: '',
  locationLat: null,
  locationLng: null,
  wasteCategory: null,
  skipSize: null,
  deliveryDate: '',
  confirmedOrder: null,
  skipPaymentClientSecret: null,
};

const OrderContext = createContext<OrderContextValue | null>(null);

export function OrderProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<WizardState>(INITIAL);

  return (
    <OrderContext.Provider
      value={{
        state,
        setLocation: (location) => setState((s) => ({ ...s, location })),
        setLocationWithCoords: (location, locationLat, locationLng) =>
          setState((s) => ({ ...s, location, locationLat, locationLng })),
        setWasteCategory: (wasteCategory) => setState((s) => ({ ...s, wasteCategory })),
        setSkipSize: (skipSize) => setState((s) => ({ ...s, skipSize })),
        setDeliveryDate: (deliveryDate) => setState((s) => ({ ...s, deliveryDate })),
        setConfirmedOrder: (confirmedOrder) => setState((s) => ({ ...s, confirmedOrder })),
        setSkipPaymentClientSecret: (skipPaymentClientSecret) =>
          setState((s) => ({ ...s, skipPaymentClientSecret })),
        reset: () => setState(INITIAL),
      }}
    >
      {children}
    </OrderContext.Provider>
  );
}

export function useOrder(): OrderContextValue {
  const ctx = useContext(OrderContext);
  if (!ctx) throw new Error('useOrder must be used within OrderProvider');
  return ctx;
}

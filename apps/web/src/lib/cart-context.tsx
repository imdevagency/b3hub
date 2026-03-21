/**
 * CartContext & CartProvider.
 * Global React context for the material shopping cart — add/remove items,
 * update quantities, clear cart. Persisted in localStorage.
 */
'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ApiMaterial } from './api';

// ── Types ─────────────────────────────────────────────────────

export interface CartItem {
  material: ApiMaterial;
  quantity: number;
}

export interface AddItemResult {
  ok: boolean;
  reason?: 'mixed-supplier';
}

export const MIXED_SUPPLIER_CART_MESSAGE =
  'Vienā pasūtījumā var būt materiāli tikai no viena piegādātāja. Pabeidziet vai notīriet esošo grozu pirms pievienojat cita piegādātāja materiālus.';

interface CartContextValue {
  items: CartItem[];
  count: number; // total item lines
  totalQty: number; // sum of all quantities
  subtotal: number; // ex-VAT
  vat: number;
  total: number;
  activeSupplierId: string | null;
  activeSupplierName: string | null;
  hasMixedSuppliers: boolean;
  addItem: (material: ApiMaterial, qty: number) => AddItemResult;
  updateQty: (materialId: string, qty: number) => void;
  removeItem: (materialId: string) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

const LS_KEY = 'b3hub_cart';

// ── Provider ──────────────────────────────────────────────────

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage once mounted
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setItems(JSON.parse(raw) as CartItem[]);
    } catch {
      /* ignore */
    }

    setHydrated(true);
  }, []);

  // Persist to localStorage on change
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(items));
    } catch {
      /* ignore */
    }
  }, [items, hydrated]);

  const addItem = useCallback((material: ApiMaterial, qty: number): AddItemResult => {
    let result: AddItemResult = { ok: true };

    setItems((prev) => {
      const supplierIds = new Set(prev.map((item) => item.material.supplier.id));
      const existing = prev.find((item) => item.material.id === material.id);

      if (
        supplierIds.size > 1 ||
        (supplierIds.size === 1 && !supplierIds.has(material.supplier.id) && !existing)
      ) {
        result = { ok: false, reason: 'mixed-supplier' };
        return prev;
      }

      if (existing) {
        return prev.map((item) =>
          item.material.id === material.id ? { ...item, quantity: item.quantity + qty } : item,
        );
      }

      return [...prev, { material, quantity: qty }];
    });

    return result;
  }, []);

  const updateQty = useCallback((materialId: string, qty: number) => {
    if (qty <= 0) {
      setItems((prev) => prev.filter((i) => i.material.id !== materialId));
      return;
    }
    setItems((prev) =>
      prev.map((i) => (i.material.id === materialId ? { ...i, quantity: qty } : i)),
    );
  }, []);

  const removeItem = useCallback((materialId: string) => {
    setItems((prev) => prev.filter((i) => i.material.id !== materialId));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const subtotal = items.reduce((sum, i) => sum + i.material.basePrice * i.quantity, 0);
  const vat = subtotal * 0.21;
  const total = subtotal + vat;
  const totalQty = items.reduce((sum, i) => sum + i.quantity, 0);
  const supplierIds = Array.from(new Set(items.map((item) => item.material.supplier.id)));
  const hasMixedSuppliers = supplierIds.length > 1;
  const activeSupplierId = hasMixedSuppliers ? null : supplierIds[0] ?? null;
  const activeSupplierName =
    hasMixedSuppliers || items.length === 0 ? null : items[0]?.material.supplier.name ?? null;

  return (
    <CartContext.Provider
      value={{
        items,
        count: items.length,
        totalQty,
        subtotal,
        vat,
        total,
        activeSupplierId,
        activeSupplierName,
        hasMixedSuppliers,
        addItem,
        updateQty,
        removeItem,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}

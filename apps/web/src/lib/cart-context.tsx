/**
 * CartContext — shopping cart state for the web buyer experience.
 *
 * Items are persisted to localStorage so the cart survives page refreshes.
 * Wrap the app with <CartProvider> (already done in layout.tsx).
 * Consume via the useCart() hook.
 */
'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { MaterialUnit } from '@/lib/api/materials';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CartMaterial {
  id: string;
  name: string;
  unit: MaterialUnit;
  basePrice: number;
  minOrder?: number;
  supplier: {
    id: string;
    name: string;
    city?: string;
  };
}

export interface CartItem {
  material: CartMaterial;
  quantity: number;
}

interface CartContextValue {
  items: CartItem[];
  addItem: (material: CartMaterial, quantity: number) => void;
  updateQty: (materialId: string, quantity: number) => void;
  removeItem: (materialId: string) => void;
  clearCart: () => void;
  subtotal: number;
  vat: number;
  total: number;
  /** Name of the single supplier when all items are from one supplier */
  activeSupplierName: string;
  /** True when items span more than one supplier */
  hasMixedSuppliers: boolean;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = 'b3hub_cart_v1';
const VAT_RATE = 0.21;

// ─── Provider ─────────────────────────────────────────────────────────────────

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CartItem[];
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Corrupt storage — start fresh
    }
    return [];
  });
  const [hydrated, setHydrated] = useState(false);

  // Mark hydrated after first client render (deferred to avoid sync setState in effect)
  useEffect(() => {
    queueMicrotask(() => setHydrated(true));
  }, []);

  // Persist to localStorage whenever items change
  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, hydrated]);

  const addItem = useCallback((material: CartMaterial, quantity: number) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.material.id === material.id);
      if (existing) {
        return prev.map((i) =>
          i.material.id === material.id ? { ...i, quantity: i.quantity + quantity } : i,
        );
      }
      return [...prev, { material, quantity }];
    });
  }, []);

  const updateQty = useCallback((materialId: string, quantity: number) => {
    setItems((prev) => prev.map((i) => (i.material.id === materialId ? { ...i, quantity } : i)));
  }, []);

  const removeItem = useCallback((materialId: string) => {
    setItems((prev) => prev.filter((i) => i.material.id !== materialId));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  // Derived values
  const subtotal = items.reduce((sum, i) => sum + i.material.basePrice * i.quantity, 0);
  const vat = subtotal * VAT_RATE;
  const total = subtotal + vat;

  const supplierIds = Array.from(new Set(items.map((i) => i.material.supplier.id)));
  const hasMixedSuppliers = supplierIds.length > 1;
  const activeSupplierName =
    !hasMixedSuppliers && items.length > 0 ? (items[0]?.material.supplier.name ?? '') : '';

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        updateQty,
        removeItem,
        clearCart,
        subtotal,
        vat,
        total,
        activeSupplierName,
        hasMixedSuppliers,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>');
  return ctx;
}

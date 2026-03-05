'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useCart } from '@/lib/cart-context';
import { createCartOrder, type CartOrderItem } from '@/lib/api';
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  Minus,
  Package,
  Plus,
  ShoppingCart,
  Trash2,
} from 'lucide-react';

// ── Checkout page ─────────────────────────────────────────────────────────────

interface DeliveryForm {
  address: string;
  city: string;
  postal: string;
  date: string;
  notes: string;
}

export default function CheckoutPage() {
  const { user, token } = useAuth();
  const router = useRouter();
  const { items, updateQty, removeItem, clearCart, subtotal, vat, total } = useCart();

  const [form, setForm] = useState<DeliveryForm>({
    address: '',
    city: '',
    postal: '',
    date: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) router.push('/');
  }, [token, router]);

  // Redirect to catalog if cart is empty (after initial render)
  useEffect(() => {
    if (!saving && items.length === 0) {
      router.push('/dashboard/catalog');
    }
  }, [items, saving, router]);

  const set =
    (k: keyof DeliveryForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const companyId = user?.company?.id;
    if (!companyId) {
      setError('Jūsu konts nav saistīts ar uzņēmumu.');
      return;
    }
    if (!form.address || !form.city) {
      setError('Lūdzu norādiet piegādes adresi un pilsētu.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const orderItems: CartOrderItem[] = items.map((i) => ({
        materialId: i.material.id,
        quantity: i.quantity,
        unit: i.material.unit,
        unitPrice: i.material.basePrice,
      }));
      await createCartOrder(
        {
          buyerId: companyId,
          deliveryAddress: form.address,
          deliveryCity: form.city,
          deliveryPostal: form.postal || '0000',
          deliveryDate: form.date || undefined,
          notes: form.notes || undefined,
          items: orderItems,
        },
        token!,
      );
      clearCart();
      router.push('/dashboard/orders');
    } catch (err: any) {
      setError(err?.message ?? 'Kļūda veicot pasūtījumu. Mēģiniet vēlreiz.');
      setSaving(false);
    }
  };

  if (items.length === 0 && !saving) {
    return null; // redirect effect running
  }

  const UNIT_LABEL: Record<string, string> = {
    TONNE: 't',
    M3: 'm³',
    PIECE: 'gb.',
    LOAD: 'krāvums',
  };

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/catalog"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Atpakaļ uz katalogu
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <ShoppingCart className="size-6 text-red-600" />
          Norēķināties
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Pārbaudiet grozu un norādiet piegādes informāciju
        </p>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left col: cart items + delivery */}
        <div className="lg:col-span-2 space-y-6">
          {/* Cart items */}
          <div className="rounded-2xl border bg-card overflow-hidden">
            <div className="px-5 py-4 border-b">
              <h2 className="font-semibold flex items-center gap-2">
                <Package className="size-4 text-red-600" />
                Grozu saturs
              </h2>
            </div>
            <div className="divide-y">
              {items.map((item) => {
                const step =
                  item.material.unit === 'TONNE' || item.material.unit === 'M3' ? 0.5 : 1;
                const min = item.material.minOrder ?? step;
                const lineTotal = item.quantity * item.material.basePrice;
                return (
                  <div key={item.material.id} className="flex items-center gap-4 p-4">
                    {/* Material info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{item.material.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.material.supplier.name}
                        {item.material.supplier.city ? ` · ${item.material.supplier.city}` : ''}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        €{item.material.basePrice.toFixed(2)} / {UNIT_LABEL[item.material.unit]}
                      </p>
                    </div>

                    {/* Qty stepper */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          updateQty(
                            item.material.id,
                            Math.max(min, parseFloat((item.quantity - step).toFixed(2))),
                          )
                        }
                        disabled={item.quantity <= min}
                        className="rounded-lg border p-1.5 hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <Minus className="size-3.5" />
                      </button>
                      <span className="min-w-12 text-center text-sm font-semibold">
                        {item.quantity} {UNIT_LABEL[item.material.unit]}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          updateQty(item.material.id, parseFloat((item.quantity + step).toFixed(2)))
                        }
                        className="rounded-lg border p-1.5 hover:bg-muted transition-colors"
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </div>

                    {/* Line total */}
                    <div className="text-right shrink-0 min-w-20">
                      <p className="font-semibold text-sm">€{lineTotal.toFixed(2)}</p>
                    </div>

                    {/* Remove */}
                    <button
                      type="button"
                      onClick={() => removeItem(item.material.id)}
                      className="text-muted-foreground hover:text-red-600 transition-colors p-1 shrink-0"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Delivery form */}
          <div className="rounded-2xl border bg-card overflow-hidden">
            <div className="px-5 py-4 border-b">
              <h2 className="font-semibold">Piegādes informācija</h2>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Piegādes adrese *</label>
                <input
                  type="text"
                  placeholder="Iela, mājas numurs"
                  value={form.address}
                  onChange={set('address')}
                  required
                  className="w-full rounded-xl border bg-muted/30 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Pilsēta *</label>
                  <input
                    type="text"
                    placeholder="Rīga"
                    value={form.city}
                    onChange={set('city')}
                    required
                    className="w-full rounded-xl border bg-muted/30 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Pasta indekss</label>
                  <input
                    type="text"
                    placeholder="LV-1001"
                    value={form.postal}
                    onChange={set('postal')}
                    className="w-full rounded-xl border bg-muted/30 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Vēlamais piegādes datums</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={set('date')}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full rounded-xl border bg-muted/30 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Piezīmes</label>
                <textarea
                  rows={3}
                  placeholder="Piegādes instrukcijas, kontaktpersona, darba laiki..."
                  value={form.notes}
                  onChange={set('notes')}
                  className="w-full rounded-xl border bg-muted/30 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right col: order summary */}
        <div className="space-y-4">
          <div className="rounded-2xl border bg-card overflow-hidden sticky top-20">
            <div className="px-5 py-4 border-b">
              <h2 className="font-semibold">Pasūtījuma kopsavilkums</h2>
            </div>
            <div className="p-5 space-y-3">
              {/* Per-line summary */}
              <div className="space-y-1.5 text-sm">
                {items.map((item) => (
                  <div key={item.material.id} className="flex justify-between gap-2">
                    <span className="text-muted-foreground truncate">
                      {item.material.name} × {item.quantity}
                      {UNIT_LABEL[item.material.unit]}
                    </span>
                    <span className="shrink-0 font-medium">
                      €{(item.quantity * item.material.basePrice).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-t pt-3 space-y-1.5 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Starpsumma</span>
                  <span>€{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>PVN 21%</span>
                  <span>€{vat.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-base border-t pt-2 mt-1">
                  <span>Kopā</span>
                  <span className="text-red-600">€{total.toFixed(2)}</span>
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={saving || items.length === 0}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 font-bold text-white hover:bg-red-700 disabled:opacity-50 transition-colors mt-2"
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ArrowRight className="size-4" />
                )}
                {saving ? 'Apstiprina...' : 'Apstiprināt pasūtījumu'}
              </button>

              <p className="text-xs text-center text-muted-foreground">
                Pasūtot jūs piekrītat B3Hub lietošanas noteikumiem
              </p>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

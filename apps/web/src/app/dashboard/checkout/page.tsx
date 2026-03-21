/**
 * Checkout page — /dashboard/checkout
 * Summarises the cart, collects delivery address, and places a material order.
 */
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useCart } from '@/lib/cart-context';
import { createCartOrder, type CartOrderItem } from '@/lib/api';
import { AddressAutocomplete, type PlaceAddress } from '@/components/ui/AddressAutocomplete';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  Minus,
  Package,
  Plus,
  ShoppingCart,
  Trash2,
  AlertTriangle,
} from 'lucide-react';

// ── Checkout page ─────────────────────────────────────────────────────────────

interface DeliveryForm {
  address: string;
  city: string;
  postal: string;
  date: string;
  notes: string;
  siteContactName: string;
  siteContactPhone: string;
}

export default function CheckoutPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const {
    items,
    updateQty,
    removeItem,
    clearCart,
    subtotal,
    vat,
    total,
    activeSupplierName,
    hasMixedSuppliers,
  } = useCart();

  const [form, setForm] = useState<DeliveryForm>({
    address: '',
    city: '',
    postal: '',
    date: '',
    notes: '',
    siteContactName: '',
    siteContactPhone: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [splitDialogOpen, setSplitDialogOpen] = useState(false);
  const supplierNames = Array.from(new Set(items.map((item) => item.material.supplier.name)));
  const supplierMap = new Map<string, typeof items>();

  // Group items by supplier
  Array.from(new Set(items.map((item) => item.material.supplier.id))).forEach((supplierId) => {
    const supplierItems = items.filter((item) => item.material.supplier.id === supplierId);
    const supplierName = supplierItems[0]?.material.supplier.name || '';
    supplierMap.set(supplierName, supplierItems);
  });

  useEffect(() => {
    if (!isLoading && !token) router.push('/');
  }, [token, isLoading, router]);

  // Redirect to catalog if cart is empty (after initial render)
  useEffect(() => {
    if (!saving && items.length === 0) {
      router.push('/dashboard/catalog');
    }
  }, [items, saving, router]);

  const set =
    (k: keyof DeliveryForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleAddressSelect = (place: PlaceAddress) => {
    setForm((f) => ({
      ...f,
      address: place.address,
      city: place.city || f.city,
      postal: place.postal || f.postal,
    }));
  };

  const handleSplitCart = (supplierName: string) => {
    // Remove all items NOT from this supplier
    const itemsToKeep = supplierMap.get(supplierName) || [];
    const itemsToRemove = items.filter(
      (item) => !itemsToKeep.find((keep) => keep.material.id === item.material.id),
    );
    itemsToRemove.forEach((item) => removeItem(item.material.id));

    setSplitDialogOpen(false);
  };

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
    if (hasMixedSuppliers) {
      setSplitDialogOpen(true);
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
          deliveryAddress: form.address,
          deliveryCity: form.city,
          deliveryPostal: form.postal || '0000',
          deliveryDate: form.date || undefined,
          notes: form.notes || undefined,
          siteContactName: form.siteContactName || undefined,
          siteContactPhone: form.siteContactPhone || undefined,
          items: orderItems,
        },
        token!,
      );
      clearCart();
      router.push('/dashboard/orders');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Kļūda veicot pasūtījumu. Mēģiniet vēlreiz.');
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
      {/* Split cart dialog */}
      <Dialog open={splitDialogOpen} onOpenChange={setSplitDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-600" />
              Grozs satur vairākus piegādātājus
            </DialogTitle>
            <DialogDescription>
              Vienu pasūtījumu var iesniegt tikai vienam piegādātājam. Izvēlieties piegādātāju,
              ar kuru vēlaties turpināt. Citu piegādātāju materiāli tiks noņemti no šī pasūtījuma.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            {supplierNames.map((supplier) => {
              const supplierItems = supplierMap.get(supplier) || [];
              const supplierTotal = supplierItems.reduce(
                (sum, item) => sum + item.quantity * item.material.basePrice,
                0,
              );
              return (
                <div key={supplier} className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-sm">{supplier}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {supplierItems.length} materiāli
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-sm">€{supplierTotal.toFixed(2)}</p>
                    </div>
                  </div>

                  <ul className="text-xs text-muted-foreground space-y-1 max-h-20 overflow-y-auto">
                    {supplierItems.map((item) => (
                      <li key={item.material.id}>
                        • {item.material.name} ({item.quantity}{' '}
                        {UNIT_LABEL[item.material.unit]})
                      </li>
                    ))}
                  </ul>

                  <Button
                    onClick={() => handleSplitCart(supplier)}
                    variant="default"
                    size="sm"
                    className="w-full"
                  >
                    Turpināt ar šo piegādātāju
                  </Button>
                </div>
              );
            })}
          </div>

          <div className="pt-4 border-t text-xs text-muted-foreground space-y-1">
            <p>💡 Padoms: Pēc šī pasūtījuma iesūtīšanas, jūs varat sākt jaunu grozu ar citiem piegādātāju materiāliem.</p>
          </div>
        </DialogContent>
      </Dialog>

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
        {activeSupplierName && !hasMixedSuppliers && (
          <p className="text-sm text-muted-foreground mt-2">
            Šis pasūtījums tiks nosūtīts piegādātājam {activeSupplierName}.
          </p>
        )}
      </div>

      {hasMixedSuppliers && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-semibold text-amber-900 flex items-center gap-2">
            <AlertTriangle className="size-4 flex-shrink-0" />
            Jūsu grozs satur materiālus no vairākiem piegādātājiem
          </p>
          <p className="mt-2 text-sm text-amber-800">
            Vienu pasūtījumu var iesniegt tikai vienam piegādātājam. Nospiediet &quot;Apstiprināt
            pasūtījumu&quot;, un mēs palīdzēsim jums izvēlēties piegādātāju.
          </p>
          <p className="mt-2 text-xs text-amber-700">
            Atrastie piegādātāji: {supplierNames.join(', ')}
          </p>
        </div>
      )}

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
                <AddressAutocomplete
                  value={form.address}
                  onChange={(v) => setForm((f) => ({ ...f, address: v }))}
                  onSelect={handleAddressSelect}
                  placeholder="Sākt rakstīt adresi..."
                  required
                  className="w-full rounded-xl border bg-muted/30 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
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
                    className="w-full rounded-xl border bg-muted/30 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Pasta indekss</label>
                  <input
                    type="text"
                    placeholder="LV-1001"
                    value={form.postal}
                    onChange={set('postal')}
                    className="w-full rounded-xl border bg-muted/30 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
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
                  className="w-full rounded-xl border bg-muted/30 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Piezīmes</label>
                <textarea
                  rows={3}
                  placeholder="Piegādes instrukcijas, darba laiki..."
                  value={form.notes}
                  onChange={set('notes')}
                  className="w-full rounded-xl border bg-muted/30 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                />
              </div>

              {/* Site contact */}
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-4 space-y-3">
                <div>
                  <p className="text-sm font-semibold text-slate-700">Objekta kontaktpersona</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Šoferis var sazināties ar šo personu piegādes brīdī
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1 text-slate-600">
                      Vārds, uzvārds
                    </label>
                    <input
                      type="text"
                      placeholder="Jānis Bērziņš"
                      value={form.siteContactName}
                      onChange={set('siteContactName')}
                      className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1 text-slate-600">
                      Tālrunis
                    </label>
                    <input
                      type="tel"
                      placeholder="+371 20 000 000"
                      value={form.siteContactPhone}
                      onChange={set('siteContactPhone')}
                      className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                </div>
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
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors mt-2"
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

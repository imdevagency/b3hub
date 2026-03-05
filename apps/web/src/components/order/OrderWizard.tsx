'use client';

import { useState } from 'react';
import { Package, MapPin, CalendarDays, ClipboardList, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createSkipHireOrder, mapWasteCategory, mapSkipSize, type SkipHireOrder } from '@/lib/api';
import { Step1Container } from './steps/Step1Container';
import { Step2Address } from './steps/Step2Address';
import { Step3DateOffers, type Offer } from './steps/Step3DateOffers';
import { Step4ContactForm } from './steps/Step4ContactForm';
import { OrderConfirmation } from './OrderConfirmation';

// ── Steps meta ────────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: 'Konteiners', icon: Package },
  { id: 2, label: 'Adrese', icon: MapPin },
  { id: 3, label: 'Datums & Cenas', icon: CalendarDays },
  { id: 4, label: 'Apstiprināt', icon: ClipboardList },
] as const;

// ── Wizard state ──────────────────────────────────────────────────────────────

interface WizardState {
  size: string;
  wasteType: string;
  address: string;
  lat?: number;
  lng?: number;
  deliveryDate: string;
  hirePeriodDays: number;
  selectedOfferId: string;
  selectedOffer: Offer | null;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  notes: string;
}

const INITIAL: WizardState = {
  size: '',
  wasteType: '',
  address: '',
  deliveryDate: '',
  hirePeriodDays: 14,
  selectedOfferId: '',
  selectedOffer: null,
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  notes: '',
};

// ── Component ─────────────────────────────────────────────────────────────────

export function OrderWizard({ token }: { token?: string } = {}) {
  const [step, setStep] = useState(1);
  const [state, setState] = useState<WizardState>(INITIAL);
  const [animating, setAnimating] = useState(false);
  const [direction, setDirection] = useState<'fwd' | 'bck'>('fwd');
  const [confirmedOrder, setConfirmedOrder] = useState<SkipHireOrder | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  function navigate(to: number) {
    if (animating) return;
    setDirection(to > step ? 'fwd' : 'bck');
    setAnimating(true);
    setTimeout(() => {
      setStep(to);
      setAnimating(false);
    }, 200);
  }

  function patch(updates: Partial<WizardState>) {
    setState((s) => ({ ...s, ...updates }));
  }

  function handleOfferSelect(id: string, offers: Offer[]) {
    const found = offers.find((o) => o.id === id) ?? null;
    patch({ selectedOfferId: id, selectedOffer: found });
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError('');
    try {
      const result = await createSkipHireOrder(
        {
          location: state.address,
          wasteCategory: mapWasteCategory(state.wasteType),
          skipSize: mapSkipSize(state.size),
          deliveryDate: state.deliveryDate,
          carrierId: state.selectedOffer?.id ?? undefined,
          contactName: state.contactName,
          contactEmail: state.contactEmail,
          contactPhone: state.contactPhone,
          notes: state.notes || undefined,
        },
        token,
      );
      setAnimating(true);
      setTimeout(() => {
        setConfirmedOrder(result);
        setAnimating(false);
      }, 200);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Kaut kas nogāja greizi. Lūdzu, mēģiniet vēlreiz.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleReset() {
    setConfirmedOrder(null);
    setState(INITIAL);
    setStep(1);
    setSubmitError('');
  }

  // ── Animation class ───────────────────────────────────────────────────────

  const slideClass = animating
    ? direction === 'fwd'
      ? 'opacity-0 translate-x-6'
      : 'opacity-0 -translate-x-6'
    : 'opacity-100 translate-x-0';

  const progressPct = confirmedOrder ? 100 : ((step - 1) / STEPS.length) * 100;

  return (
    <div className="w-full">
      <div className="rounded-2xl bg-white shadow-xl border border-gray-100 overflow-hidden">
        {/* ── Step header ───────────────────────────────────────────────────── */}
        {!confirmedOrder && (
          <div className="px-6 sm:px-8 pt-7 pb-5 border-b border-gray-100">
            <div className="relative flex items-start justify-between">
              <div className="absolute left-0 right-0 top-5 h-0.5 bg-gray-200" />
              <div
                className="absolute left-0 top-5 h-0.5 bg-red-500 transition-all duration-500 ease-out"
                style={{ width: `${progressPct}%` }}
              />
              {STEPS.map((s) => {
                const Icon = s.icon;
                const done = step > s.id;
                const active = step === s.id;
                return (
                  <div key={s.id} className="relative flex flex-col items-center gap-2 z-10">
                    <button
                      onClick={() => done && navigate(s.id)}
                      disabled={!done}
                      className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300',
                        done
                          ? 'border-red-500 bg-red-500 cursor-pointer hover:bg-red-600'
                          : active
                            ? 'border-red-500 bg-white ring-4 ring-red-100'
                            : 'border-gray-300 bg-white cursor-default',
                      )}
                    >
                      {done ? (
                        <Check className="h-5 w-5 text-white" />
                      ) : (
                        <Icon
                          className={cn('h-4 w-4', active ? 'text-red-600' : 'text-gray-400')}
                        />
                      )}
                    </button>
                    <span
                      className={cn(
                        'text-xs font-semibold whitespace-nowrap transition-colors hidden sm:block',
                        done ? 'text-red-600' : active ? 'text-gray-900' : 'text-gray-400',
                      )}
                    >
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Body ─────────────────────────────────────────────────────────── */}
        <div className="px-6 sm:px-8 py-7">
          {submitError && !confirmedOrder && (
            <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              <span className="font-semibold">Kļūda:</span> {submitError}
            </div>
          )}

          <div className={cn('transition-all duration-200 ease-in-out', slideClass)}>
            {confirmedOrder ? (
              <OrderConfirmation
                orderNumber={confirmedOrder.orderNumber}
                location={confirmedOrder.location}
                wasteCategory={confirmedOrder.wasteCategory}
                skipSize={confirmedOrder.skipSize}
                deliveryDate={confirmedOrder.deliveryDate}
                price={confirmedOrder.price}
                currency={confirmedOrder.currency}
                onReset={handleReset}
                authenticated={!!token}
              />
            ) : step === 1 ? (
              <Step1Container
                size={state.size}
                wasteType={state.wasteType}
                onSizeChange={(v) => patch({ size: v })}
                onWasteChange={(v) => patch({ wasteType: v })}
                onNext={() => navigate(2)}
              />
            ) : step === 2 ? (
              <Step2Address
                value={state.address}
                onAddressChange={(addr, lat, lng) => patch({ address: addr, lat, lng })}
                onNext={() => navigate(3)}
                onBack={() => navigate(1)}
              />
            ) : step === 3 ? (
              <Step3DateOffers
                size={state.size}
                location={state.address}
                deliveryDate={state.deliveryDate}
                hirePeriodDays={state.hirePeriodDays}
                selectedOffer={state.selectedOfferId}
                onDeliveryDateChange={(d) =>
                  patch({ deliveryDate: d, selectedOfferId: '', selectedOffer: null })
                }
                onHirePeriodChange={(d) => patch({ hirePeriodDays: d })}
                onOfferSelect={(id, offers) => handleOfferSelect(id, offers)}
                onNext={() => navigate(4)}
                onBack={() => navigate(2)}
              />
            ) : (
              <Step4ContactForm
                name={state.contactName}
                email={state.contactEmail}
                phone={state.contactPhone}
                notes={state.notes}
                summary={{
                  size: state.size,
                  wasteType: state.wasteType,
                  address: state.address,
                  deliveryDate: state.deliveryDate,
                  hirePeriodDays: state.hirePeriodDays,
                  offerCarrier: state.selectedOffer?.carrier ?? '',
                  offerPrice: state.selectedOffer?.price ?? 0,
                }}
                onChange={(k, v) =>
                  patch({
                    contactName: k === 'name' ? v : state.contactName,
                    contactEmail: k === 'email' ? v : state.contactEmail,
                    contactPhone: k === 'phone' ? v : state.contactPhone,
                    notes: k === 'notes' ? v : state.notes,
                  })
                }
                onSubmit={handleSubmit}
                onBack={() => navigate(3)}
                submitting={submitting}
                error={submitError}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

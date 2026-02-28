'use client';

import { useState } from 'react';
import { MapPin, Trash2, Package, CalendarDays, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createSkipHireOrder, mapWasteCategory, mapSkipSize, type SkipHireOrder } from '@/lib/api';
import { Step1Location } from './steps/Step1Location';
import { Step2WasteType } from './steps/Step2WasteType';
import { Step3Size } from './steps/Step3Size';
import { Step4Date } from './steps/Step4Date';
import { OrderConfirmation } from './OrderConfirmation';

const STEPS = [
  { id: 1, label: 'Location', shortLabel: 'Location', icon: MapPin },
  { id: 2, label: 'Waste Type', shortLabel: 'Waste', icon: Trash2 },
  { id: 3, label: 'Skip Size', shortLabel: 'Size', icon: Package },
  { id: 4, label: 'Date', shortLabel: 'Date', icon: CalendarDays },
] as const;

const TOTAL_STEPS = STEPS.length;

interface OrderState {
  location: string;
  wasteType: string;
  size: string;
  date: string;
}

export function OrderWizard() {
  const [currentStep, setCurrentStep] = useState(1);
  const [confirmedOrder, setConfirmedOrder] = useState<SkipHireOrder | null>(null);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');
  const [animating, setAnimating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderState>({
    location: '',
    wasteType: '',
    size: '',
    date: '',
  });

  const progressPercent = ((currentStep - 1) / TOTAL_STEPS) * 100;

  function navigate(to: number) {
    if (animating) return;
    setDirection(to > currentStep ? 'forward' : 'backward');
    setAnimating(true);
    setTimeout(() => {
      setCurrentStep(to);
      setAnimating(false);
    }, 220);
  }

  async function handleNext() {
    if (currentStep < TOTAL_STEPS) {
      navigate(currentStep + 1);
      return;
    }

    // Final step — POST to backend
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await createSkipHireOrder({
        location: order.location,
        wasteCategory: mapWasteCategory(order.wasteType),
        skipSize: mapSkipSize(order.size),
        deliveryDate: order.date,
      });
      setAnimating(true);
      setTimeout(() => {
        setConfirmedOrder(result);
        setAnimating(false);
      }, 220);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Something went wrong. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleBack() {
    if (currentStep > 1) navigate(currentStep - 1);
  }

  function handleReset() {
    setConfirmedOrder(null);
    setCurrentStep(1);
    setSubmitError(null);
    setOrder({ location: '', wasteType: '', size: '', date: '' });
  }

  const slideClass = animating
    ? direction === 'forward'
      ? 'opacity-0 translate-x-6'
      : 'opacity-0 -translate-x-6'
    : 'opacity-100 translate-x-0';

  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* Card shell */}
      <div className="rounded-2xl bg-white shadow-xl border border-gray-100 overflow-hidden">
        {/* ── Header ── */}
        {!confirmedOrder && (
          <div className="px-8 pt-8 pb-6 border-b border-gray-100">
            {/* Step labels row */}
            <div className="relative flex items-center justify-between">
              {/* Connector line (behind everything) */}
              <div className="absolute left-0 right-0 top-5 h-0.5 bg-gray-200" aria-hidden />
              {/* Active progress fill */}
              <div
                className="absolute left-0 top-5 h-0.5 bg-red-500 transition-all duration-500 ease-out"
                style={{ width: `${progressPercent}%` }}
                aria-hidden
              />

              {STEPS.map((step) => {
                const Icon = step.icon;
                const isCompleted = currentStep > step.id;
                const isActive = currentStep === step.id;

                return (
                  <div key={step.id} className="relative flex flex-col items-center gap-2 z-10">
                    {/* Circle */}
                    <button
                      onClick={() => {
                        // Allow clicking completed steps to go back
                        if (isCompleted) navigate(step.id);
                      }}
                      disabled={!isCompleted}
                      className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300',
                        isCompleted
                          ? 'border-red-500 bg-red-500 cursor-pointer hover:bg-red-600'
                          : isActive
                            ? 'border-red-500 bg-white ring-4 ring-red-100'
                            : 'border-gray-300 bg-white cursor-default',
                      )}
                    >
                      {isCompleted ? (
                        <Check className="h-5 w-5 text-white" />
                      ) : (
                        <Icon
                          className={cn('h-4 w-4', isActive ? 'text-red-600' : 'text-gray-400')}
                        />
                      )}
                    </button>

                    {/* Label */}
                    <span
                      className={cn(
                        'hidden sm:block text-xs font-semibold transition-colors',
                        isCompleted ? 'text-red-600' : isActive ? 'text-gray-900' : 'text-gray-400',
                      )}
                    >
                      {step.label}
                    </span>
                    <span
                      className={cn(
                        'sm:hidden text-xs font-semibold transition-colors',
                        isCompleted ? 'text-red-600' : isActive ? 'text-gray-900' : 'text-gray-400',
                      )}
                    >
                      {step.shortLabel}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Progress bar */}
            <div className="mt-6 h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-linear-to-r from-red-500 to-red-600 transition-all duration-500 ease-out"
                style={{ width: `${progressPercent + 100 / TOTAL_STEPS}%` }}
              />
            </div>

            {/* Step counter */}
            <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
              <span>
                Step {currentStep} of {TOTAL_STEPS}
              </span>
              <span>{Math.round((currentStep / TOTAL_STEPS) * 100)}% complete</span>
            </div>
          </div>
        )}

        {/* ── Body ── */}
        <div className="px-6 sm:px-10 py-8">
          {/* API error banner */}
          {submitError && (
            <div className="mb-6 flex items-center gap-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              <span className="font-semibold">Error:</span> {submitError}
            </div>
          )}

          <div className={cn('transition-all duration-220 ease-in-out', slideClass)}>
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
              />
            ) : currentStep === 1 ? (
              <Step1Location
                value={order.location}
                onChange={(v) => setOrder((o) => ({ ...o, location: v }))}
                onNext={handleNext}
              />
            ) : currentStep === 2 ? (
              <Step2WasteType
                value={order.wasteType}
                onChange={(v) => setOrder((o) => ({ ...o, wasteType: v }))}
                onNext={handleNext}
                onBack={handleBack}
              />
            ) : currentStep === 3 ? (
              <Step3Size
                value={order.size}
                onChange={(v) => setOrder((o) => ({ ...o, size: v }))}
                onNext={handleNext}
                onBack={handleBack}
              />
            ) : (
              <Step4Date
                value={order.date}
                onChange={(v) => setOrder((o) => ({ ...o, date: v }))}
                onNext={handleNext}
                onBack={handleBack}
                submitting={submitting}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

/**
 * Public foreman delivery-details page — /share/[token]
 * No authentication required.
 * The project manager shares this link with the site foreman who fills in
 * the exact delivery address and site contact before the order is confirmed.
 */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import {
  fetchTrackingData,
  updateDeliveryDetails,
  type TrackingData,
  type UpdateDeliveryPayload,
} from '@/lib/api/tracking';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { MapPin, Package, Phone, User, CheckCircle2, AlertCircle } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

type FormValues = {
  deliveryAddress: string;
  deliveryCity: string;
  deliveryPostal: string;
  siteContactName: string;
  siteContactPhone: string;
  notes: string;
};

// ─── Page ────────────────────────────────────────────────────────────────────

export default function SharePage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [order, setOrder] = useState<TrackingData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>();

  useEffect(() => {
    if (!token) return;
    fetchTrackingData(token)
      .then((data) => {
        setOrder(data);
        // Pre-fill form with any already-saved values
        setValue('deliveryAddress', data.deliveryAddress ?? '');
        setValue('deliveryCity', data.deliveryCity ?? '');
      })
      .catch(() => setLoadError('Saite nav derīga vai ir beigusies.'));
  }, [token, setValue]);

  const onSubmit = async (values: FormValues) => {
    setSubmitError(null);
    const payload: UpdateDeliveryPayload = {};
    if (values.deliveryAddress?.trim()) payload.deliveryAddress = values.deliveryAddress.trim();
    if (values.deliveryCity?.trim()) payload.deliveryCity = values.deliveryCity.trim();
    if (values.deliveryPostal?.trim()) payload.deliveryPostal = values.deliveryPostal.trim();
    if (values.siteContactName?.trim()) payload.siteContactName = values.siteContactName.trim();
    if (values.siteContactPhone?.trim()) payload.siteContactPhone = values.siteContactPhone.trim();
    if (values.notes?.trim()) payload.notes = values.notes.trim();

    try {
      await updateDeliveryDetails(token, payload);
      setSubmitted(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown';
      if (message === 'bad_request') {
        setSubmitError('Pasūtījums vairs nav rediģējams — tas jau ir apstiprināts vai atcelts.');
      } else if (message === 'not_found') {
        setSubmitError('Saite nav derīga vai ir beigusies.');
      } else {
        setSubmitError('Kļūda saglabājot. Lūdzu mēģiniet vēlreiz.');
      }
    }
  };

  // ── Loading skeleton ──────────────────────────────────────────────────────

  if (!order && !loadError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-lg space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────────

  if (loadError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-6 space-y-3">
            <AlertCircle className="h-10 w-10 text-red-500 mx-auto" />
            <p className="font-medium text-gray-900">{loadError}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Success state ─────────────────────────────────────────────────────────

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-6 space-y-4">
            <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
            <div>
              <p className="text-lg font-semibold text-gray-900">Piegādes dati saglabāti</p>
              <p className="text-sm text-gray-500 mt-1">
                Projekta vadītājs saņems paziņojumu ar ievadītajiem datiem.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Main form ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="mx-auto max-w-lg space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-gray-900">Piegādes datu ievade</h1>
          <p className="text-sm text-gray-500 mt-1">
            Aizpildiet laukus, lai projekta vadītājs varētu ieplānot piegādi.
          </p>
        </div>

        {/* Order summary */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Pasūtījums {order!.orderNumber}</CardTitle>
              <Badge variant="secondary">{order!.status}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {order!.items.map((item, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <Package className="h-4 w-4 mt-0.5 text-gray-400 shrink-0" />
                <span className="text-gray-700">
                  {item.quantity} {item.unit} — {item.material.name}
                </span>
              </div>
            ))}
            {order!.deliveryDate && (
              <div className="flex items-center gap-2 text-sm text-gray-500 pt-1">
                <MapPin className="h-4 w-4 text-gray-400 shrink-0" />
                <span>Piegāde ap: {new Date(order!.deliveryDate).toLocaleDateString('lv-LV')}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Delivery form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Piegādes adrese</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="deliveryAddress">Iela un mājas nr. *</Label>
                <Input
                  id="deliveryAddress"
                  placeholder="Brīvības iela 42"
                  {...register('deliveryAddress', { required: 'Lauks ir obligāts' })}
                />
                {errors.deliveryAddress && (
                  <p className="text-xs text-red-500">{errors.deliveryAddress.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="deliveryCity">Pilsēta *</Label>
                  <Input
                    id="deliveryCity"
                    placeholder="Rīga"
                    {...register('deliveryCity', { required: 'Lauks ir obligāts' })}
                  />
                  {errors.deliveryCity && (
                    <p className="text-xs text-red-500">{errors.deliveryCity.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="deliveryPostal">Pasta indekss</Label>
                  <Input
                    id="deliveryPostal"
                    placeholder="LV-1010"
                    {...register('deliveryPostal')}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="siteContactName" className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" />
                  Kontaktpersona laukumā
                </Label>
                <Input
                  id="siteContactName"
                  placeholder="Jānis Bērziņš"
                  {...register('siteContactName')}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="siteContactPhone" className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" />
                  Tālrunis laukumā
                </Label>
                <Input
                  id="siteContactPhone"
                  type="tel"
                  placeholder="+371 2X XXX XXX"
                  {...register('siteContactPhone')}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="notes">Piezīmes (iekļūšana, vārti utt.)</Label>
                <Textarea
                  id="notes"
                  placeholder="Vārti no kreisās puses, zvanīt 10 min iepriekš..."
                  rows={3}
                  {...register('notes')}
                />
              </div>

              {submitError && (
                <div className="flex items-center gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {submitError}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Saglabā...' : 'Saglabāt piegādes datus'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

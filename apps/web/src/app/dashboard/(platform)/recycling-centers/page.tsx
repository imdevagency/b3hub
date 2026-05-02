/**
 * Recycling centers page — /dashboard/recycling-centers
 * Map and list view of nearby recycling facilities with accepted material types.
 */
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getRecyclingCenters, getMyRecyclingCenters } from '@/lib/api';
import { Building2, MapPin, Recycle, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';

interface RecyclingCenterCompany {
  id: string;
  name: string;
  logo?: string;
  city?: string;
}

interface RecyclingCenter {
  id: string;
  name: string;
  address: string;
  city?: string;
  state?: string;
  postalCode?: string;
  acceptedWasteTypes: string[];
  operatingHours?: Record<string, string>;
  capacity?: number;
  certifications?: string[];
  active: boolean;
  company?: RecyclingCenterCompany;
  _count?: { wasteRecords: number };
}

interface RecyclingCentersResponse {
  data: RecyclingCenter[];
  meta: { page: number; limit: number; total: number };
}

const WASTE_TYPE_LABELS: Record<string, string> = {
  CONSTRUCTION: 'Būvgružu atkritumi',
  HAZARDOUS: 'Bīstamie atkritumi',
  ORGANIC: 'Organiskie atkritumi',
  METAL: 'Metāli',
  PLASTIC: 'Plastmasa',
  GLASS: 'Stikls',
  PAPER: 'Papīrs',
  ELECTRONICS: 'Elektronika',
  GENERAL: 'Sadzīves atkritumi',
};

export default function RecyclingCentersPage() {
  const { user, token } = useAuth();
  const router = useRouter();
  const [centers, setCenters] = useState<RecyclingCenter[]>([]);
  const [mineCenters, setMineCenters] = useState<RecyclingCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'all' | 'mine'>('all');

  const isCarrier = user?.canTransport && user?.isCompany;

  useEffect(() => {
    if (!token) return;

    const promises: Promise<void>[] = [
      getRecyclingCenters(token).then((res) => {
        const data =
          (res as unknown as RecyclingCentersResponse).data ??
          (res as unknown as RecyclingCenter[]);
        setCenters(data);
      }),
    ];

    if (isCarrier) {
      promises.push(
        getMyRecyclingCenters(token).then((data) => {
          setMineCenters(data as unknown as RecyclingCenter[]);
        }),
      );
    }

    Promise.all(promises)
      .catch(() => setError('Neizdevās ielādēt utilizācijas centrus'))
      .finally(() => setLoading(false));
  }, [token, isCarrier]);

  const displayCenters = tab === 'mine' ? mineCenters : centers;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="Utilizācijas Centri"
        description="Reģistrētie atkritumu utilizācijas centri Latvijā"
      />

      {/* Tabs */}
      {isCarrier && (
        <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit mb-6">
          <button
            onClick={() => setTab('all')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === 'all'
                ? 'bg-background shadow text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Visi centri ({centers.length})
          </button>
          <button
            onClick={() => setTab('mine')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === 'mine'
                ? 'bg-background shadow text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Mani centri ({mineCenters.length})
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Ielādē...</div>
      ) : error ? (
        <div className="text-center py-16 text-destructive">{error}</div>
      ) : displayCenters.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <Recycle className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">
            {tab === 'mine'
              ? 'Jums vēl nav reģistrētu utilizācijas centru'
              : 'Nav atrasts neviens utilizācijas centrs'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {displayCenters.map((center) => (
            <div
              key={center.id}
              className="rounded-xl border border-border bg-card p-4 hover:border-primary/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <h3 className="font-semibold text-base">{center.name}</h3>
                  {center.company && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Building2 className="h-3 w-3" />
                      {center.company.name}
                    </p>
                  )}
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    center.active
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {center.active ? 'Aktīvs' : 'Neaktīvs'}
                </span>
              </div>

              <div className="space-y-1.5 text-sm text-muted-foreground mb-3">
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">
                    {center.address}
                    {center.city ? `, ${center.city}` : ''}
                  </span>
                </div>
                {center._count !== undefined && (
                  <div className="flex items-center gap-1.5">
                    <Recycle className="h-3.5 w-3.5 shrink-0" />
                    <span>{center._count.wasteRecords} atkritumu ieraksti</span>
                  </div>
                )}
              </div>

              {/* Waste types */}
              {center.acceptedWasteTypes.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {center.acceptedWasteTypes.slice(0, 4).map((type) => (
                    <span key={type} className="text-xs bg-muted px-2 py-0.5 rounded-full">
                      {WASTE_TYPE_LABELS[type] ?? type}
                    </span>
                  ))}
                  {center.acceptedWasteTypes.length > 4 && (
                    <span className="text-xs text-muted-foreground px-2 py-0.5">
                      +{center.acceptedWasteTypes.length - 4} vēl
                    </span>
                  )}
                </div>
              )}

              {center.active && (
                <Button
                  size="sm"
                  className="w-full h-8 text-xs"
                  onClick={() => router.push('/dashboard/order/disposal')}
                >
                  <Truck className="h-3.5 w-3.5 mr-1.5" /> Pasūtīt izvešanu
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

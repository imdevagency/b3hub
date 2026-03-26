/**
 * Available transport jobs page — /dashboard/jobs
 * Lists open haulage jobs that a carrier can accept, with distance and load details.
 */
'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  ChevronDown,
  ChevronUp,
  MapPin,
  Truck,
  Ruler,
  X,
  Bookmark,
  BookmarkCheck,
  RefreshCw,
  SlidersHorizontal,
  Plus,
  AlertTriangle,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';
import { PageSpinner } from '@/components/ui/page-spinner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/lib/auth-context';
import {
  acceptTransportJob,
  assignTransportJob,
  createTransportJob,
  type ApiTransportJob,
  type CreateTransportJobInput,
} from '@/lib/api';
import { useAvailableJobs } from '@/hooks/use-available-jobs';
import { getGoogleMapsPublicKey } from '@/lib/google-maps-key';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { CalendarDays, Users, CircleCheck } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface TransportJob {
  id: string;
  jobNumber: string;
  vehicleType: string;
  payload: string;
  weightTonnes: number;
  fromCity: string;
  fromAddress: string;
  fromLat: number;
  fromLng: number;
  toCity: string;
  toAddress: string;
  toLat: number;
  toLng: number;
  distanceKm: number;
  date: string;
  time: string;
  priceTotal: number;
  pricePerTonne: number;
  currency: string;
}

interface SearchFilter {
  fromLocation: string;
  fromRadius: number;
  toLocation: string;
  toRadius: number;
}

interface SavedSearch extends SearchFilter {
  id: string;
  name: string;
}

// ── Haversine ──────────────────────────────────────────────────────────────────

/**
 * Fallback lookup for common Latvian cities.
 * Used when the Google Maps Geocoding API is unavailable or the city is already known.
 */
const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  riga: { lat: 56.9496, lng: 24.1052 },
  jurmala: { lat: 56.9677, lng: 23.7718 },
  ogre: { lat: 56.8153, lng: 24.6037 },
  sigulda: { lat: 57.1534, lng: 24.86 },
  ventspils: { lat: 57.3914, lng: 21.5614 },
  jelgava: { lat: 56.649, lng: 23.7124 },
  liepaja: { lat: 56.5114, lng: 21.0107 },
  daugavpils: { lat: 55.8749, lng: 26.5363 },
  valmiera: { lat: 57.5405, lng: 25.4229 },
  rezekne: { lat: 56.509, lng: 27.3326 },
  jekabpils: { lat: 56.4985, lng: 25.8706 },
  jelsava: { lat: 56.649, lng: 23.7124 },
  tukums: { lat: 56.9671, lng: 23.156 },
  cesis: { lat: 57.3124, lng: 25.2773 },
  dobele: { lat: 56.6236, lng: 23.2781 },
  kuldiga: { lat: 56.969, lng: 21.9612 },
  bauska: { lat: 56.4086, lng: 24.1957 },
  limbazi: { lat: 57.511, lng: 24.7195 },
  salaspils: { lat: 56.8619, lng: 24.3498 },
  olaine: { lat: 56.7887, lng: 23.9404 },
  marupe: { lat: 56.8955, lng: 23.98 },
  adazi: { lat: 57.0745, lng: 24.3219 },
  saulkrasti: { lat: 57.2572, lng: 24.4134 },
  smiltene: { lat: 57.4228, lng: 25.896 },
  gulbene: { lat: 57.1756, lng: 26.7439 },
  madona: { lat: 56.857, lng: 26.2213 },
  preili: { lat: 56.2904, lng: 26.7225 },
  ludza: { lat: 56.548, lng: 27.7194 },
  balvi: { lat: 57.1305, lng: 27.2649 },
};

function normalizeCity(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/ā/g, 'a')
    .replace(/ē/g, 'e')
    .replace(/ī/g, 'i')
    .replace(/ū/g, 'u')
    .replace(/ģ/g, 'g')
    .replace(/ķ/g, 'k')
    .replace(/ļ/g, 'l')
    .replace(/ņ/g, 'n')
    .replace(/š/g, 's')
    .replace(/ž/g, 'z');
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function resolveCityCoords(
  input: string,
  geocodeCache: Record<string, { lat: number; lng: number }>,
): { lat: number; lng: number } | null {
  const key = normalizeCity(input);
  if (geocodeCache[key]) return geocodeCache[key];
  if (CITY_COORDS[key]) return CITY_COORDS[key];
  // Partial match in CITY_COORDS
  return Object.entries(CITY_COORDS).find(([k]) => k.includes(key) || key.includes(k))?.[1] ?? null;
}

async function geocodeCity(
  city: string,
  apiKey: string,
): Promise<{ lat: number; lng: number } | null> {
  if (!apiKey || !city.trim()) return null;
  try {
    const encoded = encodeURIComponent(`${city}, Latvia`);
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encoded}&key=${apiKey}`,
    );
    const data = (await res.json()) as {
      status: string;
      results: Array<{ geometry: { location: { lat: number; lng: number } } }>;
    };
    if (data.status === 'OK' && data.results[0]) {
      return data.results[0].geometry.location;
    }
  } catch {
    // silent
  }
  return null;
}

function filterJobs(
  jobs: TransportJob[],
  filter: SearchFilter | null,
  geocodeCache: Record<string, { lat: number; lng: number }>,
): TransportJob[] {
  if (!filter) return jobs;
  const { fromLocation, fromRadius, toLocation, toRadius } = filter;
  return jobs.filter((job) => {
    if (fromLocation.trim() && fromRadius > 0) {
      const c = resolveCityCoords(fromLocation, geocodeCache);
      if (c && haversineKm(c.lat, c.lng, job.fromLat, job.fromLng) > fromRadius) return false;
    }
    if (toLocation.trim() && toRadius > 0) {
      const c = resolveCityCoords(toLocation, geocodeCache);
      if (c && haversineKm(c.lat, c.lng, job.toLat, job.toLng) > toRadius) return false;
    }
    return true;
  });
}

// ── API helpers ────────────────────────────────────────────────────────────────

function mapApiJob(j: ApiTransportJob): TransportJob {
  const d = new Date(j.pickupDate);
  return {
    id: j.id,
    jobNumber: j.jobNumber,
    vehicleType: j.requiredVehicleType ?? j.requiredVehicleEnum ?? 'Kravas auto',
    payload: j.cargoType,
    weightTonnes: j.cargoWeight ?? 0,
    fromCity: j.pickupCity,
    fromAddress: j.pickupAddress,
    fromLat: j.pickupLat ?? 56.9496,
    fromLng: j.pickupLng ?? 24.1052,
    toCity: j.deliveryCity,
    toAddress: j.deliveryAddress,
    toLat: j.deliveryLat ?? 56.9496,
    toLng: j.deliveryLng ?? 24.1052,
    distanceKm: j.distanceKm ?? 0,
    date: d.toLocaleDateString('lv-LV', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    time: d.toLocaleTimeString('lv-LV', { hour: '2-digit', minute: '2-digit' }),
    priceTotal: j.rate ?? 0,
    pricePerTonne: j.pricePerTonne ?? 0,
    currency: j.currency,
  };
}

const RADIUS_OPTIONS = [25, 50, 100, 150, 200];
const LS_KEY = 'b3hub_web_saved_job_searches';

export default function JobsPage() {
  const { user, token } = useAuth();

  const {
    jobs: apiJobs,
    setJobs,
    vehicles,
    drivers,
    loading: loadingJobs,
    error: jobError,
    reload,
  } = useAvailableJobs(token);
  const allJobs = Array.isArray(apiJobs) ? apiJobs.map(mapApiJob) : [];
  const [activeFilter, setActiveFilter] = useState<SearchFilter | null>(null);
  const [draft, setDraft] = useState<SearchFilter>({
    fromLocation: '',
    fromRadius: 0,
    toLocation: '',
    toRadius: 0,
  });
  const [panelOpen, setPanelOpen] = useState(false);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [saveName, setSaveName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  /** Cache of geocoded city names → lat/lng; populated on demand via Google Maps Geocoding API */
  const geocodeCacheRef = useRef<Record<string, { lat: number; lng: number }>>({});

  // Dispatch panel
  const [dispatchJob, setDispatchJob] = useState<TransportJob | null>(null);
  const [dispatchVehicleId, setDispatchVehicleId] = useState('');
  const [dispatchDriverId, setDispatchDriverId] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [assignSuccess, setAssignSuccess] = useState(false);

  // Create-job Sheet
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createSuccess, setCreateSuccess] = useState(false);
  const [createForm, setCreateForm] = useState<Partial<CreateTransportJobInput>>({
    jobType: 'MATERIAL_DELIVERY',
    pickupState: 'Latvija',
    deliveryState: 'Latvija',
  });
  const setField = (k: keyof CreateTransportJobInput, v: string | number) =>
    setCreateForm((p) => ({ ...p, [k]: v }));

  // Load saved searches from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setSavedSearches(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  // Persist saved searches
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(savedSearches));
    } catch {
      /* ignore */
    }
  }, [savedSearches]);

  const filteredJobs = filterJobs(allJobs, activeFilter, geocodeCacheRef.current);

  const handleApply = async () => {
    const newFilter = { ...draft };
    const apiKey = getGoogleMapsPublicKey();
    // Geocode any city names not found in the static lookup
    const toResolve = [newFilter.fromLocation, newFilter.toLocation].filter((loc) => {
      if (!loc.trim()) return false;
      const key = normalizeCity(loc);
      return !geocodeCacheRef.current[key] && !resolveCityCoords(loc, {});
    });
    if (toResolve.length > 0 && apiKey) {
      const results = await Promise.all(toResolve.map((c) => geocodeCity(c, apiKey)));
      toResolve.forEach((city, i) => {
        if (results[i]) {
          geocodeCacheRef.current[normalizeCity(city)] = results[i]!;
        }
      });
    }
    setActiveFilter(newFilter);
    setPanelOpen(false);
  };

  const handleReset = () => {
    const empty = { fromLocation: '', fromRadius: 0, toLocation: '', toRadius: 0 };
    setDraft(empty);
    setActiveFilter(null);
    setPanelOpen(false);
  };

  const handleSave = () => {
    if (!saveName.trim()) return;
    const ns: SavedSearch = { id: Date.now().toString(), name: saveName.trim(), ...draft };
    setSavedSearches((prev) => [ns, ...prev]);
    setSaveName('');
    setShowSaveInput(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleApplySaved = async (s: SavedSearch) => {
    const f: SearchFilter = {
      fromLocation: s.fromLocation,
      fromRadius: s.fromRadius,
      toLocation: s.toLocation,
      toRadius: s.toRadius,
    };
    const apiKey = getGoogleMapsPublicKey();
    const toResolve = [f.fromLocation, f.toLocation].filter((loc) => {
      if (!loc.trim()) return false;
      const key = normalizeCity(loc);
      return !geocodeCacheRef.current[key] && !resolveCityCoords(loc, {});
    });
    if (toResolve.length > 0 && apiKey) {
      const results = await Promise.all(toResolve.map((c) => geocodeCity(c, apiKey)));
      toResolve.forEach((city, i) => {
        if (results[i]) geocodeCacheRef.current[normalizeCity(city)] = results[i]!;
      });
    }
    setDraft(f);
    setActiveFilter(f);
    setPanelOpen(false);
  };

  const handleAccept = async (jobId: string) => {
    if (!token) return;
    try {
      await acceptTransportJob(jobId, token);
      setJobs((prev) => prev.filter((j) => j.id !== jobId));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Neizdevās pieņemt darbu');
    }
  };

  const openDispatch = (job: TransportJob) => {
    setDispatchJob(job);
    setDispatchVehicleId(vehicles[0]?.id ?? '');
    setDispatchDriverId(drivers[0]?.id ?? '');
    setAssignSuccess(false);
  };

  const handleAssign = async () => {
    if (!token || !dispatchJob || !dispatchVehicleId || !dispatchDriverId) return;
    setAssigning(true);
    try {
      await assignTransportJob(
        dispatchJob.id,
        { driverId: dispatchDriverId, vehicleId: dispatchVehicleId },
        token,
      );
      setJobs((prev) => prev.filter((j) => j.id !== dispatchJob.id));
      setAssignSuccess(true);
      setTimeout(() => {
        setDispatchJob(null);
        setAssignSuccess(false);
      }, 1400);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Neizdevās piešķirt darbu');
    } finally {
      setAssigning(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  const handleCreateJob = async () => {
    if (!token) return;
    const f = createForm;
    if (
      !f.jobType ||
      !f.pickupAddress ||
      !f.pickupCity ||
      !f.pickupDate ||
      !f.deliveryAddress ||
      !f.deliveryCity ||
      !f.deliveryDate ||
      !f.cargoType ||
      !f.rate
    ) {
      alert('Lūdzu aizpildiet visus obligātos laukus');
      return;
    }
    setCreating(true);
    try {
      const newJob = await createTransportJob(f as CreateTransportJobInput, token);
      setJobs((prev) => [newJob, ...prev]);
      setCreateSuccess(true);
      setTimeout(() => {
        setCreateOpen(false);
        setCreateSuccess(false);
        setCreateForm({
          jobType: 'MATERIAL_DELIVERY',
          pickupState: 'Latvija',
          deliveryState: 'Latvija',
        });
      }, 1400);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Neizdevās izveidot darbu');
    } finally {
      setCreating(false);
    }
  };

  const togglePanel = () => {
    if (!panelOpen && activeFilter) setDraft({ ...activeFilter });
    setPanelOpen((v) => !v);
  };

  const filterLabel = () => {
    const parts: string[] = [];
    if (activeFilter?.fromLocation)
      parts.push(
        activeFilter.fromLocation +
          (activeFilter.fromRadius ? ` +${activeFilter.fromRadius}km` : ''),
      );
    if (activeFilter?.toLocation)
      parts.push(
        '→ ' +
          activeFilter.toLocation +
          (activeFilter.toRadius ? ` +${activeFilter.toRadius}km` : ''),
      );
    return parts.join('  ');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Job Board"
        description={`Pieejamie transporta darbi · ${filteredJobs.length} rezultāti`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Izveidot Darbu
            </Button>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
              Atjaunot
            </Button>
            <Button variant={panelOpen ? 'default' : 'outline'} size="sm" onClick={togglePanel}>
              <SlidersHorizontal className="h-4 w-4 mr-1.5" />
              Filtri
              {activeFilter && !panelOpen && (
                <span className="ml-1.5 h-2 w-2 rounded-full bg-primary/70 inline-block" />
              )}
              {panelOpen ? (
                <ChevronUp className="h-4 w-4 ml-1.5" />
              ) : (
                <ChevronDown className="h-4 w-4 ml-1.5" />
              )}
            </Button>
          </div>
        }
      />

      {/* Collapsible filter panel */}
      {panelOpen && (
        <Card className="p-5 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* From */}
            <div className="space-y-2">
              <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 ml-1">
                Iekraušanas vieta
              </Label>
              <div className="flex bg-muted/60 border border-transparent hover:bg-muted/80 transition-colors rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-ring/20 focus-within:border-border focus-within:bg-background items-center relative">
                <div className="pl-4 pr-1 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-foreground"></div>
                </div>
                <input
                  type="text"
                  value={draft.fromLocation}
                  onChange={(e) => setDraft((d) => ({ ...d, fromLocation: e.target.value }))}
                  placeholder="Pilsēta vai pasta indekss..."
                  className="flex-1 bg-transparent px-2 py-3.5 text-[15px] outline-none placeholder:text-muted-foreground font-medium"
                />
                <div className="flex items-center border-l border-border/60 pr-2">
                  <div className="relative flex items-center">
                    <select
                      value={draft.fromRadius}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, fromRadius: Number(e.target.value) }))
                      }
                      className="appearance-none bg-transparent pl-4 pr-8 py-3.5 text-sm font-semibold outline-none cursor-pointer text-foreground"
                    >
                      <option value={0}>+ 0 km</option>
                      {RADIUS_OPTIONS.map((r) => (
                        <option key={r} value={r}>
                          + {r} km
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="h-4 w-4 absolute right-3 pointer-events-none text-muted-foreground" />
                  </div>
                </div>
              </div>
            </div>

            {/* To */}
            <div className="space-y-2">
              <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 ml-1">
                Izkraušanas vieta
              </Label>
              <div className="flex bg-muted/60 border border-transparent hover:bg-muted/80 transition-colors rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-ring/20 focus-within:border-border focus-within:bg-background items-center relative">
                <div className="pl-4 pr-1 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-[1px] bg-foreground"></div>
                </div>
                <input
                  type="text"
                  value={draft.toLocation}
                  onChange={(e) => setDraft((d) => ({ ...d, toLocation: e.target.value }))}
                  placeholder="Pilsēta vai pasta indekss..."
                  className="flex-1 bg-transparent px-2 py-3.5 text-[15px] outline-none placeholder:text-muted-foreground font-medium"
                />
                <div className="flex items-center border-l border-border/60 pr-2">
                  <div className="relative flex items-center">
                    <select
                      value={draft.toRadius}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, toRadius: Number(e.target.value) }))
                      }
                      className="appearance-none bg-transparent pl-4 pr-8 py-3.5 text-sm font-semibold outline-none cursor-pointer text-foreground"
                    >
                      <option value={0}>+ 0 km</option>
                      {RADIUS_OPTIONS.map((r) => (
                        <option key={r} value={r}>
                          + {r} km
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="h-4 w-4 absolute right-3 pointer-events-none text-muted-foreground" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3 pt-1 border-t">
            <Button variant="outline" size="sm" onClick={handleReset}>
              <X className="h-3.5 w-3.5 mr-1" />
              Atiestatīt
            </Button>
            <Button size="sm" onClick={handleApply}>
              Lietot filtru
            </Button>
            <div className="flex-1" />
            {!showSaveInput ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const parts = [];
                  if (draft.fromLocation) parts.push(draft.fromLocation);
                  if (draft.toLocation) parts.push('→ ' + draft.toLocation);
                  setSaveName(parts.join(' '));
                  setShowSaveInput(true);
                }}
              >
                <Bookmark className="h-3.5 w-3.5 mr-1.5" />
                Saglabāt meklēšanu
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Input
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="Piem. Rīga → Jūrmala 50km"
                  className="h-8 w-52 text-sm"
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                  autoFocus
                />
                <Button size="sm" onClick={handleSave} disabled={!saveName.trim()}>
                  Saglabāt
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowSaveInput(false);
                    setSaveName('');
                  }}
                >
                  Atcelt
                </Button>
              </div>
            )}
          </div>

          {/* Save success toast */}
          {saveSuccess && (
            <p className="text-sm text-primary font-medium flex items-center gap-1.5">
              <BookmarkCheck className="h-4 w-4" />
              Meklēšana saglabāta!
            </p>
          )}

          {/* Saved searches */}
          {savedSearches.length > 0 && (
            <div className="pt-2 border-t space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Saglabātās meklēšanas
              </p>
              <div className="flex flex-wrap gap-2">
                {savedSearches.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-1 bg-muted rounded-full pl-3 pr-1 py-1 border"
                  >
                    <button
                      type="button"
                      onClick={() => handleApplySaved(s)}
                      className="text-xs font-semibold text-foreground hover:text-primary transition-colors"
                    >
                      {s.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSavedSearches((prev) => prev.filter((x) => x.id !== s.id))}
                      className="h-5 w-5 rounded-full flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors ml-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Active filter pill */}
      {activeFilter && !panelOpen && (
        <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-lg px-4 py-2.5">
          <span className="text-xs font-bold text-primary">Aktīvs filtrs:</span>
          <span className="text-xs font-medium text-primary/80 flex-1">{filterLabel()}</span>
          <button
            type="button"
            onClick={handleReset}
            className="text-xs font-semibold text-primary bg-primary/15 hover:bg-primary/25 rounded px-2 py-0.5 transition-colors flex items-center gap-1"
          >
            <X className="h-3 w-3" />
            Notīrīt
          </button>
        </div>
      )}

      {/* ── Single-column Feed ───────────────────────── */}
      <div className="max-w-3xl mx-auto w-full">
        <div className="flex flex-col gap-4 w-full">
          {/* "Drive wherever you want" banner */}
          {!activeFilter && !panelOpen && (
            <div className="flex gap-4 bg-muted/40 border-none rounded-2xl p-5 shadow-none">
              <MapPin className="h-6 w-6 text-foreground shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1">
                <p className="font-semibold tracking-tight text-foreground">Braukā kur vēlies</p>
                <p className="text-xs font-medium text-muted-foreground leading-relaxed">
                  Iestati rādiusu, lai redzētu tikai tos maršrutus, kas ietilpst tavā darba zonā.
                </p>
                <button
                  type="button"
                  onClick={() => setPanelOpen(true)}
                  className="mt-2 text-xs font-bold text-foreground hover:text-foreground/70 transition-colors uppercase tracking-widest inline-flex items-center"
                >
                  Iestatīt filtru →
                </button>
              </div>
            </div>
          )}

          {/* Job cards */}
          {loadingJobs ? (
            <PageSpinner />
          ) : jobError ? (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
              <AlertTriangle className="h-10 w-10 text-muted-foreground" />
              <p className="text-base font-semibold text-foreground">Kļūda ielādējot darbus</p>
              <p className="text-sm text-muted-foreground">{jobError}</p>
              <Button variant="outline" size="sm" onClick={handleRefresh}>
                Mēģināt vēlreiz
              </Button>
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
              <Search className="h-10 w-10 text-muted-foreground" />
              <p className="text-base font-semibold text-foreground">Nav atrasts neviens darbs</p>
              <p className="text-sm text-muted-foreground">Mēģiniet mainīt filtra iestatījumus</p>
              <Button variant="outline" size="sm" onClick={handleReset}>
                Notīrīt filtru
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3 pb-4">
              {filteredJobs.map((job) => (
                <div
                  key={job.id}
                  className="group cursor-pointer relative overflow-hidden rounded-2xl bg-card p-5 transition-all hover:bg-muted/30 ring-1 ring-black/6 shadow-sm hover:ring-black/12 hover:shadow-md"
                >
                  {/* PRICE & META TOP ROW */}
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="text-2xl font-semibold tracking-tight text-foreground">
                        {job.priceTotal.toFixed(2)} {job.currency}
                      </h3>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1 text-sm text-muted-foreground/80">
                        <span>{job.distanceKm} km</span>
                        <span>•</span>
                        <span>
                          {job.weightTonnes}t {job.payload}
                        </span>
                        {job.pricePerTonne > 0 && (
                          <>
                            <span>•</span>
                            <span>
                              {job.pricePerTonne.toFixed(2)} {job.currency}/t
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center bg-muted/50 text-muted-foreground px-3 py-1.5 rounded-full text-xs font-medium">
                      {job.vehicleType}
                    </div>
                  </div>

                  {/* ROUTE TIMELINE */}
                  <div className="relative mt-2 mb-6 ml-1">
                    {/* The connecting vertical line */}
                    <div className="absolute left-[3.5px] top-4 bottom-4 w-px bg-foreground/20" />

                    {/* Pickup */}
                    <div className="relative flex gap-4 mb-5">
                      <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-foreground z-10" />
                      <div>
                        <p className="font-medium text-foreground text-[15px] leading-tight">
                          {job.fromCity}
                        </p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {job.date} • {job.time}
                        </p>
                      </div>
                    </div>

                    {/* Delivery */}
                    <div className="relative flex gap-4">
                      <div className="mt-1.5 h-2 w-2 shrink-0 bg-foreground z-10" />
                      <div>
                        <p className="font-medium text-foreground text-[15px] leading-tight">
                          {job.toCity}
                        </p>
                        <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1 pr-4">
                          {job.toAddress}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* ACTION FOOTER */}
                  <div className="pt-2 flex gap-3 border-t border-border/40 mt-2">
                    {user?.canTransport && user?.isCompany ? (
                      // Company carrier — dispatcher assigns job to a specific driver + vehicle
                      <Button
                        className="w-full rounded-xl h-11.5 mt-4 text-[15px] font-medium bg-foreground text-background hover:bg-foreground/90 transition-all shadow-none"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDispatch(job);
                        }}
                      >
                        Plānot darbu
                      </Button>
                    ) : (
                      user?.canTransport &&
                      !user?.isCompany && (
                        // Independent owner-operator — can self-accept directly from web
                        <Button
                          className="w-full rounded-xl h-11.5 mt-4 text-[15px] font-medium bg-foreground text-background hover:bg-foreground/90 transition-all shadow-none"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAccept(job.id);
                          }}
                        >
                          Pieņemt
                        </Button>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Dispatch Sheet ─────────────────────────────────────────────────── */}
      <Sheet open={!!dispatchJob} onOpenChange={(o) => !o && setDispatchJob(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
          {dispatchJob && (
            <>
              <SheetHeader className="px-6 py-5 border-b">
                <SheetTitle className="text-base font-bold">
                  Darbu #{dispatchJob.jobNumber} plānot
                </SheetTitle>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                {/* Cargo pill */}
                <div className="flex items-center gap-3 bg-muted/40 border rounded-xl px-4 py-3">
                  <div>
                    <p className="font-bold text-sm text-foreground">
                      {dispatchJob.weightTonnes} t · {dispatchJob.payload}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <CalendarDays className="h-3 w-3" />
                      {dispatchJob.date} · {dispatchJob.time}
                    </p>
                  </div>
                  <span className="ml-auto text-xs font-semibold bg-muted text-muted-foreground rounded px-2 py-1">
                    {dispatchJob.vehicleType}
                  </span>
                </div>

                {/* Route */}
                <div className="space-y-1 pl-1">
                  <div className="flex items-start gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/50 border-2 border-muted mt-1 shrink-0" />
                    <div>
                      <p className="font-semibold text-sm text-foreground">
                        {dispatchJob.fromCity}
                      </p>
                      <p className="text-xs text-muted-foreground">{dispatchJob.fromAddress}</p>
                    </div>
                  </div>
                  <div className="w-px h-4 bg-border ml-1.5" />
                  <div className="flex items-start gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-primary border-2 border-primary/20 mt-1 shrink-0" />
                    <div>
                      <p className="font-semibold text-sm text-foreground">{dispatchJob.toCity}</p>
                      <p className="text-xs text-muted-foreground">{dispatchJob.toAddress}</p>
                    </div>
                  </div>
                </div>

                {/* Distance + price */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Ruler className="h-3.5 w-3.5" />
                  <span>{dispatchJob.distanceKm} km</span>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="font-bold text-primary">
                    {dispatchJob.priceTotal.toFixed(2)} {dispatchJob.currency}
                  </span>
                </div>

                <div className="border-t pt-4 space-y-4">
                  <p className="text-xs text-muted-foreground">
                    Vispirms izvēlieties transportlīdzekli, pēc tam šoferi.
                  </p>

                  {/* Vehicle select */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                      <Truck className="h-3.5 w-3.5" />
                      Transportlīdzeklis
                    </Label>
                    <Select value={dispatchVehicleId} onValueChange={setDispatchVehicleId}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="-- Izvēlieties --" />
                      </SelectTrigger>
                      <SelectContent>
                        {vehicles.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.licensePlate} ({v.vehicleType})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {vehicles.length === 0 && (
                      <p className="text-xs text-destructive/70">
                        Nav reģistrētu transportlīdzekļu. Pievienojiet garāžā.
                      </p>
                    )}
                  </div>

                  {/* Driver select */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" />
                      Šoferis
                    </Label>
                    <Select value={dispatchDriverId} onValueChange={setDispatchDriverId}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="-- Izvēlieties --" />
                      </SelectTrigger>
                      <SelectContent>
                        {drivers.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.firstName} {d.lastName}
                            {d.phone ? ` · ${d.phone}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {drivers.length === 0 && (
                      <p className="text-xs text-destructive/70">Nav atrasts neviens šoferis.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer actions */}
              <div className="px-6 py-4 border-t flex items-center gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setDispatchJob(null)}
                  disabled={assigning}
                >
                  Atcelt
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleAssign}
                  disabled={assigning || !dispatchVehicleId || !dispatchDriverId || assignSuccess}
                >
                  {assignSuccess ? (
                    <>
                      <CircleCheck className="h-4 w-4 mr-2" />
                      Saglabāts!
                    </>
                  ) : assigning ? (
                    'Saglabā...'
                  ) : (
                    '✓ Saglabāt'
                  )}
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Create Job Sheet ────────────────────────────────────── */}
      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="px-6 pt-6 pb-4 border-b">
            <SheetTitle className="text-lg font-semibold">Izveidot jaunu darbu</SheetTitle>
          </SheetHeader>

          {createSuccess ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4 text-primary">
              <CircleCheck className="h-12 w-12" />
              <p className="text-base font-medium">Darbs izveidots!</p>
            </div>
          ) : (
            <div className="px-6 py-4 space-y-5">
              {/* Job type */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Darba veids *
                </Label>
                <Select
                  value={createForm.jobType ?? 'MATERIAL_DELIVERY'}
                  onValueChange={(v) => setField('jobType', v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MATERIAL_DELIVERY">Materiālu piegāde</SelectItem>
                    <SelectItem value="CONTAINER_DELIVERY">Konteinera piegāde</SelectItem>
                    <SelectItem value="CONTAINER_PICKUP">Konteinera savākšana</SelectItem>
                    <SelectItem value="WASTE_COLLECTION">Atkritumu savākšana</SelectItem>
                    <SelectItem value="EQUIPMENT_TRANSPORT">Tehnikas pārvadāšana</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Pickup */}
              <fieldset className="space-y-3 border rounded-lg p-4">
                <legend className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
                  Iekraušanas vieta
                </legend>
                <div className="space-y-1.5">
                  <Label className="text-xs">Adrese *</Label>
                  <Input
                    placeholder="Ielas adrese"
                    value={createForm.pickupAddress ?? ''}
                    onChange={(e) => setField('pickupAddress', e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Pilsēta *</Label>
                    <Input
                      placeholder="Pilsēta"
                      value={createForm.pickupCity ?? ''}
                      onChange={(e) => setField('pickupCity', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Pasta indekss</Label>
                    <Input
                      placeholder="LV-XXXX"
                      value={createForm.pickupPostal ?? ''}
                      onChange={(e) => setField('pickupPostal', e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Datums *</Label>
                  <Input
                    type="date"
                    value={createForm.pickupDate ?? ''}
                    onChange={(e) => setField('pickupDate', e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Laika logs (neobligāts)</Label>
                  <Input
                    placeholder="piem. 08:00–12:00"
                    value={createForm.pickupWindow ?? ''}
                    onChange={(e) => setField('pickupWindow', e.target.value)}
                  />
                </div>
              </fieldset>

              {/* Delivery */}
              <fieldset className="space-y-3 border rounded-lg p-4">
                <legend className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
                  Izkraušanas vieta
                </legend>
                <div className="space-y-1.5">
                  <Label className="text-xs">Adrese *</Label>
                  <Input
                    placeholder="Ielas adrese"
                    value={createForm.deliveryAddress ?? ''}
                    onChange={(e) => setField('deliveryAddress', e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Pilsēta *</Label>
                    <Input
                      placeholder="Pilsēta"
                      value={createForm.deliveryCity ?? ''}
                      onChange={(e) => setField('deliveryCity', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Pasta indekss</Label>
                    <Input
                      placeholder="LV-XXXX"
                      value={createForm.deliveryPostal ?? ''}
                      onChange={(e) => setField('deliveryPostal', e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Datums *</Label>
                  <Input
                    type="date"
                    value={createForm.deliveryDate ?? ''}
                    onChange={(e) => setField('deliveryDate', e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Laika logs (neobligāts)</Label>
                  <Input
                    placeholder="piem. 13:00–17:00"
                    value={createForm.deliveryWindow ?? ''}
                    onChange={(e) => setField('deliveryWindow', e.target.value)}
                  />
                </div>
              </fieldset>

              {/* Cargo */}
              <fieldset className="space-y-3 border rounded-lg p-4">
                <legend className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
                  Krava
                </legend>
                <div className="space-y-1.5">
                  <Label className="text-xs">Kravas veids *</Label>
                  <Input
                    placeholder="piem. Smiltis, Grants, Metāllūžņi"
                    value={createForm.cargoType ?? ''}
                    onChange={(e) => setField('cargoType', e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Svars (t)</Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.1}
                      placeholder="0.0"
                      value={createForm.cargoWeight ?? ''}
                      onChange={(e) => setField('cargoWeight', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Tilpums (m³)</Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.1}
                      placeholder="0.0"
                      value={createForm.cargoVolume ?? ''}
                      onChange={(e) => setField('cargoVolume', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Īpašās prasības</Label>
                  <Input
                    placeholder="piem. Aukstā ķēde, bīstamas kravas"
                    value={createForm.specialRequirements ?? ''}
                    onChange={(e) => setField('specialRequirements', e.target.value)}
                  />
                </div>
              </fieldset>

              {/* Vehicle + Pricing */}
              <fieldset className="space-y-3 border rounded-lg p-4">
                <legend className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
                  Transports un cena
                </legend>
                <div className="space-y-1.5">
                  <Label className="text-xs">Nepieciešamais transportlīdzeklis</Label>
                  <Select
                    value={createForm.requiredVehicleEnum || '_ANY_'}
                    onValueChange={(v) => setField('requiredVehicleEnum', v === '_ANY_' ? '' : v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_ANY_">Jebkurš</SelectItem>
                      <SelectItem value="DUMP_TRUCK">Pašizgāzējs</SelectItem>
                      <SelectItem value="FLATBED_TRUCK">Platforma</SelectItem>
                      <SelectItem value="SEMI_TRAILER">Piekabes kravas auto</SelectItem>
                      <SelectItem value="HOOK_LIFT">Āķa pacēlājs</SelectItem>
                      <SelectItem value="SKIP_LOADER">Konteineru auto</SelectItem>
                      <SelectItem value="TANKER">Cisterna</SelectItem>
                      <SelectItem value="VAN">Furgons</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Likme (€) *</Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      placeholder="0.00"
                      value={createForm.rate ?? ''}
                      onChange={(e) => setField('rate', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">€/t (neobligāts)</Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      placeholder="0.00"
                      value={createForm.pricePerTonne ?? ''}
                      onChange={(e) => setField('pricePerTonne', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Attālums (km)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    placeholder="0"
                    value={createForm.distanceKm ?? ''}
                    onChange={(e) => setField('distanceKm', parseFloat(e.target.value) || 0)}
                  />
                </div>
              </fieldset>

              {/* Action buttons */}
              <div className="flex items-center gap-3 pt-1">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setCreateOpen(false)}
                  disabled={creating}
                >
                  Atcelt
                </Button>
                <Button className="flex-1" onClick={handleCreateJob} disabled={creating}>
                  {creating ? 'Saglabā...' : '+ Publicēt darbu'}
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

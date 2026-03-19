/**
 * Available transport jobs page — /dashboard/jobs
 * Lists open haulage jobs that a carrier can accept, with distance and load details.
 */
'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import {
  ChevronDown,
  ChevronUp,
  MapPin,
  Truck,
  Clock,
  Ruler,
  X,
  Bookmark,
  BookmarkCheck,
  RefreshCw,
  SlidersHorizontal,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth-context';
import {
  acceptTransportJob,
  assignTransportJob,
  createTransportJob,
  type ApiTransportJob,
  type CreateTransportJobInput,
} from '@/lib/api';
import { useAvailableJobs } from '@/hooks/use-available-jobs';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { CalendarDays, Users, CircleCheck } from 'lucide-react';

// Dynamic import — Mapbox needs browser
const TransportJobsMapDynamic = dynamic(() => import('@/components/tracking/TransportJobsMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center rounded-xl bg-zinc-800 text-zinc-500 text-sm">
      Karte ielādējas…
    </div>
  ),
});

// ── Types ──────────────────────────────────────────────────────────────────────

interface TransportJob {
  id: string;
  jobNumber: string;
  vehicleType: string;
  vehicleEmoji: string;
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
};

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function cityCoords(input: string): { lat: number; lng: number } | null {
  const key = input
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
  return (
    CITY_COORDS[key] ??
    Object.entries(CITY_COORDS).find(([k]) => k.includes(key) || key.includes(k))?.[1] ??
    null
  );
}

function filterJobs(jobs: TransportJob[], filter: SearchFilter | null): TransportJob[] {
  if (!filter) return jobs;
  const { fromLocation, fromRadius, toLocation, toRadius } = filter;
  return jobs.filter((job) => {
    if (fromLocation.trim() && fromRadius > 0) {
      const c = cityCoords(fromLocation);
      if (c && haversineKm(c.lat, c.lng, job.fromLat, job.fromLng) > fromRadius) return false;
    }
    if (toLocation.trim() && toRadius > 0) {
      const c = cityCoords(toLocation);
      if (c && haversineKm(c.lat, c.lng, job.toLat, job.toLng) > toRadius) return false;
    }
    return true;
  });
}

// ── API helpers ────────────────────────────────────────────────────────────────

const VEHICLE_EMOJI: Partial<Record<string, string>> = {
  DUMP_TRUCK: '🚚',
  FLATBED_TRUCK: '🚛',
  SEMI_TRAILER: '🚛',
  HOOK_LIFT: '🚜',
  SKIP_LOADER: '🚛',
  TANKER: '🛢️',
  VAN: '🚐',
};

function mapApiJob(j: ApiTransportJob): TransportJob {
  const d = new Date(j.pickupDate);
  return {
    id: j.id,
    jobNumber: j.jobNumber,
    vehicleType: j.requiredVehicleType ?? j.requiredVehicleEnum ?? 'Kravas auto',
    vehicleEmoji: VEHICLE_EMOJI[j.requiredVehicleEnum ?? ''] ?? '🚛',
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

// ── Radius chips ───────────────────────────────────────────────────────────────

function RadiusChips({ selected, onChange }: { selected: number; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      <button
        type="button"
        onClick={() => onChange(0)}
        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
          selected === 0
            ? 'bg-primary border-primary text-primary-foreground'
            : 'bg-muted border-border text-muted-foreground hover:border-primary/50 hover:text-primary'
        }`}
      >
        Jebkur
      </button>
      {RADIUS_OPTIONS.map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => onChange(r)}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
            selected === r
              ? 'bg-primary border-primary text-primary-foreground'
              : 'bg-muted border-border text-muted-foreground hover:border-primary/50 hover:text-primary'
          }`}
        >
          {r} km
        </button>
      ))}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function JobsPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();

  const {
    jobs: apiJobs,
    setJobs,
    vehicles,
    drivers,
    loading: loadingJobs,
    error: jobError,
    reload,
  } = useAvailableJobs(token);
  const allJobs = apiJobs.map(mapApiJob);
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

  // Map selection state
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<'list' | 'map'>('list');
  const jobCardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
  }, [user, isLoading, router]);

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

  const filteredJobs = filterJobs(allJobs, activeFilter);

  const handleApply = () => {
    setActiveFilter({ ...draft });
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

  const handleApplySaved = (s: SavedSearch) => {
    const f: SearchFilter = {
      fromLocation: s.fromLocation,
      fromRadius: s.fromRadius,
      toLocation: s.toLocation,
      toRadius: s.toRadius,
    };
    setDraft(f);
    setActiveFilter(f);
    setPanelOpen(false);
  };

  const handleAccept = async (jobId: string) => {
    if (!token || !confirm('Pieņemt šo darbu?')) return;
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

  const handleCardSelect = useCallback((id: string) => {
    setSelectedJobId((prev) => (prev === id ? null : id));
  }, []);

  const handleMapSelect = useCallback((id: string | null) => {
    setSelectedJobId(id);
    if (id) {
      const el = jobCardRefs.current.get(id);
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, []);

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
      {/* Page header */}
      <PageHeader
        title="Job Board"
        description={`Pieejamie transporta darbi · ${filteredJobs.length} rezultāti`}
        action={
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Izveidot Darbu
            </Button>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
              Atjaunot
            </Button>
            <Button
              variant={panelOpen ? 'default' : 'outline'}
              size="sm"
              onClick={togglePanel}
            >
              <SlidersHorizontal className="h-4 w-4 mr-1.5" />
              Filtri
              {activeFilter && !panelOpen && (
                <span className="ml-1.5 h-2 w-2 rounded-full bg-amber-400 inline-block" />
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
        <div className="rounded-xl border bg-card shadow-sm p-5 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* From */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-gray-400" />
                Iekraušanas vieta
              </Label>
              <Input
                value={draft.fromLocation}
                onChange={(e) => setDraft((d) => ({ ...d, fromLocation: e.target.value }))}
                placeholder="Pilsēta vai pasta indekss..."
                className="h-10"
              />
              <p className="text-xs text-muted-foreground">Rādiuss ap iekraušanas vietu:</p>
              <RadiusChips
                selected={draft.fromRadius}
                onChange={(v) => setDraft((d) => ({ ...d, fromRadius: v }))}
              />
            </div>

            {/* To */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-red-500" />
                Izkraušanas vieta
              </Label>
              <Input
                value={draft.toLocation}
                onChange={(e) => setDraft((d) => ({ ...d, toLocation: e.target.value }))}
                placeholder="Pilsēta vai pasta indekss..."
                className="h-10"
              />
              <p className="text-xs text-muted-foreground">Rādiuss ap izkraušanas vietu:</p>
              <RadiusChips
                selected={draft.toRadius}
                onChange={(v) => setDraft((d) => ({ ...d, toRadius: v }))}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3 pt-1 border-t">
            <Button variant="outline" size="sm" onClick={handleReset}>
              <X className="h-3.5 w-3.5 mr-1" />
              Atiestatīt
            </Button>
            <Button
              size="sm"
              onClick={handleApply}
            >
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
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={!saveName.trim()}
                >
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
            <p className="text-sm text-green-600 font-medium flex items-center gap-1.5">
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
        </div>
      )}

      {/* Active filter pill */}
      {activeFilter && !panelOpen && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
          <span className="text-xs font-bold text-amber-800">Aktīvs filtrs:</span>
          <span className="text-xs font-medium text-amber-700 flex-1">{filterLabel()}</span>
          <button
            type="button"
            onClick={handleReset}
            className="text-xs font-semibold text-amber-700 bg-amber-200 hover:bg-amber-300 rounded px-2 py-0.5 transition-colors flex items-center gap-1"
          >
            <X className="h-3 w-3" />
            Notīrīt
          </button>
        </div>
      )}

      {/* ── Mobile view toggle ───────────────────────────────────────────── */}
      <div className="flex md:hidden gap-1 rounded-lg bg-muted p-1">
        <button
          type="button"
          onClick={() => setMobileView('list')}
          className={`flex-1 rounded-md py-2 text-sm font-semibold transition-colors ${
            mobileView === 'list'
              ? 'bg-white shadow text-gray-900'
              : 'text-muted-foreground hover:text-gray-900'
          }`}
        >
          📋 Saraksts
        </button>
        <button
          type="button"
          onClick={() => setMobileView('map')}
          className={`flex-1 rounded-md py-2 text-sm font-semibold transition-colors ${
            mobileView === 'map'
              ? 'bg-white shadow text-gray-900'
              : 'text-muted-foreground hover:text-gray-900'
          }`}
        >
          🗺️ Karte
        </button>
      </div>

      {/* ── Split-pane: job list (40%) + map (60%) ───────────────────────── */}
      <div className="flex flex-col gap-4 overflow-hidden md:flex-row md:h-[calc(100vh-200px)]">
        {/* LEFT: banner + job cards */}
        <div
          className={`flex flex-col gap-4 md:w-[40%] md:overflow-y-auto md:pr-1 ${
            mobileView === 'map' ? 'hidden md:flex' : 'flex'
          }`}
        >
          {/* "Drive wherever you want" banner */}
          {!activeFilter && !panelOpen && (
            <div className="flex gap-4 bg-white border-l-4 border-l-red-600 border rounded-xl p-5 shadow-sm">
              <span className="text-3xl mt-0.5">🗺️</span>
              <div className="flex-1 space-y-1">
                <p className="font-bold text-base text-gray-900">Braukā kur vēlies!</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Tu izlemj, kādā rādiusā vēlies pieņemt darbus. Iestatiet rādiusu ap savu uzņēmumu
                  vai jebkuru citu vietu, un mēs parādīsim tikai atbilstošos maršrutus.
                </p>
                <button
                  type="button"
                  onClick={() => setPanelOpen(true)}
                  className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
                >
                  Iestatīt rādiusu →
                </button>
              </div>
            </div>
          )}

          {/* Job cards */}
          {loadingJobs ? (
            <div className="flex items-center justify-center py-20">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : jobError ? (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
              <span className="text-5xl">⚠️</span>
              <p className="text-base font-semibold text-foreground">Kļūda ielādējot darbus</p>
              <p className="text-sm text-muted-foreground">{jobError}</p>
              <Button variant="outline" size="sm" onClick={handleRefresh}>
                Mēģināt vēlreiz
              </Button>
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
              <span className="text-5xl">🔍</span>
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
                  ref={(el) => {
                    if (el) jobCardRefs.current.set(job.id, el);
                  }}
                  onClick={() => handleCardSelect(job.id)}
                  className={`cursor-pointer rounded-xl border shadow-sm p-5 space-y-4 transition-all hover:shadow-md ${
                    selectedJobId === job.id
                      ? 'border-blue-400 ring-2 ring-blue-400 bg-blue-50/40'
                      : 'bg-white'
                  }`}
                >
                  {/* Card header */}
                  <div className="flex items-start justify-between">
                    <div className="space-y-0.5">
                      <p className="text-xs font-mono text-muted-foreground tracking-wider">
                        {job.jobNumber}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{job.vehicleEmoji}</span>
                        <span className="font-bold text-base text-gray-900">{job.vehicleType}</span>
                      </div>
                    </div>
                    <span className="bg-green-100 text-green-700 text-xs font-bold px-2.5 py-1 rounded-full border border-green-200">
                      Pieejams
                    </span>
                  </div>

                  {/* Payload pill */}
                  <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2.5 border">
                    <span className="text-sm font-bold text-gray-900">{job.weightTonnes} t</span>
                    <span className="w-1 h-1 rounded-full bg-gray-400 inline-block" />
                    <span className="text-sm text-gray-700">{job.payload}</span>
                  </div>

                  {/* Route */}
                  <div className="space-y-1 pl-1">
                    <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full bg-gray-400 border-2 border-gray-200 shrink-0" />
                      <div>
                        <p className="font-semibold text-sm text-gray-900">{job.fromCity}</p>
                        <p className="text-xs text-muted-foreground">{job.fromAddress}</p>
                      </div>
                    </div>
                    <div className="w-px h-4 bg-gray-200 ml-1.5" />
                    <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full bg-primary border-2 border-primary/20 shrink-0" />
                      <div>
                        <p className="font-semibold text-sm text-gray-900">{job.toCity}</p>
                        <p className="text-xs text-muted-foreground">{job.toAddress}</p>
                      </div>
                    </div>
                  </div>

                  {/* Meta row */}
                  <div className="flex items-center justify-between pt-3 border-t">
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {job.date} · {job.time}
                      </span>
                      <span className="flex items-center gap-1">
                        <Ruler className="h-3.5 w-3.5" />
                        {job.distanceKm} km
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-extrabold text-primary">
                        {job.priceTotal.toFixed(2)} {job.currency}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {job.pricePerTonne.toFixed(2)} {job.currency} / t
                      </p>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2">
                    {user?.canTransport && user?.isCompany && (
                      <Button
                        className="flex-1 bg-gray-900 hover:bg-gray-800 text-white"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDispatch(job);
                        }}
                      >
                        <CalendarDays className="h-4 w-4 mr-2" />
                        Plānot darbu
                      </Button>
                    )}
                    {(!user?.isCompany || !user?.canTransport) && (
                      <Button
                        className="flex-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAccept(job.id);
                        }}
                      >
                        <Truck className="h-4 w-4 mr-2" />
                        Pieņemt darbu
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT: Map panel */}
        <div
          className={`rounded-xl overflow-hidden h-[70vw] md:h-auto min-h-75 shrink-0 md:w-[60%] ${
            mobileView === 'list' ? 'hidden md:block' : 'block'
          }`}
        >
          <TransportJobsMapDynamic
            jobs={filteredJobs}
            selectedId={selectedJobId}
            onSelect={handleMapSelect}
          />
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
                <div className="flex items-center gap-3 bg-gray-50 border rounded-xl px-4 py-3">
                  <span className="text-2xl">{dispatchJob.vehicleEmoji}</span>
                  <div>
                    <p className="font-bold text-sm text-gray-900">
                      {dispatchJob.weightTonnes} t · {dispatchJob.payload}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <CalendarDays className="h-3 w-3" />
                      {dispatchJob.date} · {dispatchJob.time}
                    </p>
                  </div>
                  <span className="ml-auto text-xs font-semibold bg-gray-200 text-gray-700 rounded px-2 py-1">
                    {dispatchJob.vehicleType}
                  </span>
                </div>

                {/* Route */}
                <div className="space-y-1 pl-1">
                  <div className="flex items-start gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-gray-400 border-2 border-gray-200 mt-1 shrink-0" />
                    <div>
                      <p className="font-semibold text-sm text-gray-900">{dispatchJob.fromCity}</p>
                      <p className="text-xs text-muted-foreground">{dispatchJob.fromAddress}</p>
                    </div>
                  </div>
                  <div className="w-px h-4 bg-gray-200 ml-1.5" />
                  <div className="flex items-start gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-primary border-2 border-primary/20 mt-1 shrink-0" />
                    <div>
                      <p className="font-semibold text-sm text-gray-900">{dispatchJob.toCity}</p>
                      <p className="text-xs text-muted-foreground">{dispatchJob.toAddress}</p>
                    </div>
                  </div>
                </div>

                {/* Distance + price */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Ruler className="h-3.5 w-3.5" />
                  <span>{dispatchJob.distanceKm} km</span>
                  <span className="text-gray-300">·</span>
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
                    <select
                      value={dispatchVehicleId}
                      onChange={(e) => setDispatchVehicleId(e.target.value)}
                      className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">-- Izvēlieties --</option>
                      {vehicles.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.licensePlate} ({v.vehicleType})
                        </option>
                      ))}
                    </select>
                    {vehicles.length === 0 && (
                      <p className="text-xs text-amber-600">
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
                    <select
                      value={dispatchDriverId}
                      onChange={(e) => setDispatchDriverId(e.target.value)}
                      className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">-- Izvēlieties --</option>
                      {drivers.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.firstName} {d.lastName}
                          {d.phone ? ` · ${d.phone}` : ''}
                        </option>
                      ))}
                    </select>
                    {drivers.length === 0 && (
                      <p className="text-xs text-amber-600">Nav atrasts neviens šoferis.</p>
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
            <div className="flex flex-col items-center justify-center h-64 gap-4 text-green-600">
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
                <select
                  value={createForm.jobType ?? 'MATERIAL_DELIVERY'}
                  onChange={(e) => setField('jobType', e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="MATERIAL_DELIVERY">Materiālu piegāde</option>
                  <option value="CONTAINER_DELIVERY">Konteinera piegāde</option>
                  <option value="CONTAINER_PICKUP">Konteinera savākšana</option>
                  <option value="WASTE_COLLECTION">Atkritumu savākšana</option>
                  <option value="EQUIPMENT_TRANSPORT">Tehnikas pārvadāšana</option>
                </select>
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
                  <select
                    value={createForm.requiredVehicleEnum ?? ''}
                    onChange={(e) => setField('requiredVehicleEnum', e.target.value)}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Jebkurš</option>
                    <option value="DUMP_TRUCK">Pašizgāzējs</option>
                    <option value="FLATBED_TRUCK">Platforma</option>
                    <option value="SEMI_TRAILER">Piekabes kravas auto</option>
                    <option value="HOOK_LIFT">Āķa pacēlājs</option>
                    <option value="SKIP_LOADER">Konteineru auto</option>
                    <option value="TANKER">Cisterna</option>
                    <option value="VAN">Furgons</option>
                  </select>
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

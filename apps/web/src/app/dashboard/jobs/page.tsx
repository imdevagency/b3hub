'use client';

import { useState, useCallback, useEffect } from 'react';
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth-context';
import { getAvailableTransportJobs, acceptTransportJob, type ApiTransportJob } from '@/lib/api';

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
    priceTotal: j.rate,
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
            ? 'bg-red-600 border-red-600 text-white'
            : 'bg-muted border-border text-muted-foreground hover:border-red-400 hover:text-red-600'
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
              ? 'bg-red-600 border-red-600 text-white'
              : 'bg-muted border-border text-muted-foreground hover:border-red-400 hover:text-red-600'
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

  const [allJobs, setAllJobs] = useState<TransportJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [jobError, setJobError] = useState<string | null>(null);
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

  // Fetch live jobs from backend
  const fetchJobs = useCallback(async () => {
    if (!token) return;
    setLoadingJobs(true);
    setJobError(null);
    try {
      const data = await getAvailableTransportJobs(token);
      setAllJobs(data.map(mapApiJob));
    } catch (e) {
      setJobError(e instanceof Error ? e.message : 'Neizdevās ielādēt darbus');
    } finally {
      setLoadingJobs(false);
    }
  }, [token]);

  useEffect(() => {
    if (!isLoading && user && token) fetchJobs();
  }, [isLoading, user, token, fetchJobs]);

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
      setAllJobs((prev) => prev.filter((j) => j.id !== jobId));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Neizdevās pieņemt darbu');
    }
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchJobs();
    setRefreshing(false);
  }, [fetchJobs]);

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
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Auftragsbörse</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Pieejamie transporta darbi · {filteredJobs.length} rezultāti
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
            Atjaunot
          </Button>
          <Button
            variant={panelOpen ? 'default' : 'outline'}
            size="sm"
            onClick={togglePanel}
            className={panelOpen ? 'bg-red-600 hover:bg-red-700 text-white border-red-600' : ''}
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
      </div>

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
              className="bg-red-600 hover:bg-red-700 text-white"
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
                  className="bg-red-600 hover:bg-red-700 text-white"
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
                      className="text-xs font-semibold text-foreground hover:text-red-600 transition-colors"
                    >
                      {s.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSavedSearches((prev) => prev.filter((x) => x.id !== s.id))}
                      className="h-5 w-5 rounded-full flex items-center justify-center text-muted-foreground hover:bg-red-100 hover:text-red-600 transition-colors ml-0.5"
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

      {/* "Drive wherever you want" banner */}
      {!activeFilter && !panelOpen && (
        <div className="flex gap-4 bg-white border-l-4 border-l-red-600 border rounded-xl p-5 shadow-sm">
          <span className="text-3xl mt-0.5">🗺️</span>
          <div className="flex-1 space-y-1">
            <p className="font-bold text-base text-gray-900">Braukā kur vēlies!</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Tu izlemj, kādā rādiusā vēlies pieņemt darbus. Iestatiet rādiusu ap savu uzņēmumu vai
              jebkuru citu vietu, un mēs parādīsim tikai atbilstošos maršrutus. Varat saglabāt
              vairākas meklēšanas.
            </p>
            <button
              type="button"
              onClick={() => setPanelOpen(true)}
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-red-600 hover:text-red-700 transition-colors"
            >
              Iestatīt rādiusu →
            </button>
          </div>
        </div>
      )}

      {/* Job list */}
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
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {filteredJobs.map((job) => (
            <div
              key={job.id}
              className="bg-white rounded-xl border shadow-sm p-5 space-y-4 hover:shadow-md transition-shadow"
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
                <div className="w-px h-4 bg-gray-200 ml-[5px]" />
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-600 border-2 border-red-200 shrink-0" />
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
                  <p className="text-lg font-extrabold text-red-600">
                    {job.priceTotal.toFixed(2)} {job.currency}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {job.pricePerTonne.toFixed(2)} {job.currency} / t
                  </p>
                </div>
              </div>

              {/* Accept button */}
              <Button
                className="w-full bg-red-600 hover:bg-red-700 text-white"
                onClick={() => handleAccept(job.id)}
              >
                <Truck className="h-4 w-4 mr-2" />
                Pieņemt darbu
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

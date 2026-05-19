'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  Search,
  AlertTriangle,
  ChevronRight,
  Truck,
  Map,
  List,
  X,
  CheckCircle2,
  Clock,
  RefreshCw,
  Download,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/lib/auth-context';
import { useFleetPositions } from '@/lib/use-fleet-positions';
import {
  getAllTransportJobs,
  getMyTransportJobs,
  getOpenTransportExceptions,
  resolveTransportJobException,
  getMyChatRooms,
  sendChatMessage,
  type ApiTransportJob,
  type ApiTransportJobException,
  type ChatRoom,
} from '@/lib/api';
import type { JobRoutePoint } from '@/components/tracking/TransportJobsMap';

const TransportJobsMap = dynamic(() => import('@/components/tracking/TransportJobsMap'), {
  ssr: false,
  loading: () => <div className="h-full bg-slate-100 animate-pulse rounded-xl" />,
});

// ── Config ────────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; dot: string }> = {
  ASSIGNED: { label: 'Piešķirts', dot: 'bg-slate-400' },
  ACCEPTED: { label: 'Pieņemts', dot: 'bg-slate-600' },
  EN_ROUTE_PICKUP: { label: 'Uz iekraušanu', dot: 'bg-orange-500' },
  AT_PICKUP: { label: 'Iekraušanā', dot: 'bg-pink-500' },
  LOADED: { label: 'Iekrauts', dot: 'bg-violet-500' },
  EN_ROUTE_DELIVERY: { label: 'Uz piegādi', dot: 'bg-emerald-500' },
  AT_DELIVERY: { label: 'Izkraušanā', dot: 'bg-emerald-700' },
};

const ACTIVE_STATUSES = [
  'ASSIGNED',
  'ACCEPTED',
  'EN_ROUTE_PICKUP',
  'AT_PICKUP',
  'LOADED',
  'EN_ROUTE_DELIVERY',
  'AT_DELIVERY',
];

const EXCEPTION_TYPE_LABELS: Record<string, string> = {
  DRIVER_NO_SHOW: 'Šoferis nav ieradies',
  SUPPLIER_NOT_READY: 'Piegādātājs nav gatavs',
  WRONG_MATERIAL: 'Nepareizs materiāls',
  PARTIAL_DELIVERY: 'Nepilna piegāde',
  REJECTED_DELIVERY: 'Piegāde noraidīta',
  SITE_CLOSED: 'Objekts slēgts',
  OVERWEIGHT: 'Pārslogots',
  OTHER: 'Cits',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const AT_RISK_WINDOW_MS = 45 * 60 * 1000; // within 45 minutes of deadline

function isLate(job: ApiTransportJob): boolean {
  if (!job.deliveryDate) return false;
  return Date.now() > new Date(job.deliveryDate).getTime();
}

function isAtRisk(job: ApiTransportJob): boolean {
  if (!job.deliveryDate) return false;
  const deadline = new Date(job.deliveryDate).getTime();
  const now = Date.now();
  return now < deadline && deadline - now <= AT_RISK_WINDOW_MS;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('lv-LV', { day: '2-digit', month: '2-digit' });
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('lv-LV', { hour: '2-digit', minute: '2-digit' });
}

function toMapPoint(job: ApiTransportJob): JobRoutePoint {
  return {
    id: job.id,
    jobNumber: job.jobNumber,
    fromLat: job.pickupLat ?? 56.9496,
    fromLng: job.pickupLng ?? 24.1052,
    fromCity: job.pickupCity,
    fromAddress: job.pickupAddress,
    toLat: job.deliveryLat ?? 56.9496,
    toLng: job.deliveryLng ?? 24.1052,
    toCity: job.deliveryCity,
    payload: job.cargoType,
    weightTonnes: job.cargoWeight ?? 0,
    priceTotal: job.rate ?? 0,
    currency: job.currency,
    vehicleEmoji: '🚛',
    distanceKm: job.distanceKm ?? 0,
  };
}

// ── Types ─────────────────────────────────────────────────────────────────────

type ActiveFilter = 'ALL' | 'AT_RISK' | 'LATE' | 'EXCEPTIONS';
type ViewMode = 'TABLE' | 'MAP';

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ActiveJobsPage() {
  const router = useRouter();
  const { token, user } = useAuth();

  const [jobs, setJobs] = useState<ApiTransportJob[]>([]);
  const [exceptions, setExceptions] = useState<ApiTransportJobException[]>([]);
  const [loading, setLoading] = useState(true);

  // Toolbar state
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('ALL');
  const [viewMode, setViewMode] = useState<ViewMode>('TABLE');

  // Map selection
  const [mapSelectedId, setMapSelectedId] = useState<string | null>(null);

  // Exception panel
  const [exceptionPanelJob, setExceptionPanelJob] = useState<ApiTransportJob | null>(null);
  const [exceptionPanelItems, setExceptionPanelItems] = useState<ApiTransportJobException[]>([]);
  const [resolutionText, setResolutionText] = useState('');
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Freshness
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Comments sidebar
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [commentsTab, setCommentsTab] = useState<'UNREAD' | 'ALL'>('UNREAD');
  const [activeChatJobId, setActiveChatJobId] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [sendingChat, setSendingChat] = useState(false);

  // Live fleet GPS positions — polls every 5s when map view is active
  const truckPositions = useFleetPositions(viewMode === 'MAP' ? token : null);

  const canSeeAll =
    user?.userType === 'ADMIN' ||
    user?.companyRole === 'OWNER' ||
    user?.companyRole === 'MANAGER' ||
    !!user?.permManageOrders;

  const fetchJobs = useCallback(async () => {
    if (!token || !user) return;
    try {
      const [jobsRes, exRes, roomsRes] = await Promise.all([
        canSeeAll ? getAllTransportJobs(token) : getMyTransportJobs(token),
        canSeeAll ? getOpenTransportExceptions(token) : Promise.resolve([]),
        getMyChatRooms(token),
      ]);
      setJobs(jobsRes.filter((j) => ACTIVE_STATUSES.includes(j.status)));
      setExceptions(exRes);
      setChatRooms(roomsRes.filter((r) => r.type === 'job' && r.lastMessage));
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to fetch active jobs:', err);
    } finally {
      setLoading(false);
    }
  }, [token, user, canSeeAll]);

  useEffect(() => {
    fetchJobs();
    const timer = setInterval(fetchJobs, 30_000);
    return () => clearInterval(timer);
  }, [fetchJobs]);

  async function handleRefresh() {
    setRefreshing(true);
    await fetchJobs();
    setRefreshing(false);
  }

  async function handleSendChat(jobId: string) {
    if (!token || !chatInput.trim()) return;
    setSendingChat(true);
    try {
      await sendChatMessage(jobId, chatInput.trim(), token);
      setChatInput('');
      // refresh rooms so the sent message shows as last
      const rooms = await getMyChatRooms(token);
      setChatRooms(rooms.filter((r) => r.type === 'job' && r.lastMessage));
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSendingChat(false);
    }
  }

  function handleExportCsv() {
    const rows = [
      ['Darbs', 'Statuss', 'Šoferis', 'Auto', 'No', 'Uz', 'Mērķa laiks'],
      ...filtered.map((j) => [
        j.jobNumber,
        STATUS_CONFIG[j.status]?.label ?? j.status,
        j.driver ? `${j.driver.firstName} ${j.driver.lastName}` : '',
        j.vehicle?.licensePlate ?? '',
        j.pickupCity,
        j.deliveryCity,
        j.deliveryDate ? new Date(j.deliveryDate).toLocaleString('lv-LV') : '',
      ]),
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aktīvie-reisi-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Close exception panel on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setExceptionPanelJob(null);
      }
    }
    if (exceptionPanelJob) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [exceptionPanelJob]);

  // ── Derived values ──────────────────────────────────────────────────────────

  const currentUserFullName = user
    ? `${(user as unknown as Record<string, string>).firstName ?? ''} ${(user as unknown as Record<string, string>).lastName ?? ''}`.trim()
    : '';

  // A room needs response if the last message was NOT from the current dispatcher/admin
  const needsResponseRooms = chatRooms.filter(
    (r) => r.lastMessage && r.lastMessage.senderName !== currentUserFullName,
  );
  const respondedRooms = chatRooms.filter(
    (r) => r.lastMessage && r.lastMessage.senderName === currentUserFullName,
  );
  const visibleRooms = commentsTab === 'UNREAD' ? needsResponseRooms : chatRooms;

  const exceptionJobIds = new Set(
    exceptions
      .filter((e) => e.status === 'OPEN')
      .map((e) => e.transportJobId)
      .filter(Boolean),
  );

  const lateCount = jobs.filter(isLate).length;
  const atRiskCount = jobs.filter((j) => !isLate(j) && isAtRisk(j)).length;
  const exceptionCount = jobs.filter((j) => exceptionJobIds.has(j.id)).length;
  const inTransitCount = jobs.filter((j) =>
    ['EN_ROUTE_PICKUP', 'AT_PICKUP', 'LOADED', 'EN_ROUTE_DELIVERY', 'AT_DELIVERY'].includes(
      j.status,
    ),
  ).length;

  const filtered = jobs.filter((j) => {
    if (activeFilter === 'LATE' && !isLate(j)) return false;
    if (activeFilter === 'AT_RISK' && (isLate(j) || !isAtRisk(j))) return false;
    if (activeFilter === 'EXCEPTIONS' && !exceptionJobIds.has(j.id)) return false;
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      j.jobNumber?.toLowerCase().includes(term) ||
      j.vehicle?.licensePlate?.toLowerCase().includes(term) ||
      j.pickupCity?.toLowerCase().includes(term) ||
      j.deliveryCity?.toLowerCase().includes(term) ||
      `${j.driver?.firstName} ${j.driver?.lastName}`.toLowerCase().includes(term)
    );
  });

  // ── Exception panel actions ─────────────────────────────────────────────────

  function openExceptionPanel(job: ApiTransportJob, e: React.MouseEvent) {
    e.stopPropagation();
    const jobExceptions = exceptions.filter(
      (ex) => ex.transportJobId === job.id && ex.status === 'OPEN',
    );
    setExceptionPanelJob(job);
    setExceptionPanelItems(jobExceptions);
    setResolutionText('');
  }

  async function handleResolve(ex: ApiTransportJobException) {
    if (!token || !resolutionText.trim()) return;
    setResolvingId(ex.id);
    try {
      await resolveTransportJobException(ex.transportJobId, ex.id, resolutionText, token);
      setExceptionPanelItems((prev) => prev.filter((e) => e.id !== ex.id));
      setExceptions((prev) => prev.filter((e) => e.id !== ex.id));
      setResolutionText('');
      if (exceptionPanelItems.length <= 1) setExceptionPanelJob(null);
    } catch (err) {
      console.error('Failed to resolve exception:', err);
    } finally {
      setResolvingId(null);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 lg:p-8 w-full max-w-350 mx-auto flex flex-col">
      {/* ── Toolbar ── */}
      <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Meklēt numuru, šoferi, vietu..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10 bg-white border-slate-200 focus-visible:ring-black text-sm w-full shadow-sm rounded-lg"
          />
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 self-end sm:self-auto">
          <button
            onClick={() => setViewMode('TABLE')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${
              viewMode === 'TABLE'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <List className="h-3.5 w-3.5" />
            Saraksts
          </button>
          <button
            onClick={() => setViewMode('MAP')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${
              viewMode === 'MAP'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Map className="h-3.5 w-3.5" />
            Karte
          </button>
        </div>
      </div>

      {/* ── KPI filter chips ── */}
      <div className="mb-5 flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setActiveFilter('ALL')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider border transition-all ${
            activeFilter === 'ALL'
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
          }`}
        >
          {jobs.length} Visi
        </button>

        <button
          onClick={() => setActiveFilter(activeFilter === 'AT_RISK' ? 'ALL' : 'AT_RISK')}
          disabled={atRiskCount === 0}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider border transition-all disabled:opacity-40 disabled:cursor-default ${
            activeFilter === 'AT_RISK'
              ? 'bg-orange-500 text-white border-orange-500'
              : 'bg-orange-50 text-orange-700 border-orange-200 enabled:hover:border-orange-400'
          }`}
        >
          <Clock className="h-3.5 w-3.5" />
          {atRiskCount} Riskā
        </button>

        <button
          onClick={() => setActiveFilter(activeFilter === 'EXCEPTIONS' ? 'ALL' : 'EXCEPTIONS')}
          disabled={exceptionCount === 0}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider border transition-all disabled:opacity-40 disabled:cursor-default ${
            activeFilter === 'EXCEPTIONS'
              ? 'bg-amber-600 text-white border-amber-600'
              : 'bg-amber-50 text-amber-700 border-amber-200 hover:border-amber-400 enabled:hover:border-amber-400'
          }`}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          {exceptionCount} Problēm{exceptionCount === 1 ? 'a' : 'as'}
        </button>

        <button
          onClick={() => setActiveFilter(activeFilter === 'LATE' ? 'ALL' : 'LATE')}
          disabled={lateCount === 0}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider border transition-all disabled:opacity-40 disabled:cursor-default ${
            activeFilter === 'LATE'
              ? 'bg-red-600 text-white border-red-600'
              : 'bg-red-50 text-red-700 border-red-200 enabled:hover:border-red-400'
          }`}
        >
          {lateCount} Kavējas
        </button>

        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {inTransitCount} Ceļā
        </span>

        <div className="ml-auto hidden sm:flex items-center gap-2">
          {lastUpdated && (
            <span className="text-xs text-slate-400">
              Atjaunots{' '}
              {lastUpdated.toLocaleTimeString('lv-LV', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            title="Atjaunot"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-[11px] font-bold uppercase tracking-wider text-slate-600 hover:border-slate-400 transition-all disabled:opacity-50 shadow-sm"
          >
            <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
            Atjaunot
          </button>
          <button
            onClick={handleExportCsv}
            title="Eksportēt CSV"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-[11px] font-bold uppercase tracking-wider text-slate-600 hover:border-slate-400 transition-all shadow-sm"
          >
            <Download className="h-3 w-3" />
            CSV
          </button>
        </div>
      </div>

      {/* ── Main content: table + comments sidebar ── */}
      <div className="flex gap-6 items-start">
        <div className="flex-1 min-w-0">
          {/* ── Loading / Empty / Views ── */}
          {loading && jobs.length === 0 ? (
            <div className="flex items-center justify-center py-32 text-slate-400">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 rounded-full border-2 border-slate-200 border-t-black animate-spin" />
                <p className="text-sm font-medium">Ielādē datus...</p>
              </div>
            </div>
          ) : viewMode === 'MAP' ? (
            /* ── MAP VIEW ── */
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden h-150 lg:h-[calc(100vh-260px)] min-h-120 flex flex-col">
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Flotes karte — {filtered.length} aktīvi reisi
                </p>
                {mapSelectedId && (
                  <button
                    onClick={() => router.push(`/dashboard/transport-jobs/${mapSelectedId}`)}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800"
                  >
                    Atvērt detaļas →
                  </button>
                )}
              </div>
              <div className="flex-1 relative">
                <TransportJobsMap
                  jobs={filtered.map(toMapPoint)}
                  selectedId={mapSelectedId}
                  onSelect={setMapSelectedId}
                  truckPositions={truckPositions}
                />
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center py-32 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
              <div className="flex flex-col items-center gap-3 text-slate-500">
                <Truck className="h-10 w-10 text-slate-300" />
                <p className="text-sm font-medium">
                  {activeFilter === 'EXCEPTIONS'
                    ? 'Nav atvērtu problēmu'
                    : activeFilter === 'AT_RISK'
                      ? 'Neviena piegāde nav riskā'
                      : activeFilter === 'LATE'
                        ? 'Neviena piegāde nekavējas'
                        : search
                          ? 'Nav rezultātu meklēšanai'
                          : 'Nav aktīvu piegāžu'}
                </p>
              </div>
            </div>
          ) : (
            /* ── TABLE VIEW ── */
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/50 hover:bg-slate-50/50 border-b-slate-200">
                      <TableHead className="w-32.5 font-semibold text-slate-600">Darbs</TableHead>
                      <TableHead className="font-semibold text-slate-600">Statuss</TableHead>
                      <TableHead className="font-semibold text-slate-600">Šoferis / Auto</TableHead>
                      <TableHead className="font-semibold text-slate-600">Maršruts</TableHead>
                      <TableHead className="font-semibold text-slate-600 text-right">
                        Mērķa laiks
                      </TableHead>
                      <TableHead className="w-12.5"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((job) => {
                      const cfg = STATUS_CONFIG[job.status];
                      const hasErr = exceptionJobIds.has(job.id);
                      const isJobLate = isLate(job);
                      const isJobAtRisk = !isJobLate && isAtRisk(job);

                      return (
                        <TableRow
                          key={job.id}
                          onClick={() => router.push(`/dashboard/transport-jobs/${job.id}`)}
                          className={`group hover:bg-slate-50 cursor-pointer transition-colors ${hasErr ? 'bg-amber-50/40' : ''} ${isJobLate ? 'bg-red-50/20' : ''} ${isJobAtRisk ? 'bg-orange-50/30' : ''}`}
                        >
                          <TableCell className="py-4">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-black">#{job.jobNumber}</span>
                              {hasErr && (
                                <button
                                  onClick={(e) => openExceptionPanel(job, e)}
                                  title="Skatīt problēmu"
                                  className="p-0.5 rounded hover:bg-amber-100 transition-colors"
                                >
                                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                                </button>
                              )}
                            </div>
                          </TableCell>

                          <TableCell className="py-4">
                            <div className="flex items-center gap-2">
                              <span
                                className={`h-2 w-2 rounded-full ${cfg?.dot || 'bg-slate-400'}`}
                              />
                              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                                {cfg?.label || job.status}
                              </span>
                            </div>
                          </TableCell>

                          <TableCell className="py-4">
                            <div className="flex flex-col">
                              <span className="text-sm font-semibold text-slate-900">
                                {job.driver
                                  ? `${job.driver.firstName} ${job.driver.lastName}`
                                  : 'Meklē šoferi'}
                              </span>
                              <span className="text-xs text-slate-500 font-medium mt-0.5">
                                {job.vehicle?.licensePlate || 'Nav auto'}
                              </span>
                            </div>
                          </TableCell>

                          <TableCell className="py-4">
                            <div className="flex items-center gap-3">
                              <span
                                className="text-sm font-medium text-slate-700 truncate max-w-37.5 block"
                                title={job.pickupCity}
                              >
                                {job.pickupCity}
                              </span>
                              <ChevronRight className="h-3.5 w-3.5 text-slate-300 shrink-0" />
                              <span
                                className="text-sm font-bold text-slate-900 truncate max-w-37.5 block"
                                title={job.deliveryCity}
                              >
                                {job.deliveryCity}
                              </span>
                            </div>
                          </TableCell>

                          <TableCell className="py-4 text-right">
                            <div className="flex flex-col items-end">
                              <span
                                className={`text-sm font-semibold ${isJobLate ? 'text-red-600' : isJobAtRisk ? 'text-orange-500' : 'text-slate-900'}`}
                              >
                                {fmtTime(job.deliveryDate)}
                              </span>
                              <span className="text-xs text-slate-500 mt-0.5">
                                {fmtDate(job.deliveryDate)}
                              </span>
                            </div>
                          </TableCell>

                          <TableCell className="py-4 text-right">
                            <ChevronRight className="h-4 w-4 inline-block text-slate-300 group-hover:text-slate-600 transition-colors" />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
        {/* end flex-1 */}

        {/* ── Comments Sidebar ── */}
        <div
          className="hidden xl:flex flex-col w-80 2xl:w-96 shrink-0 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
          style={{ minHeight: 480 }}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 shrink-0">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-bold text-slate-900">Komentāri</p>
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  needsResponseRooms.length > 0
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {needsResponseRooms.length > 0 ? `${needsResponseRooms.length} jauni` : 'Kārtībā'}
              </span>
            </div>
            <div className="flex gap-0.5 bg-slate-100 p-0.5 rounded-md">
              <button
                onClick={() => setCommentsTab('UNREAD')}
                className={`flex-1 text-[11px] font-bold uppercase tracking-wider py-1 rounded transition-all ${
                  commentsTab === 'UNREAD'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Atbilde vajadzīga
                {needsResponseRooms.length > 0 && ` (${needsResponseRooms.length})`}
              </button>
              <button
                onClick={() => setCommentsTab('ALL')}
                className={`flex-1 text-[11px] font-bold uppercase tracking-wider py-1 rounded transition-all ${
                  commentsTab === 'ALL'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Visi ({chatRooms.length})
              </button>
            </div>
          </div>

          {/* Message list */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {visibleRooms.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-slate-400">
                <CheckCircle2 className="h-8 w-8 text-emerald-300" />
                <p className="text-xs font-medium text-slate-500">
                  {commentsTab === 'UNREAD' ? 'Nekas neprasa atbildi' : 'Nav aktīvu sarunu'}
                </p>
              </div>
            ) : (
              visibleRooms.map((room) => {
                const isActive = activeChatJobId === room.jobId;
                const needsReply = room.lastMessage?.senderName !== currentUserFullName;
                return (
                  <div
                    key={room.jobId}
                    className={`p-3 cursor-pointer hover:bg-slate-50 transition-colors ${isActive ? 'bg-blue-50/50' : ''}`}
                  >
                    <div
                      className="space-y-1.5"
                      onClick={() => setActiveChatJobId(isActive ? null : (room.jobId ?? null))}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">
                            #{room.jobNumber}
                            {room.pickupCity && room.deliveryCity && (
                              <span className="font-normal text-slate-500">
                                {' '}
                                · {room.pickupCity} → {room.deliveryCity}
                              </span>
                            )}
                          </p>
                          <p
                            className={`text-xs mt-0.5 leading-relaxed line-clamp-2 ${needsReply ? 'text-slate-800 font-medium' : 'text-slate-500'}`}
                          >
                            <span className="text-slate-400">{room.lastMessage?.senderName}: </span>
                            {room.lastMessage?.body}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          {room.lastMessage && (
                            <span className="text-[10px] text-slate-400 whitespace-nowrap">
                              {new Date(room.lastMessage.createdAt).toLocaleTimeString('lv-LV', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          )}
                          {needsReply && (
                            <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Inline reply box */}
                    {isActive && (
                      <div className="mt-2 flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && room.jobId) handleSendChat(room.jobId);
                          }}
                          placeholder="Atbildēt..."
                          className="flex-1 text-xs px-2.5 py-1.5 rounded-md border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 min-w-0"
                        />
                        <button
                          onClick={() => room.jobId && handleSendChat(room.jobId)}
                          disabled={!chatInput.trim() || sendingChat}
                          className="px-2.5 py-1.5 rounded-md bg-slate-900 text-white text-xs font-bold disabled:opacity-40 hover:bg-slate-700 transition-colors shrink-0"
                        >
                          {sendingChat ? '...' : '↑'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-slate-100 shrink-0">
            <button
              onClick={() => router.push('/dashboard/messages')}
              className="w-full text-center text-[11px] font-bold text-slate-400 hover:text-slate-700 uppercase tracking-wider transition-colors"
            >
              Skatīt visas sarunas →
            </button>
          </div>
        </div>
      </div>
      {/* end flex gap-6 */}

      {/* ── Exception Side Panel ── */}
      {exceptionPanelJob && (
        <div className="fixed inset-0 z-40 flex justify-end pointer-events-none">
          <div
            ref={panelRef}
            className="pointer-events-auto w-full max-w-md h-full bg-white shadow-2xl border-l border-slate-200 flex flex-col"
          >
            {/* Panel header */}
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <p className="font-bold text-slate-900 text-sm">
                    Problēmas — #{exceptionPanelJob.jobNumber}
                  </p>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {exceptionPanelJob.pickupCity} → {exceptionPanelJob.deliveryCity}
                </p>
              </div>
              <button
                onClick={() => setExceptionPanelJob(null)}
                className="p-1.5 rounded-md hover:bg-slate-200 transition-colors"
              >
                <X className="h-4 w-4 text-slate-600" />
              </button>
            </div>

            {/* Exception list */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {exceptionPanelItems.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12 text-slate-400">
                  <CheckCircle2 className="h-10 w-10 text-emerald-400" />
                  <p className="text-sm font-medium text-slate-500">Visas problēmas atrisinātas</p>
                </div>
              ) : (
                exceptionPanelItems.map((ex) => (
                  <div
                    key={ex.id}
                    className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-slate-900">
                          {EXCEPTION_TYPE_LABELS[ex.type] ?? ex.type}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500">
                          <Clock className="h-3 w-3" />
                          {new Date(ex.createdAt).toLocaleString('lv-LV', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-200 text-amber-800">
                        Atvērts
                      </span>
                    </div>

                    {ex.notes && (
                      <p className="text-sm text-slate-700 bg-white rounded-lg p-3 border border-amber-100 leading-relaxed">
                        {ex.notes}
                      </p>
                    )}

                    {/* Quick resolve */}
                    <div className="space-y-2 pt-1">
                      <Textarea
                        placeholder="Atrisinājuma komentārs..."
                        value={resolutionText}
                        onChange={(e) => setResolutionText(e.target.value)}
                        rows={2}
                        className="text-sm resize-none bg-white border-slate-200 focus-visible:ring-amber-400"
                      />
                      <Button
                        size="sm"
                        className="w-full bg-slate-900 hover:bg-slate-700 text-white font-bold text-xs uppercase tracking-wider"
                        onClick={() => handleResolve(ex)}
                        disabled={!resolutionText.trim() || resolvingId === ex.id}
                      >
                        {resolvingId === ex.id ? (
                          <div className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin mr-2" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5 mr-2" />
                        )}
                        Atrisināt
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-slate-100 shrink-0">
              <button
                onClick={() => router.push(`/dashboard/transport-jobs/${exceptionPanelJob.id}`)}
                className="w-full text-center text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors uppercase tracking-wider"
              >
                Atvērt pilnu darba skatu →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

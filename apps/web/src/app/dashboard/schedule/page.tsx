'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  getDriverAvailability,
  toggleDriverOnline,
  updateDriverSchedule,
  blockDriverDate,
  unblockDriverDate,
  type DriverAvailability,
  type DriverScheduleDay,
} from '@/lib/api';
import {
  CalendarOff,
  CalendarPlus,
  CheckCircle2,
  Clock,
  Info,
  Loader2,
  Power,
  RefreshCw,
  Settings2,
  Trash2,
  Truck,
  XCircle,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';

// ── Constants ──────────────────────────────────────────────────────────────────

const DAYS = [
  { dow: 1, label: 'Pirmdiena', short: 'P' },
  { dow: 2, label: 'Otrdiena', short: 'O' },
  { dow: 3, label: 'Trešdiena', short: 'T' },
  { dow: 4, label: 'Ceturtdiena', short: 'C' },
  { dow: 5, label: 'Piektdiena', short: 'Pk' },
  { dow: 6, label: 'Sestdiena', short: 'S' },
  { dow: 0, label: 'Svētdiena', short: 'Sv' },
];

const DEFAULT_START = '07:00';
const DEFAULT_END = '18:00';

// ── 24-hour time picker ───────────────────────────────────────────────────────

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = ['00', '15', '30', '45'];

function TimePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [h, m] = (value ?? '00:00').split(':');
  const hh = h?.padStart(2, '0') ?? '00';
  const mm = MINUTES.includes(m ?? '') ? (m ?? '00') : '00';

  const selectCls =
    'rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs font-mono text-slate-700 focus:outline-none focus:ring-2 focus:ring-green-300 appearance-none cursor-pointer';

  return (
    <div className="flex items-center gap-0.5">
      <select
        value={hh}
        onChange={(e) => onChange(`${e.target.value}:${mm}`)}
        className={selectCls}
      >
        {HOURS.map((hr) => (
          <option key={hr} value={hr}>
            {hr}
          </option>
        ))}
      </select>
      <span className="text-slate-400 text-xs font-mono">:</span>
      <select
        value={mm}
        onChange={(e) => onChange(`${hh}:${e.target.value}`)}
        className={selectCls}
      >
        {MINUTES.map((mn) => (
          <option key={mn} value={mn}>
            {mn}
          </option>
        ))}
      </select>
    </div>
  );
}

function buildDefaultSchedule(existing: DriverScheduleDay[]): DriverScheduleDay[] {
  return DAYS.map(({ dow }) => {
    const found = existing.find((d) => d.dayOfWeek === dow);
    return (
      found ?? {
        dayOfWeek: dow,
        enabled: dow >= 1 && dow <= 5, // Mon-Fri on by default
        startTime: DEFAULT_START,
        endTime: DEFAULT_END,
      }
    );
  });
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('lv-LV', {
    weekday: 'short',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function OnlineToggle({
  isOnline,
  effectiveOnline,
  autoSchedule,
  loading,
  onToggle,
}: {
  isOnline: boolean;
  effectiveOnline: boolean;
  autoSchedule: boolean;
  loading: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={[
        'rounded-2xl p-6 flex items-center justify-between gap-4 transition-colors duration-500',
        effectiveOnline
          ? 'bg-green-50 border border-green-200'
          : 'bg-slate-50 border border-slate-200',
      ].join(' ')}
    >
      <div className="flex items-center gap-4">
        <div
          className={[
            'w-14 h-14 rounded-2xl flex items-center justify-center',
            effectiveOnline ? 'bg-green-100' : 'bg-slate-200',
          ].join(' ')}
        >
          <Truck
            className={['h-7 w-7', effectiveOnline ? 'text-green-600' : 'text-slate-500'].join(' ')}
          />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span
              className={[
                'inline-block w-2.5 h-2.5 rounded-full',
                effectiveOnline ? 'bg-green-500 animate-pulse' : 'bg-slate-400',
              ].join(' ')}
            />
            <p className="text-lg font-bold text-slate-900">
              {effectiveOnline ? 'Tiešsaistē' : 'Bezsaistē'}
            </p>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            {autoSchedule
              ? 'Automātiskais režīms — statuss mainās pēc grafika'
              : effectiveOnline
                ? 'Redzams darbā jaunajiem pasūtījumiem'
                : 'Jauni pasūtījumi netiek piedāvāti'}
          </p>
        </div>
      </div>

      {!autoSchedule && (
        <button
          onClick={onToggle}
          disabled={loading}
          className={[
            'flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm transition-all shadow-sm',
            isOnline
              ? 'bg-slate-200 hover:bg-slate-300 text-slate-700'
              : 'bg-green-600 hover:bg-green-700 text-white',
          ].join(' ')}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
          {isOnline ? 'Iet bezsaistē' : 'Iet tiešsaistē'}
        </button>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DriverSchedulePage() {
  const router = useRouter();
  const { user, token, isLoading } = useAuth();

  const [data, setData] = useState<DriverAvailability | null>(null);
  const [schedule, setSchedule] = useState<DriverScheduleDay[]>([]);
  const [autoSchedule, setAutoSchedule] = useState(false);
  const [maxJobs, setMaxJobs] = useState<number | ''>('');
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);

  // Date blocking
  const [blockDate, setBlockDate] = useState('');
  const [blockReason, setBlockReason] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const av = await getDriverAvailability(token);
      setData(av);
      setSchedule(buildDefaultSchedule(av.weeklySchedule));
      setAutoSchedule(av.autoSchedule);
      setMaxJobs(av.maxJobsPerDay ?? '');
    } catch {
      // not a driver
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (isLoading) return;
    if (!token) {
      router.push('/');
      return;
    }
    if (!user?.canTransport) {
      router.push('/dashboard');
      return;
    }
    load();
  }, [token, isLoading, user, router, load]);

  const handleToggle = async () => {
    if (!token || !data) return;
    setToggling(true);
    try {
      const res = await toggleDriverOnline(!data.isOnline, token);
      setData((prev) =>
        prev ? { ...prev, isOnline: res.isOnline, effectiveOnline: res.isOnline } : prev,
      );
    } finally {
      setToggling(false);
    }
  };

  const handleSaveSchedule = async () => {
    if (!token) return;
    setSaving(true);
    setSaveOk(false);
    try {
      const updated = await updateDriverSchedule(
        {
          days: schedule,
          autoSchedule,
          maxJobsPerDay: maxJobs === '' ? null : Number(maxJobs),
        },
        token,
      );
      setData(updated);
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleBlockDate = async () => {
    if (!token || !blockDate) return;
    setAdding(true);
    try {
      const block = await blockDriverDate(blockDate, blockReason || undefined, token);
      setData((prev) => (prev ? { ...prev, dateBlocks: [...prev.dateBlocks, block] } : prev));
      setBlockDate('');
      setBlockReason('');
    } finally {
      setAdding(false);
    }
  };

  const handleUnblock = async (id: string) => {
    if (!token) return;
    await unblockDriverDate(id, token);
    setData((prev) =>
      prev ? { ...prev, dateBlocks: prev.dateBlocks.filter((b) => b.id !== id) } : prev,
    );
  };

  const updateDay = (dow: number, patch: Partial<DriverScheduleDay>) => {
    setSchedule((prev) => prev.map((d) => (d.dayOfWeek === dow ? { ...d, ...patch } : d)));
  };

  if (!token || !user?.canTransport) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-center text-slate-500">
        <p>Nav vadītāja profila. Sazinieties ar uzņēmuma administratoru.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Clock className="h-6 w-6 text-red-600" />
          Darba grafiks
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Pārvaldiet savu pieejamību, darba laiku un brīvdienas
        </p>
      </div>

      {/* ── Online/Offline toggle ── */}
      <OnlineToggle
        isOnline={data.isOnline}
        effectiveOnline={data.effectiveOnline}
        autoSchedule={data.autoSchedule}
        loading={toggling}
        onToggle={handleToggle}
      />

      {/* ── Weekly schedule ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            Iknedēļas darba laiks
          </h2>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Auto-režīms</span>
            <Switch
              checked={autoSchedule}
              onCheckedChange={(v) => setAutoSchedule(v)}
              className="data-[state=checked]:bg-green-500"
            />
          </div>
        </div>

        {autoSchedule && (
          <div className="flex items-start gap-2 rounded-xl bg-blue-50 border border-blue-100 px-3 py-2 text-xs text-blue-700">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            Auto-režīmā statuss tiek automātiski mainīts uz tiešsaistē/bezsaistē saskaņā ar zemāk
            norādīto grafiku.
          </div>
        )}

        <div className="space-y-2">
          {DAYS.map(({ dow, label }) => {
            const day = schedule.find((d) => d.dayOfWeek === dow) ?? {
              dayOfWeek: dow,
              enabled: false,
              startTime: DEFAULT_START,
              endTime: DEFAULT_END,
            };
            return (
              <div
                key={dow}
                className={[
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors',
                  day.enabled
                    ? 'bg-green-50 border border-green-100'
                    : 'bg-slate-50 border border-slate-100',
                ].join(' ')}
              >
                {/* Day toggle */}
                <Switch
                  checked={day.enabled}
                  onCheckedChange={(v) => updateDay(dow, { enabled: v })}
                  className="shrink-0 data-[state=checked]:bg-green-500"
                />

                {/* Day name */}
                <span
                  className={[
                    'w-24 text-sm font-medium',
                    day.enabled ? 'text-slate-800' : 'text-slate-400',
                  ].join(' ')}
                >
                  {label}
                </span>

                {/* Time inputs */}
                {day.enabled ? (
                  <div className="flex items-center gap-2 ml-auto">
                    <TimePicker
                      value={day.startTime}
                      onChange={(v) => updateDay(dow, { startTime: v })}
                    />
                    <span className="text-slate-400 text-xs">—</span>
                    <TimePicker
                      value={day.endTime}
                      onChange={(v) => updateDay(dow, { endTime: v })}
                    />
                  </div>
                ) : (
                  <span className="ml-auto text-xs text-slate-400">Brīvdiena</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Preferences ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">Preferences</h2>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-slate-700 font-medium">Maks. darbu skaits dienā</p>
            <p className="text-xs text-slate-400 mt-0.5">Atstājiet tukšu — bez ierobežojuma</p>
          </div>
          <input
            type="number"
            min={1}
            max={10}
            value={maxJobs}
            onChange={(e) => setMaxJobs(e.target.value === '' ? '' : Number(e.target.value))}
            placeholder="—"
            className="w-20 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-red-300"
          />
        </div>
      </div>

      {/* ── Save schedule button ── */}
      <button
        onClick={handleSaveSchedule}
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold py-3 text-sm transition-colors"
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : saveOk ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
        {saveOk ? 'Saglabāts!' : 'Saglabāt grafiku'}
      </button>

      {/* ── Blocked dates ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <CalendarOff className="h-4 w-4 text-red-500" />
          Bloķētās dienas
        </h2>

        {/* Add new block */}
        <div className="flex gap-2">
          <input
            type="date"
            value={blockDate}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setBlockDate(e.target.value)}
            className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
          />
          <input
            type="text"
            value={blockReason}
            onChange={(e) => setBlockReason(e.target.value)}
            placeholder="Iemesls (nav obligāts)"
            className="flex-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
          />
          <button
            onClick={handleBlockDate}
            disabled={!blockDate || adding}
            className="flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 text-sm font-medium disabled:opacity-40 transition-colors"
          >
            {adding ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CalendarPlus className="h-3.5 w-3.5" />
            )}
            Pievienot
          </button>
        </div>

        {/* List */}
        {data.dateBlocks.length === 0 ? (
          <div className="py-6 text-center text-slate-400 text-sm">Nav bloķētu dienu</div>
        ) : (
          <div className="space-y-2">
            {data.dateBlocks.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-red-50 border border-red-100 px-4 py-2.5"
              >
                <div className="flex items-center gap-2.5">
                  <XCircle className="h-4 w-4 text-red-400 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-slate-800">{fmtDate(b.blockedDate)}</p>
                    {b.reason && <p className="text-xs text-slate-500">{b.reason}</p>}
                  </div>
                </div>
                <button
                  onClick={() => handleUnblock(b.id)}
                  className="p-1.5 rounded-lg hover:bg-red-100 text-red-400 hover:text-red-600 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

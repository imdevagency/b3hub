/**
 * Driver schedule page — /dashboard/schedule
 * Weekly calendar for drivers to set their availability windows.
 */
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
  Info,
  Loader2,
  Power,
  Settings2,
  Trash2,
  CalendarDays,
  WifiOff,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { PageHeader } from '@/components/ui/page-header';
import { PageSpinner } from '@/components/ui/page-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import { fmtDate } from '@/lib/format';

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

// ── Time input ────────────────────────────────────────────────────────────────

function TimePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [h, m] = (value ?? '00:00').split(':').map(Number);
  const hours = isNaN(h) ? 0 : h;
  const mins = isNaN(m) ? 0 : m;

  const fmt = (n: number) => String(n).padStart(2, '0');

  const stepTime = (deltaMins: number) => {
    const total = hours * 60 + mins + deltaMins;
    const clamped = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
    onChange(`${fmt(Math.floor(clamped / 60))}:${fmt(clamped % 60)}`);
  };

  return (
    <div className="flex items-center bg-muted/40 rounded-xl p-1 border border-border/50 shadow-sm transition-colors hover:border-border/80">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-background"
        onClick={() => stepTime(-15)}
      >
        <span className="text-lg leading-none font-medium">−</span>
      </Button>
      <div className="w-14 text-center font-mono text-sm font-bold tabular-nums">
        {fmt(hours)}
        <span className="text-muted-foreground/60 mx-0.5">:</span>
        {fmt(mins)}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-background"
        onClick={() => stepTime(15)}
      >
        <span className="text-lg leading-none font-medium">+</span>
      </Button>
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
      router.push('/login');
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

  if (loading) return <PageSpinner />;

  if (!data) {
    return (
      <div className="max-w-xl mx-auto py-20">
        <EmptyState
          icon={CalendarOff}
          title="Nav vadītāja profila"
          description="Sazinieties ar uzņēmuma administratoru, lai aktivizētu vadītāja piekļuvi."
        />
      </div>
    );
  }

  const effectiveOnline = data.effectiveOnline;

  return (
    <div className="max-w-xl mx-auto pb-20">
      <PageHeader title="Darba grafiks" description="Pārvaldi savu pieejamību un darba laikus" />

      {/* ── Status Section ── */}
      <div className="px-1 py-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div
            className={cn(
              'w-4 h-4 rounded-full',
              effectiveOnline
                ? 'bg-green-500 shadow-[0_0_12px_2px_rgba(34,197,94,0.4)]'
                : 'bg-muted-foreground/30',
            )}
          />
          <div>
            <h2
              className={cn(
                'text-2xl font-bold tracking-tight',
                effectiveOnline ? 'text-green-600' : 'text-foreground',
              )}
            >
              {effectiveOnline ? 'Tiešsaistē' : 'Bezsaistē'}
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {data.autoSchedule
                ? 'Statuss mainās automātiski'
                : effectiveOnline
                  ? 'Gaidām jaunus pasūtījumus!'
                  : 'Jaunus pasūtījumus nesaņemsi.'}
            </p>
          </div>
        </div>
        {!data.autoSchedule && (
          <Button
            onClick={handleToggle}
            disabled={toggling}
            variant={data.isOnline ? 'secondary' : 'default'}
            size="lg"
            className={cn(
              'rounded-full font-bold px-8',
              !data.isOnline && 'bg-black text-white hover:bg-zinc-800',
            )}
          >
            {toggling ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : data.isOnline ? (
              'Apturēt'
            ) : (
              'Gatavs darbam'
            )}
          </Button>
        )}
      </div>

      <Separator className="my-2" />

      {/* ── Weekly schedule ── */}
      <div className="py-6">
        <div className="flex items-center justify-between mb-6 px-1">
          <h3 className="text-lg font-bold tracking-tight">Iknedēļas grafiks</h3>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground">Auto-režīms</span>
            <Switch checked={autoSchedule} onCheckedChange={(v) => setAutoSchedule(v)} />
          </div>
        </div>

        {autoSchedule && (
          <div className="mb-6 px-4 py-3 rounded-xl bg-muted/50 text-sm text-muted-foreground flex gap-3 items-start">
            <Info className="h-5 w-5 shrink-0 text-foreground" />
            <p>Programma automātiski pārslēgs tavu statusu atbilstoši šim grafikam.</p>
          </div>
        )}

        <div className="space-y-4">
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
                className={cn(
                  'flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border transition-colors',
                  day.enabled
                    ? 'border-border bg-card'
                    : 'border-dashed border-border/60 bg-muted/30',
                )}
              >
                <div className="flex items-center gap-3">
                  <Switch
                    checked={day.enabled}
                    onCheckedChange={(v) => updateDay(dow, { enabled: v })}
                  />
                  <span
                    className={cn(
                      'font-semibold',
                      day.enabled ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {label}
                  </span>
                </div>
                {day.enabled ? (
                  <div className="flex items-center gap-2">
                    <TimePicker
                      value={day.startTime}
                      onChange={(v) => updateDay(dow, { startTime: v })}
                    />
                    <span className="text-muted-foreground">—</span>
                    <TimePicker
                      value={day.endTime}
                      onChange={(v) => updateDay(dow, { endTime: v })}
                    />
                  </div>
                ) : (
                  <span className="text-sm font-medium text-muted-foreground">Nav pieejams</span>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex items-center justify-between p-4 rounded-2xl border border-border bg-card">
          <div>
            <p className="font-semibold">Dienas limits</p>
            <p className="text-sm text-muted-foreground">
              Maksimālais darbu skaits (tukšs = bez limita)
            </p>
          </div>
          <Input
            type="number"
            min={1}
            max={15}
            value={maxJobs}
            onChange={(e) => setMaxJobs(e.target.value === '' ? '' : Number(e.target.value))}
            placeholder="—"
            className="w-20 text-center font-bold text-lg h-12 rounded-xl"
          />
        </div>

        <Button
          onClick={handleSaveSchedule}
          disabled={saving}
          size="lg"
          className="w-full mt-6 rounded-full font-bold text-base h-14 bg-black hover:bg-zinc-800 text-white"
        >
          {saving ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : saveOk ? (
            <>
              <CheckCircle2 className="h-5 w-5 mr-2 text-green-400" />
              Saglabāts
            </>
          ) : (
            'Saglabāt grafiku'
          )}
        </Button>
      </div>

      <Separator className="my-2" />

      {/* ── Blocked dates ── */}
      <div className="py-6">
        <div className="flex items-center justify-between mb-6 px-1">
          <h3 className="text-lg font-bold tracking-tight">Bloķētās dienas</h3>
          {data.dateBlocks.length > 0 && (
            <Badge variant="secondary" className="rounded-full px-3">
              {data.dateBlocks.length}
            </Badge>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <Input
            type="date"
            value={blockDate}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setBlockDate(e.target.value)}
            className="flex-1 h-12 rounded-xl px-4"
          />
          <Input
            type="text"
            value={blockReason}
            onChange={(e) => setBlockReason(e.target.value)}
            placeholder="Iemesls..."
            className="flex-2 h-12 rounded-xl px-4"
          />
          <Button
            onClick={handleBlockDate}
            disabled={!blockDate || adding}
            size="lg"
            className="h-12 w-full sm:w-auto rounded-xl px-8 font-bold bg-black hover:bg-zinc-800 text-white shrink-0"
          >
            {adding ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Pievienot'}
          </Button>
        </div>

        {data.dateBlocks.length === 0 ? (
          <EmptyState
            icon={CalendarOff}
            title="Nav izņēmumu"
            description="Jūs būsiet pieejams atbilstoši regulārajam grafikam."
          />
        ) : (
          <div className="space-y-3">
            {data.dateBlocks.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between p-4 rounded-2xl border border-border bg-card"
              >
                <div>
                  <p className="font-bold">{fmtDate(b.blockedDate)}</p>
                  {b.reason && <p className="text-sm text-muted-foreground">{b.reason}</p>}
                </div>
                <Button
                  onClick={() => handleUnblock(b.id)}
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-full"
                >
                  <Trash2 className="h-5 w-5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

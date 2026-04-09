'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, RefreshCw, Search, Truck } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { fmtDate, fmtMoney } from '@/lib/format';
import { JOB_STATUS, StatusBadgeHex } from '@/lib/status-config';
import { useTransportJobs } from '@/hooks/use-transport-jobs';
import { QuickStat } from './quick-stat';

export function CarrierHistoryView({ token }: { token: string }) {
  const { jobs, loading, reload } = useTransportJobs(token);
  const [filter, setFilter] = useState<'all' | 'active' | 'done'>('all');

  const ACTIVE = [
    'ACCEPTED',
    'EN_ROUTE_PICKUP',
    'AT_PICKUP',
    'LOADED',
    'EN_ROUTE_DELIVERY',
    'AT_DELIVERY',
  ];

  const filtered = jobs.filter((j) => {
    if (filter === 'active') return ACTIVE.includes(j.status);
    if (filter === 'done') return j.status === 'DELIVERED';
    return true;
  });

  const totalTonnes = filtered
    .filter((j) => ACTIVE.includes(j.status))
    .reduce((s, j) => s + (j.cargoWeight ?? 0) / 1000, 0);

  const totalEarnings = filtered
    .filter((j) => j.status === 'DELIVERED')
    .reduce((s, j) => s + (j.rate ?? 0), 0);

  return (
    <div className="space-y-4">
      {/* QUICK STATS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 py-2 mt-4">
        <QuickStat value={String(jobs.length)} label="Kopā darbi" />
        <QuickStat
          value={String(jobs.filter((j) => ACTIVE.includes(j.status)).length)}
          label="Aktīvie"
        />
        <QuickStat value={`${totalTonnes.toFixed(1)} t`} label="Tonnas tranzītā" />
        <QuickStat value={fmtMoney(totalEarnings)} label="Nopelnīts" />
      </div>

      {/* Filter + refresh */}
      <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
        <div className="flex gap-1 bg-muted/50 rounded-xl p-1 w-fit">
          {(['all', 'active', 'done'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                filter === f
                  ? 'bg-background shadow-xs text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              {f === 'all' ? 'Visi' : f === 'active' ? 'Aktīvie' : 'Pabeigti'}
            </button>
          ))}
        </div>
        <button
          onClick={reload}
          disabled={loading}
          className="flex items-center gap-2 rounded-full bg-muted/40 hover:bg-muted/80 px-4 py-2 text-sm font-medium text-foreground transition-colors border-0"
        >
          <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          Atjaunot
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="py-16 text-center text-muted-foreground text-sm">Ielādē...</div>
      ) : jobs.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="Nav neviena darba"
          description="Vēl neesat pieņēmuši nevienu darbu. Atveriet darbu dēli, lai atrastu un pieņemtu jaunus kravu pārvadāšanas darbus."
          action={
            <Link
              href="/dashboard/jobs"
              className="inline-flex items-center gap-2 bg-foreground hover:opacity-90 text-background font-semibold rounded-full px-6 py-3 text-sm transition-all"
            >
              <Search className="h-4 w-4" />
              Meklēt darbus
            </Link>
          }
        />
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center space-y-2">
          <Truck className="mx-auto size-10 text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm">Nav darbu šajā kategorijā</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filtered.map((job) => {
            const st = JOB_STATUS[job.status] ?? {
              label: job.status,
              bg: '#f3f4f6',
              text: '#374151',
            };
            const weightTStr = job.cargoWeight ? `${(job.cargoWeight / 1000).toFixed(2)} t` : '—';
            return (
              <Link
                key={job.id}
                href={`/dashboard/transport-jobs/${job.id}`}
                className="group block relative bg-background border border-border/50 rounded-2xl p-5 mb-3 hover:bg-muted/30 transition-all duration-300"
              >
                {/* Meta Top Row */}
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <p className="font-mono font-semibold text-[10px] text-muted-foreground uppercase tracking-widest">
                        #{job.jobNumber}
                      </p>
                      <StatusBadgeHex cfg={st} />
                    </div>
                    <h3 className="text-xl font-black tracking-tight text-foreground">
                      {fmtMoney(job.rate ?? 0)}
                    </h3>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1 text-sm text-muted-foreground font-medium">
                      <span>{job.cargoType}</span>
                      <span>•</span>
                      <span>{weightTStr}</span>
                      {job.distanceKm && (
                        <>
                          <span>•</span>
                          <span>{job.distanceKm} km</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Timeline Route */}
                <div className="flex items-start bg-muted/20 rounded-xl p-3 border border-transparent group-hover:border-border/50">
                  <div className="flex flex-col items-center mr-3 mt-1.5">
                    <div className="w-2 h-2 rounded-full bg-primary z-10 shrink-0" />
                    <div className="w-px h-5 bg-border my-0.5 shrink-0" />
                    <div className="w-2 h-2 rounded-[1px] bg-black z-10 shrink-0" />
                  </div>
                  <div className="flex flex-col gap-2 flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold leading-none">{job.pickupCity}</p>
                      <span className="text-xs font-medium text-muted-foreground">
                        {fmtDate(job.pickupDate)}
                      </span>
                    </div>
                    <p className="text-sm font-semibold leading-none text-muted-foreground">
                      {job.deliveryCity}
                    </p>
                  </div>
                </div>

                {/* Vehicle & assignment footer */}
                {job.vehicle && (
                  <div className="mt-4 flex items-center justify-between border-t border-border/40 pt-3">
                    <div className="flex items-center gap-2">
                      <Truck className="size-3.5 text-muted-foreground" />
                      <span className="text-xs font-bold text-foreground">
                        {job.vehicle.licensePlate}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[12px] font-bold text-black uppercase tracking-wider group-hover:underline">
                      Skatīt
                      <ArrowRight className="size-3" />
                    </div>
                  </div>
                )}
                {!job.vehicle && (
                  <div className="mt-4 flex items-center justify-end border-t border-border/40 pt-3">
                    <div className="flex items-center gap-1 text-[12px] font-bold text-black uppercase tracking-wider group-hover:underline">
                      Skatīt
                      <ArrowRight className="size-3" />
                    </div>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';

interface StatCardProps {
  /** Icon component (e.g. from lucide-react). */
  icon: React.ElementType;
  /** Short label above the value. */
  label: string;
  /** Primary display value. */
  value: string;
  /** Optional secondary text below the value. */
  sub?: string;
  /** Tailwind class applied to the value text (e.g. "text-amber-600"). */
  accent?: string;
  /** Tailwind class applied to the icon container background (e.g. "bg-blue-50"). Defaults to "bg-muted". */
  iconBg?: string;
  /** Tailwind class applied to the icon element (e.g. "text-blue-600"). Defaults to "text-muted-foreground". */
  iconColor?: string;
}

/**
 * Shared KPI stat card used across all admin dashboard sections.
 *
 * @example
 *   <StatCard label="Šodien" value={fmtMoney(123)} icon={Banknote} />
 *   <StatCard label="Kavētie" value="3" icon={AlertTriangle} accent="text-red-600" />
 *   <StatCard label="Aktīvie" value="12" icon={Briefcase} iconBg="bg-blue-50" iconColor="text-blue-600" />
 */
export function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
  iconBg = 'bg-muted',
  iconColor = 'text-muted-foreground',
}: StatCardProps) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">
              {label}
            </p>
            <p className={`mt-1 text-2xl font-bold tabular-nums ${accent ?? 'text-foreground'}`}>
              {value}
            </p>
            {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
          </div>
          <div className={`rounded-xl p-2.5 shrink-0 ${iconBg}`}>
            <Icon className={`h-5 w-5 ${iconColor}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

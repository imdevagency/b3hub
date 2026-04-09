'use client';

export function QuickStat({
  value,
  label,
  alert,
}: {
  value: string;
  label: string;
  alert?: boolean;
}) {
  return (
    <div
      className={`p-4 rounded-2xl ${alert ? 'bg-red-50 text-red-900 border border-red-100' : 'bg-muted/30 border border-transparent'} flex flex-col justify-center`}
    >
      <span
        className={`text-xs font-semibold uppercase tracking-wider mb-1 ${alert ? 'text-red-700' : 'text-muted-foreground'}`}
      >
        {label}
      </span>
      <span className={`text-2xl font-bold tracking-tight ${alert ? '' : 'text-foreground'}`}>
        {value}
      </span>
    </div>
  );
}

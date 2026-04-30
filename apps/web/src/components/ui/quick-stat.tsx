interface QuickStatProps {
  value: string;
  label: string;
  /** When true renders with a red alert style. Only applies to the `card` variant. */
  alert?: boolean;
  /**
   * `card` — default; renders with a border/bg card shell.
   * `minimal` — just a large number + label, no chrome.
   */
  variant?: 'card' | 'minimal';
}

/**
 * Compact KPI block — large value + small label.
 * Use inside summary bars on list/dashboard pages.
 *
 * @example
 *   <QuickStat value="12" label="Procesā" />
 *   <QuickStat value="3" label="Nokavēts" alert />
 *   <QuickStat value="5" label="Aktīvi" variant="minimal" />
 */
export function QuickStat({ value, label, alert, variant = 'card' }: QuickStatProps) {
  if (variant === 'minimal') {
    return (
      <div className="flex flex-col">
        <span className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
          {value}
        </span>
        <span className="text-[11px] sm:text-xs font-medium text-muted-foreground mt-1 uppercase tracking-wider">
          {label}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`p-4 rounded-xl flex flex-col justify-center ${
        alert ? 'bg-red-50 text-red-900 border border-red-200' : 'bg-white border border-gray-200'
      }`}
    >
      <span
        className={`text-xs font-semibold uppercase tracking-wider mb-1 ${
          alert ? 'text-red-700' : 'text-muted-foreground'
        }`}
      >
        {label}
      </span>
      <span className={`text-2xl font-bold tracking-tight ${alert ? '' : 'text-foreground'}`}>
        {value}
      </span>
    </div>
  );
}

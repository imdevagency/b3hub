import Link from 'next/link';
import { ChevronRight, type LucideIcon } from 'lucide-react';

export interface ActionListItemProps {
  label: string;
  description: string;
  icon: LucideIcon;
  href: string;
  primary?: boolean;
}

export function ActionListItem({
  label,
  description,
  icon: Icon,
  href,
  primary,
}: ActionListItemProps) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between px-5 py-4 hover:bg-gray-50 active:bg-gray-100 transition-colors"
    >
      <div className="flex items-center gap-4">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition-colors ${
            primary
              ? 'bg-primary/10 text-primary border-primary/20 group-hover:bg-primary/15'
              : 'bg-white text-gray-500 border-gray-200 group-hover:border-gray-300 group-hover:text-gray-700'
          }`}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">{label}</h3>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 pr-4">{description}</p>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-gray-500 transition-colors group-hover:translate-x-0.5" />
    </Link>
  );
}

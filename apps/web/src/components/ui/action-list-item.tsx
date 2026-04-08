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
      className="group flex items-center justify-between p-4 -mx-4 rounded-2xl hover:bg-muted/40 active:bg-muted/60 transition-all"
    >
      <div className="flex items-center gap-4">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-colors ${
            primary
              ? 'bg-primary/10 text-primary group-hover:bg-primary/20'
              : 'bg-muted text-foreground group-hover:bg-muted/80'
          }`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">{label}</h3>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 pr-4">{description}</p>
        </div>
      </div>
      <ChevronRight className="h-5 w-5 text-muted-foreground/30 group-hover:text-foreground transition-colors group-hover:translate-x-0.5" />
    </Link>
  );
}

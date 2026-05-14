import { type ReactNode, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Container } from '@/components/marketing/layout/Container';

interface CatalogItem {
  id: string;
  href: string;
  label: string;
  description: string;
  priceHint: string;
  icon: React.ElementType;
  badge?: ReactNode; // e.g. recycled tag
  searchString: string; // aggregated string for search
}

interface CatalogGridProps {
  title: string;
  subtitle: string;
  items: CatalogItem[];
  breadcrumbs: { label: string; href?: string }[];
  infoStrip?: ReactNode;
}

export function CatalogGrid({ title, subtitle, items, breadcrumbs, infoStrip }: CatalogGridProps) {
  const [search, setSearch] = useState('');

  const filtered = items.filter((item) => {
    if (!search.trim()) return true;
    return item.searchString.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="min-h-screen bg-background">
      <Container className="pt-32 pb-20">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div className="max-w-xl">
            <div className="flex items-center gap-2 mb-4">
              {breadcrumbs.map((crumb, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  {crumb.href ? (
                    <Link
                      href={crumb.href}
                      className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="text-sm font-semibold text-foreground">{crumb.label}</span>
                  )}
                  {idx < breadcrumbs.length - 1 && (
                    <span className="text-muted-foreground/40">/</span>
                  )}
                </div>
              ))}
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter text-foreground leading-tight">
              {title}
            </h1>
            <p className="mt-4 text-lg text-muted-foreground leading-relaxed">{subtitle}</p>
          </div>
          <div className="relative w-full md:w-[320px]">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Meklēt..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-12 bg-muted/40 border-0 h-14 rounded-[1.5rem] text-[16px] font-medium focus-visible:ring-2 focus-visible:ring-foreground/20 transition-all w-full"
            />
          </div>
        </div>

        {/* Grid */}
        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 xl:gap-6">
            {filtered.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className="group relative flex flex-col text-left transition-transform active:scale-[0.98] w-full rounded-2xl border border-border/50 bg-card p-5 hover:border-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)]"
                >
                  <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-slate-50 text-slate-600 transition-colors group-hover:bg-slate-100 group-hover:text-black">
                    <Icon className="h-7 w-7" strokeWidth={1.5} />
                  </div>

                  {item.badge}

                  <div className="mt-auto flex flex-col gap-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-[16px] text-foreground tracking-tight transition-colors group-hover:text-black">
                        {item.label}
                      </p>
                      <span className="shrink-0 text-xs font-bold text-foreground bg-muted rounded-lg px-2 py-1 mt-0.5">
                        {item.priceHint}
                      </span>
                    </div>
                    <p className="text-[13px] text-muted-foreground line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                  </div>

                  <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-foreground/60 group-hover:text-foreground transition-colors">
                    <span>Pasūtīt</span>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="transition-transform group-hover:translate-x-0.5"
                    >
                      <path d="M5 12h14"></path>
                      <path d="m12 5 7 7-7 7"></path>
                    </svg>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="py-20 text-center font-medium text-lg text-muted-foreground">
            Saraksts ir tukšs
          </div>
        )}

        {/* Info strip */}
        {infoStrip && <div className="mt-16">{infoStrip}</div>}
      </Container>
    </div>
  );
}

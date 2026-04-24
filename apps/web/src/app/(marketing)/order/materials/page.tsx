'use client';

/**
 * Material catalog — /order/materials
 *
 * Browsable grid of all material categories with indicative market prices.
 * No wizard, no auth required. Each card links to /order/materials/[category]
 * where the order wizard starts directly at the specs step.
 */

import { useState } from 'react';
import Link from 'next/link';
import {
  Search,
  ArrowRight,
  Box,
  Droplets,
  Hexagon,
  Layers,
  Leaf,
  Map,
  Mountain,
  MountainSnow,
  Package,
  Recycle,
  Sprout,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Container } from '@/components/marketing/layout/Container';
import type { MaterialCategory } from '@/lib/api';
import { CATEGORY_LABELS, CATEGORY_DESCRIPTIONS } from '@b3hub/shared';

// ── Category metadata ──────────────────────────────────────────────────────────

const CATALOG: {
  id: MaterialCategory;
  slug: string;
  label: string;
  description: string;
  priceHint: string;
  icon: React.ElementType;
  recycled?: boolean;
}[] = [
  {
    id: 'GRAVEL',
    slug: 'gravel',
    label: CATEGORY_LABELS.GRAVEL,
    description: CATEGORY_DESCRIPTIONS.GRAVEL,
    priceHint: 'no €8/t',
    icon: Mountain,
  },
  {
    id: 'SAND',
    slug: 'sand',
    label: CATEGORY_LABELS.SAND,
    description: CATEGORY_DESCRIPTIONS.SAND,
    priceHint: 'no €6/t',
    icon: Droplets,
  },
  {
    id: 'STONE',
    slug: 'stone',
    label: CATEGORY_LABELS.STONE,
    description: CATEGORY_DESCRIPTIONS.STONE,
    priceHint: 'no €12/t',
    icon: MountainSnow,
  },
  {
    id: 'CONCRETE',
    slug: 'concrete',
    label: CATEGORY_LABELS.CONCRETE,
    description: CATEGORY_DESCRIPTIONS.CONCRETE,
    priceHint: 'no €65/m³',
    icon: Box,
  },
  {
    id: 'SOIL',
    slug: 'soil',
    label: CATEGORY_LABELS.SOIL,
    description: CATEGORY_DESCRIPTIONS.SOIL,
    priceHint: 'no €5/t',
    icon: Sprout,
  },
  {
    id: 'ASPHALT',
    slug: 'asphalt',
    label: CATEGORY_LABELS.ASPHALT,
    description: CATEGORY_DESCRIPTIONS.ASPHALT,
    priceHint: 'no €18/t',
    icon: Map,
  },
  {
    id: 'CLAY',
    slug: 'clay',
    label: CATEGORY_LABELS.CLAY,
    description: CATEGORY_DESCRIPTIONS.CLAY,
    priceHint: 'no €5/t',
    icon: Layers,
  },
  {
    id: 'RECYCLED_CONCRETE',
    slug: 'recycled-concrete',
    label: CATEGORY_LABELS.RECYCLED_CONCRETE,
    description: CATEGORY_DESCRIPTIONS.RECYCLED_CONCRETE,
    priceHint: 'no €4/t',
    icon: Recycle,
    recycled: true,
  },
  {
    id: 'RECYCLED_SOIL',
    slug: 'recycled-soil',
    label: CATEGORY_LABELS.RECYCLED_SOIL,
    description: CATEGORY_DESCRIPTIONS.RECYCLED_SOIL,
    priceHint: 'no €3/t',
    icon: Recycle,
    recycled: true,
  },
  {
    id: 'OTHER',
    slug: 'other',
    label: CATEGORY_LABELS.OTHER,
    description: CATEGORY_DESCRIPTIONS.OTHER,
    priceHint: 'Pēc pieprasījuma',
    icon: Hexagon,
  },
];

// ── Main page ──────────────────────────────────────────────────────────────────

export default function MaterialCatalogPage() {
  const [search, setSearch] = useState('');

  const filtered = CATALOG.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return c.label.toLowerCase().includes(q) || c.description.toLowerCase().includes(q);
  });

  return (
    <div className="min-h-screen bg-background">
      <Container className="py-12 md:py-20 max-w-6xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div className="max-w-xl">
            <div className="flex items-center gap-2 mb-4">
              <Link
                href="/order"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Pakalpojumi
              </Link>
              <span className="text-muted-foreground/40">/</span>
              <span className="text-sm font-semibold text-foreground">Materiāli</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter text-foreground leading-tight">
              Celtniecības materiāli
            </h1>
            <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
              Izvēlieties materiāla veidu — jūs saņemsiet reālās cenas no tuvākajiem piegādātājiem
            </p>
          </div>
          <div className="relative w-full md:w-[320px]">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Meklēt materiālu..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-12 bg-muted/40 border-0 h-14 rounded-[1.5rem] text-[16px] font-medium focus-visible:ring-2 focus-visible:ring-foreground/20 transition-all w-full"
            />
          </div>
        </div>

        {/* Grid */}
        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 xl:gap-6">
            {filtered.map((cat) => {
              const Icon = cat.icon;
              return (
                <Link
                  key={cat.id}
                  href={`/order/materials/${cat.slug}`}
                  className="group relative flex flex-col text-left transition-transform active:scale-[0.98] w-full rounded-2xl border border-border/50 bg-card p-5 hover:border-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)]"
                >
                  <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-slate-50 text-slate-600 transition-colors group-hover:bg-slate-100 group-hover:text-black">
                    <Icon className="h-7 w-7" strokeWidth={1.5} />
                  </div>

                  {cat.recycled && (
                    <div className="absolute top-5 right-5 flex items-center gap-1.5 rounded-full bg-green-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-green-700">
                      <Leaf className="size-3" strokeWidth={2.5} />
                      <span>Recikl.</span>
                    </div>
                  )}

                  <div className="mt-auto flex flex-col gap-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-[16px] text-foreground tracking-tight transition-colors group-hover:text-black">
                        {cat.label}
                      </p>
                      <span className="shrink-0 text-xs font-bold text-foreground bg-muted rounded-lg px-2 py-1 mt-0.5">
                        {cat.priceHint}
                      </span>
                    </div>
                    <p className="text-[13px] text-muted-foreground line-clamp-2 leading-relaxed">
                      {cat.description}
                    </p>
                  </div>

                  <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-foreground/60 group-hover:text-foreground transition-colors">
                    <span>Pasūtīt</span>
                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="py-20 text-center font-medium text-lg text-muted-foreground">
            Nav atrasts neviens materiāls
          </div>
        )}

        {/* Info strip */}
        <div className="mt-16 rounded-3xl bg-muted/30 border border-border/40 p-8 flex flex-col md:flex-row gap-8 md:gap-12">
          <div className="flex items-start gap-4">
            <Package className="size-8 shrink-0 text-foreground mt-0.5" strokeWidth={1.5} />
            <div>
              <p className="font-bold text-foreground">Reālās cenas, ne kataloga</p>
              <p className="text-sm text-muted-foreground mt-1">
                Cenas aprēķina piegādātāji pēc jūsu atrašanās vietas un daudzuma.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <MountainSnow className="size-8 shrink-0 text-foreground mt-0.5" strokeWidth={1.5} />
            <div>
              <p className="font-bold text-foreground">Piegāde uz objektu</p>
              <p className="text-sm text-muted-foreground mt-1">
                Transporta izmaksas jau iekļautas — nav slēptu maksu.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <Recycle className="size-8 shrink-0 text-foreground mt-0.5" strokeWidth={1.5} />
            <div>
              <p className="font-bold text-foreground">Reciklēti materiāli</p>
              <p className="text-sm text-muted-foreground mt-1">
                Grants, betons un grunts no demontāžas — par zemāku cenu.
              </p>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}

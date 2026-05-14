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
import { CatalogGrid } from '@/components/catalog/CatalogGrid';
import type { MaterialCategory } from '@/lib/api';
import { CATEGORY_LABELS, CATEGORY_DESCRIPTIONS } from '@b3hub/shared';
import { useMaterialCatalogue } from '@/lib/use-material-catalogue';

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
  const { categoryLabels, categoryDescriptions } = useMaterialCatalogue();
  const items = CATALOG.map((cat) => ({
    id: cat.id,
    href: `/order/materials/${cat.slug}`,
    label: categoryLabels[cat.id] ?? cat.label,
    description: categoryDescriptions[cat.id] ?? cat.description,
    priceHint: cat.priceHint,
    icon: cat.icon,
    searchString: `${categoryLabels[cat.id] ?? cat.label} ${categoryDescriptions[cat.id] ?? cat.description} ${cat.priceHint}`,
    badge: cat.recycled ? (
      <div className="absolute top-5 right-5 flex items-center gap-1.5 rounded-full bg-green-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-green-700">
        <Leaf className="size-3" strokeWidth={2.5} />
        <span>Recikl.</span>
      </div>
    ) : undefined,
  }));

  const infoStrip = (
    <div className="rounded-3xl bg-muted/30 border border-border/40 p-8 flex flex-col md:flex-row gap-8 md:gap-12">
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
  );

  return (
    <CatalogGrid
      title="Celtniecības materiāli"
      subtitle="Izvēlieties materiāla veidu — jūs saņemsiet reālās cenas no tuvākajiem piegādātājiem"
      items={items}
      breadcrumbs={[{ label: 'Pakalpojumi', href: '/order' }, { label: 'Materiāli' }]}
      infoStrip={infoStrip}
    />
  );
}

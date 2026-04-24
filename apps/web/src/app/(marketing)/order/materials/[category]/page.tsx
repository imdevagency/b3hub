'use client';

/**
 * Material order wizard — /order/materials/[category]
 *
 * Thin wrapper that reads the category slug from the URL and renders
 * the self-contained MaterialOrderWizard with that category pre-selected.
 * No wizard state lives here — everything is inside the component.
 */

import { useParams } from 'next/navigation';
import { notFound } from 'next/navigation';
import { MaterialOrderWizard } from '@/components/order/wizards/MaterialOrderWizard';
import type { MaterialCategory } from '@/lib/api';

const VALID_CATEGORIES: string[] = [
  'SAND',
  'GRAVEL',
  'STONE',
  'CONCRETE',
  'SOIL',
  'RECYCLED_CONCRETE',
  'RECYCLED_SOIL',
  'ASPHALT',
  'CLAY',
  'OTHER',
];

export default function MaterialOrderPage() {
  const params = useParams();
  const slugParam = params.category;
  const slug = typeof slugParam === 'string' ? slugParam : '';

  // Convert URL slug (e.g. "recycled-concrete") → enum key (e.g. "RECYCLED_CONCRETE")
  const category = slug.toUpperCase().replace(/-/g, '_');

  if (!VALID_CATEGORIES.includes(category)) {
    notFound();
  }

  return <MaterialOrderWizard category={category as MaterialCategory} mode="public" />;
}

/**
 * Material order wizard — /order/materials/[category]
 *
 * Server component: validates the category slug and calls notFound() server-side.
 * MaterialOrderWizard is a client component and is rendered as a child.
 */

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

interface Props {
  params: Promise<{ category: string }>;
}

export default async function MaterialOrderPage({ params }: Props) {
  const { category: slug } = await params;
  // Convert URL slug (e.g. "recycled-concrete") → enum key (e.g. "RECYCLED_CONCRETE")
  const category = slug.toUpperCase().replace(/-/g, '_');

  if (!VALID_CATEGORIES.includes(category)) {
    notFound();
  }

  return <MaterialOrderWizard category={category as MaterialCategory} mode="public" />;
}

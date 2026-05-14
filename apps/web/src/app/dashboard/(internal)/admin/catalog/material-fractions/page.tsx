'use client';

import { CatalogueEditor } from '@/components/admin/CatalogueEditor';
import {
  adminListMaterialFractions,
  adminUpsertMaterialFraction,
  adminDeleteMaterialFraction,
} from '@/lib/api/admin';

const CATEGORIES = [
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

const UNITS = ['TONNE', 'M3', 'PIECE', 'LOAD', 'KG', 'L'];

export default function MaterialFractionsPage() {
  return (
    <CatalogueEditor
      config={{
        title: 'Materiālu frakcijas',
        description:
          'EU standarta materiālu frakcijas (EN 12620 / EN 13043 / EN 206 / EN 13242). Katrai frakcijai piesaistīta kategorija.',
        badgeKey: 'category',
        subtitleKey: 'label',
        extraFields: [
          {
            key: 'category',
            label: 'Kategorija',
            type: 'select',
            options: CATEGORIES,
            required: true,
          },
          { key: 'unit', label: 'Mērvienība', type: 'select', options: UNITS },
        ],
        loadItems: adminListMaterialFractions,
        saveItem: (code, data, token) => adminUpsertMaterialFraction(code, data as any, token),
        deleteItem: adminDeleteMaterialFraction,
      }}
    />
  );
}

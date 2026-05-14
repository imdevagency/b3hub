'use client';

import { CatalogueEditor } from '@/components/admin/CatalogueEditor';
import {
  adminListMaterialCategories,
  adminUpsertMaterialCategory,
  adminDeleteMaterialCategory,
} from '@/lib/api/admin';

const MATERIAL_CATEGORIES = [
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

export default function MaterialCategoriesPage() {
  return (
    <CatalogueEditor
      config={{
        title: 'Materiālu kategorijas',
        description:
          'Pārvalda materiālu kategorijas — blīvums, noklusējuma mērvienība, kārta, LV nosaukumi.',
        subtitleKey: 'descriptionLv',
        extraFields: [
          { key: 'densityTM3', label: 'Blīvums t/m³', type: 'number' },
          {
            key: 'defaultUnit',
            label: 'Noklusēt. vienība',
            type: 'select',
            options: ['TONNE', 'M3', 'PIECE', 'LOAD'],
          },
          { key: 'iconKey', label: 'Ikona (kods)', type: 'text' },
        ],
        loadItems: adminListMaterialCategories,
        saveItem: (code, data, token) => adminUpsertMaterialCategory(code, data as any, token),
        deleteItem: adminDeleteMaterialCategory,
      }}
    />
  );
}

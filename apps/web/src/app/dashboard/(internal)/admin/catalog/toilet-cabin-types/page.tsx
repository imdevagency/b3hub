'use client';

import { CatalogueEditor } from '@/components/admin/CatalogueEditor';
import {
  adminListToiletCabinTypes,
  adminUpsertToiletCabinType,
  adminDeleteToiletCabinType,
} from '@/lib/api/admin';

export default function ToiletCabinTypesPage() {
  return (
    <CatalogueEditor
      config={{
        title: 'Tualetes kabīņu tipi',
        description:
          'Iznomājamo tualetes kabīņu veidi ar bāzes cenu. Izmanto tualetes kabīņu nomas vedņa produktu solī.',
        subtitleKey: 'descriptionLv',
        extraFields: [
          { key: 'basePrice', label: 'Bāzes cena (€)', type: 'number' },
          { key: 'currency', label: 'Valūta', type: 'select', options: ['EUR', 'USD', 'GBP'] },
        ],
        loadItems: adminListToiletCabinTypes,
        saveItem: (code, data, token) => adminUpsertToiletCabinType(code, data as any, token),
        deleteItem: adminDeleteToiletCabinType,
      }}
    />
  );
}

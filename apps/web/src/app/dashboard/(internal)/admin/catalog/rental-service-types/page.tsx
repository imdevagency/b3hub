'use client';

import { CatalogueEditor } from '@/components/admin/CatalogueEditor';
import {
  adminListRentalServiceTypes,
  adminUpsertRentalServiceType,
  adminDeleteRentalServiceType,
} from '@/lib/api/admin';

const PRICE_UNITS = ['PER_DAY', 'PER_WEEK', 'PER_MONTH', 'PER_HIRE', 'PER_TONNE', 'PER_M3'];

export default function RentalServiceTypesPage() {
  return (
    <CatalogueEditor
      config={{
        title: 'Nomas pakalpojumu veidi',
        description: 'Visu nomas pakalpojumu (konteineri, tehnika u.c.) veidi ar cenu struktūru.',
        badgeKey: 'group',
        subtitleKey: 'descriptionLv',
        extraFields: [
          { key: 'group', label: 'Grupa', type: 'text' },
          { key: 'basePrice', label: 'Bāzes cena (€)', type: 'number' },
          { key: 'priceUnit', label: 'Cenas vienība', type: 'select', options: PRICE_UNITS },
          { key: 'currency', label: 'Valūta', type: 'select', options: ['EUR', 'USD', 'GBP'] },
        ],
        loadItems: adminListRentalServiceTypes,
        saveItem: (code, data, token) => adminUpsertRentalServiceType(code, data as any, token),
        deleteItem: adminDeleteRentalServiceType,
      }}
    />
  );
}

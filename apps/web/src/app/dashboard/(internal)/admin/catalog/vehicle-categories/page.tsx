'use client';

import { CatalogueEditor } from '@/components/admin/CatalogueEditor';
import {
  adminListVehicleCategories,
  adminUpsertVehicleCategory,
  adminDeleteVehicleCategory,
} from '@/lib/api/admin';

export default function VehicleCategoriesPage() {
  return (
    <CatalogueEditor
      config={{
        title: 'Transportlīdzekļu kategorijas',
        description:
          'Kravas auto kategorijas — ietilpība, cenas, saderīgie transportlīdzekļi. Izmanto transporta vedņa kategoriju solī.',
        subtitleKey: 'descriptionLv',
        extraFields: [
          { key: 'minCapacityT', label: 'Min ietilpība (t)', type: 'number' },
          { key: 'maxCapacityT', label: 'Maks ietilpība (t)', type: 'number' },
          { key: 'fromPrice', label: 'Cena no (€)', type: 'number' },
          { key: 'pricePerKm', label: 'Cena/km (€)', type: 'number' },
          { key: 'iconKey', label: 'Ikona (kods)', type: 'text' },
        ],
        loadItems: adminListVehicleCategories,
        saveItem: (code, data, token) => adminUpsertVehicleCategory(code, data as any, token),
        deleteItem: adminDeleteVehicleCategory,
      }}
    />
  );
}

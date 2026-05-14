'use client';

import { CatalogueEditor } from '@/components/admin/CatalogueEditor';
import {
  adminListScrapMaterials,
  adminUpsertScrapMaterial,
  adminDeleteScrapMaterial,
} from '@/lib/api/admin';

export default function ScrapMaterialsPage() {
  return (
    <CatalogueEditor
      config={{
        title: 'Lūžņu materiāli',
        description:
          'Otrreizējo izejvielu un lūžņu kategorijas ar indikatīvu iepirkuma cenu par tonnu.',
        subtitleKey: 'descriptionLv',
        extraFields: [
          { key: 'indicativePricePerTonne', label: 'Indikat. cena/t (€)', type: 'number' },
          { key: 'currency', label: 'Valūta', type: 'select', options: ['EUR', 'USD', 'GBP'] },
          { key: 'selfTransportAllowed', label: 'Pašpiegāde atļauta', type: 'boolean' },
        ],
        loadItems: adminListScrapMaterials,
        saveItem: (code, data, token) => adminUpsertScrapMaterial(code, data as any, token),
        deleteItem: adminDeleteScrapMaterial,
      }}
    />
  );
}

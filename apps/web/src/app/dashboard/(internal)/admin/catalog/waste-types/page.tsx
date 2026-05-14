'use client';

import { CatalogueEditor } from '@/components/admin/CatalogueEditor';
import { adminListWasteTypes, adminUpsertWasteType, adminDeleteWasteType } from '@/lib/api/admin';

const GROUPS = ['CONSTRUCTION_WASTE', 'LICENSED_WASTE', 'SECONDARY_MATERIALS'];

export default function WasteTypesPage() {
  return (
    <CatalogueEditor
      config={{
        title: 'Atkritumu veidi',
        description:
          'Būvniecības atkritumi, licencētie atkritumi un sekundārās izejvielas. Izmanto utilizācijas vedņa izvēles sarakstā.',
        badgeKey: 'group',
        subtitleKey: 'label',
        extraFields: [
          { key: 'group', label: 'Grupa', type: 'select', options: GROUPS, required: true },
          { key: 'groupLabelLv', label: 'Grupas nosaukums (LV)', type: 'text' },
          { key: 'iconKey', label: 'Ikona (kods)', type: 'text' },
          { key: 'isHazardous', label: 'Bīstams', type: 'boolean' },
          { key: 'isBuyback', label: 'Izpirkšana', type: 'boolean' },
        ],
        loadItems: adminListWasteTypes,
        saveItem: (code, data, token) => adminUpsertWasteType(code, data as any, token),
        deleteItem: adminDeleteWasteType,
      }}
    />
  );
}

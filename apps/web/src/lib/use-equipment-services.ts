'use client';

import { useState, useEffect } from 'react';
import { EQUIPMENT_SERVICES, type ServiceDef } from '@/lib/equipment-services';

// Patches label/description/priceFrom from the DB catalogue on mount.
// Icons, colors, and hirePeriodOptions always come from the static list above.

/** Returns EQUIPMENT_SERVICES with labels/prices overridden from the live DB catalogue. */
export function useEquipmentServices(): ServiceDef[] {
  const [services, setServices] = useState<ServiceDef[]>(EQUIPMENT_SERVICES);

  useEffect(() => {
    import('@/lib/api/rentals')
      .then(({ fetchRentalServiceTypes }) => fetchRentalServiceTypes())
      .then((live) => {
        if (!live.length) return;
        setServices(
          EQUIPMENT_SERVICES.map((s) => {
            const l = live.find((d) => d.code === s.type);
            if (!l) return s;
            return {
              ...s,
              label: l.labelLv ?? l.label ?? s.label,
              description: l.descriptionLv ?? l.description ?? s.description,
              priceFrom: l.basePrice ?? s.priceFrom,
            };
          }),
        );
      })
      .catch(() => {
        /* keep static fallback */
      });
  }, []);

  return services;
}

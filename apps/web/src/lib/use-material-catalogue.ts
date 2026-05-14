'use client';

import { useState, useEffect } from 'react';
import {
  CATEGORY_LABELS,
  CATEGORY_DESCRIPTIONS,
  CATEGORY_FRACTIONS,
} from '@b3hub/shared';

export interface MaterialCatalogueState {
  categoryLabels: Record<string, string>;
  categoryDescriptions: Record<string, string>;
  /** Fractions per category — list of display strings */
  categoryFractions: Record<string, string[]>;
}

const FALLBACK: MaterialCatalogueState = {
  categoryLabels: CATEGORY_LABELS as Record<string, string>,
  categoryDescriptions: CATEGORY_DESCRIPTIONS as Record<string, string>,
  categoryFractions: CATEGORY_FRACTIONS as Record<string, string[]>,
};

/** Returns live material category labels/descriptions and fractions from the DB catalogue.
 *  Falls back to @b3hub/shared static constants if the API is unreachable. */
export function useMaterialCatalogue(): MaterialCatalogueState {
  const [state, setState] = useState<MaterialCatalogueState>(FALLBACK);

  useEffect(() => {
    Promise.all([
      import('@/lib/api/rentals').then((m) => m.fetchMaterialCategoryDefs()),
      import('@/lib/api/rentals').then((m) => m.fetchMaterialFractionDefs()),
    ])
      .then(([cats, fracs]) => {
        if (!cats.length && !fracs.length) return;

        const categoryLabels: Record<string, string> = { ...FALLBACK.categoryLabels };
        const categoryDescriptions: Record<string, string> = { ...FALLBACK.categoryDescriptions };

        for (const cat of cats) {
          if (cat.labelLv) categoryLabels[cat.code] = cat.labelLv;
          if (cat.descriptionLv) categoryDescriptions[cat.code] = cat.descriptionLv;
        }

        const categoryFractions: Record<string, string[]> = { ...FALLBACK.categoryFractions };
        if (fracs.length) {
          const grouped: Record<string, string[]> = {};
          for (const f of fracs) {
            if (!grouped[f.category]) grouped[f.category] = [];
            grouped[f.category].push(f.labelLv ?? f.label);
          }
          for (const cat of Object.keys(grouped)) {
            categoryFractions[cat] = grouped[cat];
          }
        }

        setState({ categoryLabels, categoryDescriptions, categoryFractions });
      })
      .catch(() => {
        /* keep static fallback */
      });
  }, []);

  return state;
}

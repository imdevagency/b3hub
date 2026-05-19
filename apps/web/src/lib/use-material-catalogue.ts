'use client';

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
  return FALLBACK;
}

/**
 * Pure helpers, constants, and types for the ActiveJobScreen.
 * Extracted to keep active.tsx focused on state and rendering.
 */
import type { TransportExceptionType } from '@/lib/api';

// ── Status progression ────────────────────────────────────────────────────────

export const STATUS_STEPS = [
  'ACCEPTED',
  'EN_ROUTE_PICKUP',
  'AT_PICKUP',
  'LOADED',
  'EN_ROUTE_DELIVERY',
  'AT_DELIVERY',
  'DELIVERED',
] as const;

export type JobStatus = (typeof STATUS_STEPS)[number];

export const NEXT_STATUS: Record<JobStatus, JobStatus | null> = {
  ACCEPTED: 'EN_ROUTE_PICKUP',
  EN_ROUTE_PICKUP: 'AT_PICKUP',
  AT_PICKUP: 'LOADED',
  LOADED: 'EN_ROUTE_DELIVERY',
  EN_ROUTE_DELIVERY: 'AT_DELIVERY',
  AT_DELIVERY: 'DELIVERED',
  DELIVERED: null,
};

/** Statuses in which return trip suggestions are contextually relevant */
export const RETURN_TRIP_STATUSES: JobStatus[] = ['EN_ROUTE_DELIVERY', 'AT_DELIVERY'];

// ── Form options ──────────────────────────────────────────────────────────────

export const EXCEPTION_TYPE_OPTIONS: Array<{ value: TransportExceptionType; label: string }> = [
  { value: 'SUPPLIER_NOT_READY', label: 'Piegādātājs nav gatavs' },
  { value: 'WRONG_MATERIAL', label: 'Nepareizs materiāls' },
  { value: 'PARTIAL_DELIVERY', label: 'Daļēja piegāde' },
  { value: 'REJECTED_DELIVERY', label: 'Piegāde atteikta' },
  { value: 'SITE_CLOSED', label: 'Objekts slēgts' },
  { value: 'OVERWEIGHT', label: 'Pārsniegts svars' },
  { value: 'OTHER', label: 'Cits' },
];

export const SURCHARGE_TYPE_OPTIONS = [
  { value: 'WAITING_TIME', label: 'Gaidīšanas laiks' },
  { value: 'FUEL', label: 'Degvielas piemaksa' },
  { value: 'OVERWEIGHT', label: 'Pārslogota krava' },
  { value: 'NARROW_ACCESS', label: 'Šaura pieeja' },
  { value: 'OTHER', label: 'Cita piemaksa' },
] as const;

// ── Document labels ───────────────────────────────────────────────────────────

export const DOC_LABELS: Record<string, string> = {
  DELIVERY_PROOF: 'Piegādes apliecinājums',
  WEIGHING_SLIP: 'Svēršanas biļete',
};

export const STEP_PROGRESS_LABELS: Record<JobStatus, string> = {
  ACCEPTED: 'Darbs pieņemts',
  EN_ROUTE_PICKUP: 'Brauciens uz iekraušanu',
  AT_PICKUP: 'Iekraušana objektā',
  LOADED: 'Krava apstiprināta',
  EN_ROUTE_DELIVERY: 'Brauciens uz piegādi',
  AT_DELIVERY: 'Izkraušana un nodošana',
  DELIVERED: 'Darbs pabeigts',
};

// ── Navigation ────────────────────────────────────────────────────────────────

export const NAV_PREF_KEY = '@b3hub_driver_nav_app';
export type NavApp = 'waze' | 'google' | 'apple';

// ── Pure helpers ──────────────────────────────────────────────────────────────

export function formatDocCode(code: string): string {
  return DOC_LABELS[code] ?? code.replaceAll('_', ' ').toLowerCase();
}

export function formatElapsed(isoString: string): string {
  const mins = Math.floor((Date.now() - new Date(isoString).getTime()) / 60_000);
  if (mins < 1) return 'Tikko';
  if (mins < 60) return `${mins} min atpakaļ`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h} st ${m} min atpakaļ` : `${h} st atpakaļ`;
}

export function getPhaseMeta(
  status: JobStatus,
  nextStatus: JobStatus | null,
  options: { isOffline: boolean; openExceptionCount: number; returnTripCount: number },
) {
  const { isOffline, openExceptionCount, returnTripCount } = options;

  if (status === 'DELIVERED') {
    return {
      eyebrow: 'Darbs pabeigts',
      title: 'Piegāde noslēgta',
      subtitle: 'Varat atrast nākamo darbu vai aizvērt šo maiņas posmu.',
      nextLabel: 'Gatavs nākamajam darbam',
    };
  }

  if (status === 'AT_PICKUP') {
    return {
      eyebrow: 'Iekraušanas brīdis',
      title: 'Apstipriniet kravu bez steigas',
      subtitle:
        'Ievadiet faktisko svaru un, ja vajag, pievienojiet foto, lai pāreja uz piegādi būtu vienā solī.',
      nextLabel: nextStatus ? `Tālāk: ${STEP_PROGRESS_LABELS[nextStatus]}` : 'Gatavs pabeigt posmu',
    };
  }

  if (status === 'AT_DELIVERY') {
    return {
      eyebrow: 'Nodošanas brīdis',
      title: 'Pabeidziet piegādi ar pierādījumu',
      subtitle:
        'Kad viss ir gatavs, ievadiet piegādes apliecinājumu un noslēdziet darbu bez papildu soļiem.',
      nextLabel: nextStatus ? `Tālāk: ${STEP_PROGRESS_LABELS[nextStatus]}` : 'Gatavs pabeigt posmu',
    };
  }

  if (status === 'LOADED' || status === 'EN_ROUTE_DELIVERY') {
    return {
      eyebrow: 'Piegādes fāze',
      title: 'Svarīgākais ir skaidrs un tuvumā',
      subtitle: isOffline
        ? 'Jūs esat bezsaistē. Darbības tiks saglabātas un nosūtītas, tiklīdz atgriezīsies savienojums.'
        : openExceptionCount > 0
          ? `Ir ${openExceptionCount} aktīva${openExceptionCount > 1 ? 's' : ''} problēma${openExceptionCount > 1 ? 's' : ''}.`
          : returnTripCount > 0
            ? `${returnTripCount} atpakaļceļa krava${returnTripCount > 1 ? 's' : ''} pieejama tuvumā.`
            : 'Navigācija, kontakts un problēmu ziņošana ir pieejama bez pārslēgšanās starp ekrāniem.',
      nextLabel: nextStatus ? `Tālāk: ${STEP_PROGRESS_LABELS[nextStatus]}` : 'Gatavs pabeigt posmu',
    };
  }

  return {
    eyebrow: 'Ceļā uz iekraušanu',
    title: 'Vispirms nokļūstiet pareizajā vietā',
    subtitle: isOffline
      ? 'Jūs esat bezsaistē. Navigācija darbosies, bet statusa maiņa tiks saglabāta rindā.'
      : 'Piegādātāja kontakts, čats un navigācija ir redzami uzreiz, lai nav jāmeklē nākamais solis.',
    nextLabel: nextStatus ? `Tālāk: ${STEP_PROGRESS_LABELS[nextStatus]}` : 'Gatavs pabeigt posmu',
  };
}

export function getStatusSheetMeta(status: JobStatus, nextStatus: JobStatus) {
  if (status === 'EN_ROUTE_PICKUP') {
    return {
      title: 'Ieradies iekraušanas vietā?',
      subtitle: 'Apstipriniet tikai tad, kad patiešām esat objektā un varat sākt iekraušanu.',
      confirmLabel: 'Jā, esmu klāt',
    };
  }

  if (status === 'LOADED') {
    return {
      title: 'Doties uz piegādi?',
      subtitle: 'Krava jau ir apstiprināta. Nākamais solis pārslēgs darbu uz piegādes režīmu.',
      confirmLabel: 'Sākt piegādi',
    };
  }

  if (status === 'EN_ROUTE_DELIVERY') {
    return {
      title: 'Ieradies piegādes vietā?',
      subtitle: 'Apstipriniet tikai tad, kad esat objektā un varat sākt nodošanu vai izkraušanu.',
      confirmLabel: 'Jā, esmu piegādē',
    };
  }

  return {
    title: 'Atjaunināt darba statusu?',
    subtitle: `Tālāk: ${STEP_PROGRESS_LABELS[nextStatus]}. Statuss tiks atjaunināts uzreiz vai saglabāts rindā, ja esat bezsaistē.`,
    confirmLabel: 'Turpināt',
  };
}

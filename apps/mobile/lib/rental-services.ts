/**
 * rental-services.ts — Service registry for all rental service types on B3Hub.
 *
 * This is the single place to register a new rental service. When you add
 * a new entry here, the wizard, driver screens, and admin dashboard can all
 * render it dynamically without new screens.
 *
 * HOW TO ADD A NEW SERVICE
 * ─────────────────────────
 * 1. Add the serviceType string to `RentalServiceType` (must match the
 *    Prisma `RentalServiceType` enum value).
 * 2. Add an entry to `RENTAL_SERVICES` below.
 * 3. Create the wizard steps array (or reuse `defaultWizardSteps`).
 * 4. Create the API functions in `lib/api/rentals.ts` (one file covers all).
 * 5. Done — no new screens needed.
 */

import { Package, Fence, Building2, Zap, Lamp, Droplets } from 'lucide-react-native';
import type React from 'react';

// ── Service type ──────────────────────────────────────────────────

/** Must match the Prisma RentalServiceType enum exactly */
export type RentalServiceType =
  | 'SCAFFOLDING'
  | 'TEMP_FENCING'
  | 'SITE_OFFICE'
  | 'GENERATOR'
  | 'LIGHTING_TOWER'
  | 'WATER_BOWSER';

// ── Status config ─────────────────────────────────────────────────

export const RENTAL_STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  PENDING:   { label: 'Gaida',          bg: '#f3f4f6', color: '#6b7280' },
  CONFIRMED: { label: 'Jāpiegādā',      bg: '#f3f4f6', color: '#111827' },
  DELIVERED: { label: 'Piegādāts',      bg: '#e5e7eb', color: '#111827' },
  IN_USE:    { label: 'Tiek izmantots', bg: '#dbeafe', color: '#1d4ed8' },
  COLLECTED: { label: 'Savākts',        bg: '#d1fae5', color: '#065f46' },
  COMPLETED: { label: 'Pabeigts',       bg: '#d1fae5', color: '#065f46' },
  CANCELLED: { label: 'Atcelts',        bg: '#f9fafb', color: '#9ca3af' },
};

// ── Status action flows ───────────────────────────────────────────

/** Standard deliver → in_use → collect flow (toilet cabins, site offices, generators) */
export const RENTAL_ACTIONS_WITH_IN_USE = [
  {
    when: 'CONFIRMED',
    toStatus: 'DELIVERED',
    label: 'Atzīmēt kā piegādātu',
    confirmTitle: 'Piegāde apstiprināta',
    confirmMessage: 'Apstiprināt, ka aprīkojums ir piegādāts pasūtītājam?',
  },
  {
    when: 'DELIVERED',
    toStatus: 'IN_USE',
    label: 'Atzīmēt kā aktīvu',
    confirmTitle: 'Nodots lietošanā',
    confirmMessage: 'Apstiprināt, ka aprīkojums ir nodots lietošanā?',
  },
  {
    when: 'IN_USE',
    toStatus: 'COLLECTED',
    label: 'Atzīmēt kā savāktu',
    confirmTitle: 'Savākšana apstiprināta',
    confirmMessage: 'Apstiprināt, ka aprīkojums ir savākts no vietas?',
  },
];

/** Simplified deliver → collect flow (skips, scaffolding, fencing — no in-use step) */
export const RENTAL_ACTIONS_SIMPLE = [
  {
    when: 'CONFIRMED',
    toStatus: 'DELIVERED',
    label: 'Atzīmēt kā piegādātu',
    confirmTitle: 'Piegāde apstiprināta',
    confirmMessage: 'Apstiprināt, ka aprīkojums ir piegādāts?',
  },
  {
    when: 'DELIVERED',
    toStatus: 'COLLECTED',
    label: 'Atzīmēt kā savāktu',
    confirmTitle: 'Savākšana apstiprināta',
    confirmMessage: 'Apstiprināt, ka aprīkojums ir savākts no vietas?',
  },
];

// ── Service registry ──────────────────────────────────────────────

export interface RentalServiceDefinition {
  type: RentalServiceType;
  /** Latvian display name */
  label: string;
  /** Short description shown in catalog / home screen */
  description: string;
  /** Lucide icon component */
  Icon: React.ElementType;
  /** Unit label for the quantity field (e.g. 'sekcijas', 'agregāti') */
  unitLabel: string;
  /** Status action flow for driver screens */
  actions: typeof RENTAL_ACTIONS_SIMPLE;
  /** Whether the service uses the IN_USE status step */
  hasInUseStep: boolean;
  /** Default hire period options shown in the wizard */
  hirePeriodOptions: Array<{ days: number; label: string }>;
  /** Backend API path segment (e.g. 'rentals/SCAFFOLDING') */
  apiPath: string;
}

export const RENTAL_SERVICES: Record<RentalServiceType, RentalServiceDefinition> = {
  SCAFFOLDING: {
    type: 'SCAFFOLDING',
    label: 'Sastatnes',
    description: 'Pagaidu sastatnes būvdarbiem un remontam',
    Icon: Package,
    unitLabel: 'sekcijas',
    actions: RENTAL_ACTIONS_SIMPLE,
    hasInUseStep: false,
    hirePeriodOptions: [
      { days: 7,  label: '1 nedēļa' },
      { days: 14, label: '2 nedēļas' },
      { days: 30, label: '1 mēnesis' },
      { days: 60, label: '2 mēneši' },
      { days: 90, label: '3 mēneši' },
    ],
    apiPath: 'rentals/SCAFFOLDING',
  },

  TEMP_FENCING: {
    type: 'TEMP_FENCING',
    label: 'Pagaidu žogi',
    description: 'Būvlaukumu norobežošana, gājēju aizsardzība',
    Icon: Fence,
    unitLabel: 'paneļi',
    actions: RENTAL_ACTIONS_SIMPLE,
    hasInUseStep: false,
    hirePeriodOptions: [
      { days: 7,  label: '1 nedēļa' },
      { days: 14, label: '2 nedēļas' },
      { days: 30, label: '1 mēnesis' },
      { days: 60, label: '2 mēneši' },
      { days: 90, label: '3 mēneši' },
    ],
    apiPath: 'rentals/TEMP_FENCING',
  },

  SITE_OFFICE: {
    type: 'SITE_OFFICE',
    label: 'Mobilās biroja kabīnes',
    description: 'Pagaidu biroji un saimniecības telpas būvlaukumam',
    Icon: Building2,
    unitLabel: 'kabīnes',
    actions: RENTAL_ACTIONS_WITH_IN_USE,
    hasInUseStep: true,
    hirePeriodOptions: [
      { days: 14, label: '2 nedēļas' },
      { days: 30, label: '1 mēnesis' },
      { days: 60, label: '2 mēneši' },
      { days: 90, label: '3 mēneši' },
    ],
    apiPath: 'rentals/SITE_OFFICE',
  },

  GENERATOR: {
    type: 'GENERATOR',
    label: 'Ģeneratori',
    description: 'Elektroenerģijas avoti būvlaukumiem bez pieslēguma tīklam',
    Icon: Zap,
    unitLabel: 'agregāti',
    actions: RENTAL_ACTIONS_WITH_IN_USE,
    hasInUseStep: true,
    hirePeriodOptions: [
      { days: 3,  label: '3 dienas' },
      { days: 7,  label: '1 nedēļa' },
      { days: 14, label: '2 nedēļas' },
      { days: 30, label: '1 mēnesis' },
    ],
    apiPath: 'rentals/GENERATOR',
  },

  LIGHTING_TOWER: {
    type: 'LIGHTING_TOWER',
    label: 'Apgaismojuma torņi',
    description: 'Nakts darbi un āra apgaismojums bez elektrotīkla',
    Icon: Lamp,
    unitLabel: 'torņi',
    actions: RENTAL_ACTIONS_WITH_IN_USE,
    hasInUseStep: true,
    hirePeriodOptions: [
      { days: 3,  label: '3 dienas' },
      { days: 7,  label: '1 nedēļa' },
      { days: 14, label: '2 nedēļas' },
      { days: 30, label: '1 mēnesis' },
    ],
    apiPath: 'rentals/LIGHTING_TOWER',
  },

  WATER_BOWSER: {
    type: 'WATER_BOWSER',
    label: 'Ūdens piegāde',
    description: 'Ūdens piegāde attālinātiem būvlaukumiem',
    Icon: Droplets,
    unitLabel: 'cisternas',
    actions: RENTAL_ACTIONS_SIMPLE,
    hasInUseStep: false,
    hirePeriodOptions: [
      { days: 1,  label: '1 diena' },
      { days: 3,  label: '3 dienas' },
      { days: 7,  label: '1 nedēļa' },
      { days: 14, label: '2 nedēļas' },
    ],
    apiPath: 'rentals/WATER_BOWSER',
  },
};

/** Ordered list for display in catalog / wizard landing */
export const RENTAL_SERVICE_LIST: RentalServiceDefinition[] = Object.values(RENTAL_SERVICES);

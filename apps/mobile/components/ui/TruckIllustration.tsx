/**
 * TruckIllustration — side-view SVG silhouettes for all 5 truck types.
 *
 * Usage:
 *   <TruckIllustration type="TIPPER_LARGE" height={56} />
 *   <TruckIllustration type="TIPPER_SMALL" height={32} onDark />
 */

import React from 'react';
import Svg, { Rect, Circle } from 'react-native-svg';

export type TruckType =
  | 'TIPPER_SMALL'
  | 'TIPPER_LARGE'
  | 'ARTICULATED_TIPPER'
  | 'FLATBED'
  | 'BOX_TRUCK';

/** Natural viewBox dimensions per truck type */
const NATURAL: Record<TruckType, { vw: number; vh: number }> = {
  TIPPER_SMALL: { vw: 120, vh: 60 },
  TIPPER_LARGE: { vw: 152, vh: 60 },
  ARTICULATED_TIPPER: { vw: 220, vh: 60 },
  FLATBED: { vw: 200, vh: 60 },
  BOX_TRUCK: { vw: 120, vh: 60 },
};

interface TruckIllustrationProps {
  type: TruckType;
  /** Render height in dp (default 58). Width scales from aspect ratio. */
  height?: number;
  /** Override render width; height then adapts via aspect ratio */
  width?: number;
  /** White/light palette for use on dark backgrounds */
  onDark?: boolean;
}

export function TruckIllustration({
  type,
  height = 58,
  width,
  onDark = false,
}: TruckIllustrationProps) {
  const { vw, vh } = NATURAL[type];
  const renderH = height;
  const renderW = width ?? Math.round((vw / vh) * renderH);

  const colors = onDark
    ? {
        body: '#ffffff',
        bed: '#d1d5db',
        glass: '#93c5fd',
        tire: '#e5e7eb',
        hub: '#9ca3af',
        chassis: '#d1d5db',
      }
    : {
        body: '#374151',
        bed: '#1f2937',
        glass: '#bfdbfe',
        tire: '#111827',
        hub: '#9ca3af',
        chassis: '#6b7280',
      };

  return (
    <Svg width={renderW} height={renderH} viewBox={`0 0 ${vw} ${vh}`}>
      {type === 'TIPPER_SMALL' && <TipperSmall {...colors} />}
      {type === 'TIPPER_LARGE' && <TipperLarge {...colors} />}
      {type === 'ARTICULATED_TIPPER' && <ArticulatedTipper {...colors} />}
      {type === 'FLATBED' && <Flatbed {...colors} />}
      {type === 'BOX_TRUCK' && <BoxTruck {...colors} />}
    </Svg>
  );
}

// ── Shared helpers ────────────────────────────────────────────────────

interface Colors {
  body: string;
  bed: string;
  glass: string;
  tire: string;
  hub: string;
  chassis: string;
}

function Wheel({
  cx,
  cy,
  tire,
  hub,
  r = 9,
}: {
  cx: number;
  cy: number;
  tire: string;
  hub: string;
  r?: number;
}) {
  return (
    <>
      <Circle cx={cx} cy={cy} r={r} fill={tire} />
      <Circle cx={cx} cy={cy} r={r * 0.38} fill={hub} />
    </>
  );
}

// ── TIPPER_SMALL — compact 2-axle dump truck  (vw=120 vh=60) ─────────

function TipperSmall({ body, bed, glass, tire, hub, chassis }: Colors) {
  return (
    <>
      {/* Chassis rail */}
      <Rect x={2} y={40} width={116} height={3} rx={1} fill={chassis} />
      {/* Mirror */}
      <Rect x={0} y={20} width={3} height={5} rx={1} fill={chassis} />
      {/* Cab */}
      <Rect x={2} y={17} width={30} height={23} rx={3} fill={body} />
      {/* Windshield */}
      <Rect x={5} y={20} width={20} height={13} rx={2} fill={glass} />
      {/* Dump body */}
      <Rect x={33} y={11} width={82} height={29} rx={3} fill={bed} />
      {/* Tailgate */}
      <Rect x={111} y={11} width={4} height={29} rx={1} fill={body} />
      {/* Wheels */}
      <Wheel cx={15} cy={49} tire={tire} hub={hub} />
      <Wheel cx={103} cy={49} tire={tire} hub={hub} />
    </>
  );
}

// ── TIPPER_LARGE — 3-axle large dump truck  (vw=152 vh=60) ───────────

function TipperLarge({ body, bed, glass, tire, hub, chassis }: Colors) {
  return (
    <>
      {/* Chassis rail */}
      <Rect x={2} y={40} width={148} height={3} rx={1} fill={chassis} />
      {/* Mirror */}
      <Rect x={0} y={18} width={3} height={5} rx={1} fill={chassis} />
      {/* Cab — slightly taller */}
      <Rect x={2} y={15} width={33} height={25} rx={3} fill={body} />
      {/* Windshield */}
      <Rect x={5} y={18} width={22} height={15} rx={2} fill={glass} />
      {/* Dump body — taller & wider than small */}
      <Rect x={36} y={7} width={112} height={33} rx={3} fill={bed} />
      {/* Tailgate */}
      <Rect x={144} y={7} width={4} height={33} rx={1} fill={body} />
      {/* Wheels — tandem rear axle */}
      <Wheel cx={15} cy={49} tire={tire} hub={hub} />
      <Wheel cx={116} cy={49} tire={tire} hub={hub} />
      <Wheel cx={138} cy={49} tire={tire} hub={hub} />
    </>
  );
}

// ── ARTICULATED_TIPPER — semi-trailer tipper  (vw=220 vh=60) ─────────

function ArticulatedTipper({ body, bed, glass, tire, hub, chassis }: Colors) {
  return (
    <>
      {/* Tractor chassis */}
      <Rect x={2} y={40} width={76} height={3} rx={1} fill={chassis} />
      {/* Fifth-wheel saddle */}
      <Rect x={60} y={32} width={22} height={10} rx={2} fill={chassis} />
      {/* Trailer chassis */}
      <Rect x={82} y={40} width={136} height={3} rx={1} fill={chassis} />
      {/* Mirror */}
      <Rect x={0} y={16} width={3} height={5} rx={1} fill={chassis} />
      {/* Tractor cab */}
      <Rect x={2} y={11} width={42} height={29} rx={3} fill={body} />
      {/* Windshield */}
      <Rect x={5} y={14} width={28} height={17} rx={2} fill={glass} />
      {/* Engine hood */}
      <Rect x={45} y={22} width={22} height={18} rx={2} fill={body} />
      {/* Trailer dump body — very long */}
      <Rect x={84} y={4} width={132} height={36} rx={3} fill={bed} />
      {/* Tailgate */}
      <Rect x={212} y={4} width={4} height={36} rx={1} fill={body} />
      {/* Tractor wheels */}
      <Wheel cx={15} cy={49} tire={tire} hub={hub} />
      <Wheel cx={58} cy={49} tire={tire} hub={hub} />
      <Wheel cx={74} cy={49} tire={tire} hub={hub} />
      {/* Trailer wheels — tridem */}
      <Wheel cx={150} cy={49} tire={tire} hub={hub} />
      <Wheel cx={172} cy={49} tire={tire} hub={hub} />
      <Wheel cx={194} cy={49} tire={tire} hub={hub} />
    </>
  );
}

// ── FLATBED — semi-trailer flatbed  (vw=200 vh=60) ───────────────────

function Flatbed({ body, bed, glass, tire, hub, chassis }: Colors) {
  return (
    <>
      {/* Tractor chassis */}
      <Rect x={2} y={40} width={70} height={3} rx={1} fill={chassis} />
      {/* Fifth-wheel saddle */}
      <Rect x={56} y={32} width={20} height={10} rx={2} fill={chassis} />
      {/* Trailer chassis */}
      <Rect x={76} y={40} width={122} height={3} rx={1} fill={chassis} />
      {/* Mirror */}
      <Rect x={0} y={16} width={3} height={5} rx={1} fill={chassis} />
      {/* Tractor cab */}
      <Rect x={2} y={11} width={40} height={29} rx={3} fill={body} />
      {/* Windshield */}
      <Rect x={5} y={14} width={26} height={17} rx={2} fill={glass} />
      {/* Engine hood */}
      <Rect x={43} y={22} width={20} height={18} rx={2} fill={body} />
      {/* Trailer FLAT platform — thin, not a tall dump box */}
      <Rect x={78} y={30} width={120} height={12} rx={2} fill={bed} />
      {/* Stake pockets / load rails along platform edges */}
      <Rect x={78} y={28} width={120} height={4} rx={1} fill={body} />
      {/* Tractor wheels */}
      <Wheel cx={15} cy={49} tire={tire} hub={hub} />
      <Wheel cx={52} cy={49} tire={tire} hub={hub} />
      <Wheel cx={67} cy={49} tire={tire} hub={hub} />
      {/* Trailer wheels */}
      <Wheel cx={138} cy={49} tire={tire} hub={hub} />
      <Wheel cx={176} cy={49} tire={tire} hub={hub} />
    </>
  );
}

// ── BOX_TRUCK — rigid box van  (vw=120 vh=60) ────────────────────────

function BoxTruck({ body, bed, glass, tire, hub, chassis }: Colors) {
  return (
    <>
      {/* Chassis rail */}
      <Rect x={2} y={40} width={116} height={3} rx={1} fill={chassis} />
      {/* Mirror */}
      <Rect x={0} y={24} width={3} height={5} rx={1} fill={chassis} />
      {/* Short cab/face */}
      <Rect x={2} y={24} width={22} height={16} rx={3} fill={body} />
      {/* Windshield (front face, not side) */}
      <Rect x={4} y={26} width={14} height={11} rx={2} fill={glass} />
      {/* Tall square box body — extends above cab (cargo higher than cab height) */}
      <Rect x={22} y={6} width={96} height={34} rx={3} fill={bed} />
      {/* Rear door detail */}
      <Rect x={114} y={6} width={4} height={34} rx={1} fill={body} />
      {/* Door split line */}
      <Rect x={22} y={22} width={96} height={2} rx={0} fill={chassis} />
      {/* Wheels */}
      <Wheel cx={15} cy={49} tire={tire} hub={hub} />
      <Wheel cx={104} cy={49} tire={tire} hub={hub} />
    </>
  );
}

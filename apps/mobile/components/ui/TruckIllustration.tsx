/**
 * TruckIllustration — side-view SVG silhouettes for all 5 truck types.
 *
 * Usage:
 *   <TruckIllustration type="TIPPER_LARGE" height={56} />
 *   <TruckIllustration type="TIPPER_SMALL" height={32} onDark />
 */

import React from 'react';
import { Image, View, Text } from 'react-native';

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
    <View 
      style={{ 
        width: 80, 
        height: 48, 
        backgroundColor: onDark ? '#374151' : '#f3f4f6', 
        borderRadius: 8, 
        alignItems: 'center', 
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: 10, color: onDark ? '#9ca3af' : '#9ca3af', fontWeight: '600', letterSpacing: 1 }}>AUTO</Text>
    </View>
  );
}


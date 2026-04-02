/**
 * RouteLayer — renders a driving-route polyline using react-native-maps.
 *
 * Accepts coords in { latitude, longitude } format (same as before).
 * Must be placed inside a <BaseMap>.
 */
import React from 'react';

let Polyline: any = null;
try {
  Polyline = require('react-native-maps').Polyline;
} catch {
  /* Expo Go */
}

interface Props {
  id: string;
  coordinates: Array<{ latitude: number; longitude: number }>;
  color?: string;
  width?: number;
  dashed?: boolean;
}

export function RouteLayer({
  id,
  coordinates,
  color = '#111827',
  width = 4,
  dashed = false,
}: Props) {
  if (coordinates.length < 2 || !Polyline) return null;
  return (
    <Polyline
      key={id}
      coordinates={coordinates}
      strokeColor={color}
      strokeWidth={width}
      lineDashPattern={dashed ? [8, 6] : undefined}
      lineCap="round"
      lineJoin="round"
    />
  );
}

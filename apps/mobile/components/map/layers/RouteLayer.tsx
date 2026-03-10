/**
 * RouteLayer — renders a driving-route polyline on a Mapbox map.
 *
 * Accepts coords in { latitude, longitude } format (matches RouteInfo.coords
 * from lib/maps.ts) and converts internally to [lng, lat] for Mapbox.
 *
 * Must be placed inside a <BaseMap> (or <MapboxGL.MapView>).
 */
import React from 'react';
// Lazy-load: native module not available in Expo Go
let MapboxGL: typeof import('@rnmapbox/maps').default | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  MapboxGL = require('@rnmapbox/maps').default;
} catch {
  /* Expo Go */
}

interface Props {
  /** Unique id for the ShapeSource + LineLayer — must be unique per map. */
  id: string;
  /** Route coords in { latitude, longitude } order (from RouteInfo.coords). */
  coordinates: Array<{ latitude: number; longitude: number }>;
  /** Line colour. Default green. */
  color?: string;
  /** Stroke width in dp. Default 4. */
  width?: number;
  /** Render as dashed (e.g. "to-pickup" leg). Default false. */
  dashed?: boolean;
}

export function RouteLayer({
  id,
  coordinates,
  color = '#111827',
  width = 4,
  dashed = false,
}: Props) {
  if (!MapboxGL) return null;
  if (coordinates.length < 2) return null;

  const shape: GeoJSON.Feature<GeoJSON.LineString> = {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: coordinates.map((c) => [c.longitude, c.latitude]),
    },
    properties: {},
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lineStyle: any = {
    lineColor: color,
    lineWidth: width,
    lineCap: 'round',
    lineJoin: 'round',
    ...(dashed ? { lineDasharray: [2, 1.5] } : {}),
  };

  return (
    <MapboxGL.ShapeSource id={id} shape={shape}>
      <MapboxGL.LineLayer id={`${id}-line`} style={lineStyle} />
    </MapboxGL.ShapeSource>
  );
}

/**
 * RouteLayer — renders a driving-route polyline on a Mapbox map.
 *
 * Accepts coords in { latitude, longitude } format (matches RouteInfo.coords
 * from lib/maps.ts) and converts internally to [lng, lat] for Mapbox.
 *
 * Must be placed inside a <BaseMap> (or <MapboxGL.MapView>).
 */
import React from 'react';
import MapboxGL from '@rnmapbox/maps';

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
  color = '#16a34a',
  width = 4,
  dashed = false,
}: Props) {
  if (coordinates.length < 2) return null;

  const shape: GeoJSON.Feature<GeoJSON.LineString> = {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: coordinates.map((c) => [c.longitude, c.latitude]),
    },
    properties: {},
  };

  const lineStyle: MapboxGL.LineLayerStyle = {
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

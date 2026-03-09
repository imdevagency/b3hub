/**
 * UserLayer — renders the user's live GPS position on a Mapbox map.
 *
 * Wraps MapboxGL.UserLocation so callers don't need to import @rnmapbox/maps
 * directly in every view component.
 *
 * Must be placed inside a <BaseMap> (or <MapboxGL.MapView>).
 */
import React from 'react';
// Lazy-load: native module not available in Expo Go
let MapboxGL: typeof import('@rnmapbox/maps').default | null = null;
let UserLocationRenderMode: typeof import('@rnmapbox/maps').UserLocationRenderMode;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mgl = require('@rnmapbox/maps');
  MapboxGL = mgl.default;
  UserLocationRenderMode = mgl.UserLocationRenderMode;
} catch {
  /* Expo Go */
}

interface Props {
  /** Hide the dot without unmounting the component. Default true. */
  visible?: boolean;
  /** Mapbox render mode. Default 'normal'. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  renderMode?: any;
}

export function UserLayer({ visible = true, renderMode = UserLocationRenderMode?.Normal }: Props) {
  if (!MapboxGL) return null;
  return <MapboxGL.UserLocation visible={visible} renderMode={renderMode} />;
}

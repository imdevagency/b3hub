/**
 * UserLayer — renders the user's live GPS position on a Mapbox map.
 *
 * Wraps MapboxGL.UserLocation so callers don't need to import @rnmapbox/maps
 * directly in every view component.
 *
 * Must be placed inside a <BaseMap> (or <MapboxGL.MapView>).
 */
import React from 'react';
import MapboxGL, { UserLocationRenderMode } from '@rnmapbox/maps';

interface Props {
  /** Hide the dot without unmounting the component. Default true. */
  visible?: boolean;
  /** Mapbox render mode. Default 'normal'. */
  renderMode?: UserLocationRenderMode;
}

export function UserLayer({ visible = true, renderMode = UserLocationRenderMode.Normal }: Props) {
  return <MapboxGL.UserLocation visible={visible} renderMode={renderMode} />;
}

/**
 * BaseMap — thin wrapper around MapboxGL.MapView.
 *
 * Owns nothing about the business domain. Just gives you a map with a Camera
 * and forwards a ref so callers can drive pan/zoom/fitBounds imperatively.
 *
 * All map features (routes, pins, user location) are added as children via
 * the layer components in components/map/layers/.
 */
import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import MapboxGL from '@rnmapbox/maps';

/** Rīga city centre — used as a sane default centre. */
export const RIGA_CENTER: [number, number] = [24.1052, 56.9496]; // [lng, lat]

export interface BaseMapProps {
  /** Pass a ref to drive the camera imperatively (fitBounds, setCamera, etc.) */
  cameraRef?: React.RefObject<MapboxGL.Camera | null>;
  /** Initial map centre as [longitude, latitude]. Defaults to Rīga. */
  center?: [number, number];
  /** Initial zoom level. Default 10. */
  zoom?: number;
  /** Called when user taps the map (GeoJSON feature passed as argument). */
  onPress?: (feature: unknown) => void;
  /** Override the outer container style. */
  style?: ViewStyle;
  /** Layers and annotations to render inside the map. */
  children?: React.ReactNode;
  rotateEnabled?: boolean;
  pitchEnabled?: boolean;
  compassEnabled?: boolean;
  /** Show Mapbox attribution. Default false (keep UI clean). */
  showAttribution?: boolean;
}

export function BaseMap({
  cameraRef,
  center = RIGA_CENTER,
  zoom = 10,
  onPress,
  style,
  children,
  rotateEnabled = false,
  pitchEnabled = false,
  compassEnabled = false,
  showAttribution = false,
}: BaseMapProps) {
  return (
    <MapboxGL.MapView
      style={[StyleSheet.absoluteFillObject, style]}
      compassEnabled={compassEnabled}
      scaleBarEnabled={false}
      rotateEnabled={rotateEnabled}
      pitchEnabled={pitchEnabled}
      attributionEnabled={showAttribution}
      logoEnabled={false}
      onPress={onPress}
    >
      <MapboxGL.Camera
        ref={cameraRef}
        centerCoordinate={center}
        zoomLevel={zoom}
        animationDuration={0}
      />
      {children}
    </MapboxGL.MapView>
  );
}

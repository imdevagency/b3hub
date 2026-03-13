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
import { StyleSheet, View, ViewStyle, NativeModules } from 'react-native';

// Lazy-load: @rnmapbox/maps native module is not available in Expo Go.
// We guard with NativeModules.RNMBXModule because the library throws a
// HostFunction exception (not a regular JS error) which bypasses try/catch.
let MapboxGL: typeof import('@rnmapbox/maps').default | null = null;
if (NativeModules.RNMBXModule) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    MapboxGL = require('@rnmapbox/maps').default;
  } catch {
    /* native module present but failed to init — map screens show placeholder */
  }
}

/** Rīga city centre — used as a sane default centre. */
export const RIGA_CENTER: [number, number] = [24.1052, 56.9496]; // [lng, lat]

export interface BaseMapProps {
  /** Pass a ref to drive the camera imperatively (fitBounds, setCamera, etc.) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cameraRef?: React.RefObject<any>;
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
  /**
   * Mapbox style URL. Defaults to StyleURL.Light (street map).
   * Pass MapboxGL.StyleURL.SatelliteStreet for aerial/satellite view.
   */
  styleURL?: string;
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
  styleURL,
}: BaseMapProps) {
  // Native module unavailable in Expo Go — render empty placeholder
  if (!MapboxGL) {
    return <View style={[StyleSheet.absoluteFillObject, style, { backgroundColor: '#e5e7eb' }]} />;
  }

  return (
    <MapboxGL.MapView
      style={[StyleSheet.absoluteFillObject, style]}
      styleURL={styleURL ?? MapboxGL.StyleURL.Light}
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

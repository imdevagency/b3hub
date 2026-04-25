/**
 * BaseMap — Google Maps wrapper using react-native-maps.
 *
 * Drop-in replacement for the old Mapbox BaseMap. Exposes the same
 * `cameraRef` API (setCamera / fitBounds) so all callers work unchanged.
 */
import React, { useRef, useEffect, useCallback } from 'react';
import { StyleSheet, ViewStyle, StyleProp, View, Text } from 'react-native';
import { colors } from '@/lib/theme';

// react-native-maps is not bundled in Expo Go SDK 50+. Guard the import so the
// app loads in Expo Go and shows a fallback instead of crashing the JS runtime.
let MapView: any = null;
let PROVIDER_GOOGLE: any = undefined;
type MapPressEvent = any;
type EdgePadding = { top: number; right: number; bottom: number; left: number };
try {
  const maps = require('react-native-maps');
  MapView = maps.default;
  PROVIDER_GOOGLE = maps.PROVIDER_GOOGLE;
} catch {
  /* Expo Go — react-native-maps not available */
}

/** Rīga city centre — [longitude, latitude] (Mapbox convention kept for compat). */
export const RIGA_CENTER: [number, number] = [24.1052, 56.9496];

/** Subset of the Mapbox Camera API exposed via the cameraRef shim. */
export interface CameraRefHandle {
  setCamera(opts: {
    centerCoordinate: [number, number];
    /** Omit to keep the current zoom level. */
    zoomLevel?: number;
    animationDuration?: number;
    pitch?: number;
    heading?: number;
  }): void;
  fitBounds(
    ne: [number, number],
    sw: [number, number],
    padding?: number | number[],
    animationDuration?: number,
  ): void;
}

export interface MapPressFeature {
  geometry?: { coordinates?: number[] };
  coordinates?: number[];
}

export interface BaseMapProps {
  cameraRef?: React.RefObject<CameraRefHandle | null>;
  /** [longitude, latitude]. Defaults to Rīga. */
  center?: [number, number];
  zoom?: number;
  onPress?: (feature: MapPressFeature) => void;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  rotateEnabled?: boolean;
  pitchEnabled?: boolean;
  compassEnabled?: boolean;
  showAttribution?: boolean;
  styleURL?: string;
  /** Show the blue GPS dot. Pass true when you'd previously use <UserLayer />. */
  showsUserLocation?: boolean;
  /** Show the "my location" center button. */
  showsMyLocationButton?: boolean;
  /** Map display type. Default 'standard'. */
  mapType?: 'standard' | 'satellite' | 'hybrid';
  /**
   * Insets the map camera viewport so that camera operations (setCamera,
   * fitBounds) centre content in the VISIBLE area (e.g. above a bottom sheet).
   * Mirrors react-native-maps MapView's mapPadding prop.
   */
  mapPadding?: EdgePadding;
  /**
   * Custom Google Maps style array. Pass a valid Google Maps style spec to
   * suppress POI clutter, adjust road colours, etc.
   */
  customMapStyle?: object[];
  /** Called once the map is ready to receive camera commands. */
  onMapReady?: () => void;
}
function zoomToDelta(zoom: number): number {
  return 360 / Math.pow(2, zoom);
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
  showsUserLocation = false,
  showsMyLocationButton = false,
  mapType = 'standard',
  mapPadding,
  customMapStyle,
  onMapReady: onMapReadyProp,
}: BaseMapProps) {
  const mapRef = useRef<typeof MapView | null>(null);
  // Track whether Google Maps has fully initialised and is ready to receive commands.
  const mapReady = useRef(false);
  // Queue of camera actions that arrived before the map was ready.
  const pendingCamera = useRef<(() => void) | null>(null);
  // Last zoom delta so setCamera can preserve zoom when zoomLevel is omitted.
  const lastDelta = useRef<number>(zoomToDelta(zoom));

  const onMapReady = useCallback(() => {
    mapReady.current = true;
    // Flush any queued camera action.
    if (pendingCamera.current) {
      pendingCamera.current();
      pendingCamera.current = null;
    }
    onMapReadyProp?.();
  }, [onMapReadyProp]);

  // Populate cameraRef with a Mapbox-compat shim so all callers work unchanged
  useEffect(() => {
    if (!cameraRef) return;
    (cameraRef as React.MutableRefObject<CameraRefHandle>).current = {
      setCamera({
        centerCoordinate,
        zoomLevel,
        animationDuration,
        pitch,
        heading,
      }: {
        centerCoordinate: [number, number];
        zoomLevel?: number;
        animationDuration?: number;
        pitch?: number;
        heading?: number;
      }) {
        const delta = zoomLevel != null ? zoomToDelta(zoomLevel) : lastDelta.current;
        if (zoomLevel != null) lastDelta.current = delta;
        const action = () => {
          if (pitch != null || heading != null) {
            mapRef.current?.animateCamera(
              {
                center: { latitude: centerCoordinate[1], longitude: centerCoordinate[0] },
                zoom: zoomLevel,
                pitch,
                heading,
              },
              { duration: animationDuration ?? 500 },
            );
          } else {
            mapRef.current?.animateToRegion(
              {
                latitude: centerCoordinate[1],
                longitude: centerCoordinate[0],
                latitudeDelta: delta,
                longitudeDelta: delta,
              },
              animationDuration ?? 500,
            );
          }
        };
        if (mapReady.current) {
          action();
        } else {
          pendingCamera.current = action;
        }
      },
      fitBounds(
        ne: [number, number],
        sw: [number, number],
        padding: number | number[],
        _duration: number,
      ) {
        const pad = Array.isArray(padding)
          ? { top: padding[0], right: padding[1], bottom: padding[2], left: padding[3] }
          : {
              top: padding as number,
              right: padding as number,
              bottom: padding as number,
              left: padding as number,
            };
        const action = () =>
          mapRef.current?.fitToCoordinates(
            [
              { latitude: ne[1], longitude: ne[0] },
              { latitude: sw[1], longitude: sw[0] },
            ],
            { edgePadding: pad, animated: true },
          );
        if (mapReady.current) {
          action();
        } else {
          pendingCamera.current = action;
        }
      },
    };
  }, [cameraRef]);

  // Normalize onPress to a Mapbox-style feature so AddressPicker works unchanged
  const handlePress = (e: MapPressEvent) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    onPress?.({ geometry: { coordinates: [longitude, latitude] } });
  };

  const [lng, lat] = center;
  const delta = zoomToDelta(zoom);

  if (!MapView) {
    return (
      <View
        style={[
          StyleSheet.absoluteFillObject,
          style as ViewStyle,
          { backgroundColor: colors.bgMuted, alignItems: 'center', justifyContent: 'center' },
        ]}
      >
        <Text style={{ color: colors.textDisabled, fontSize: 13 }}>
          Map not available in Expo Go
        </Text>
      </View>
    );
  }

  return (
    <MapView
      ref={mapRef}
      provider={PROVIDER_GOOGLE}
      style={[StyleSheet.absoluteFillObject, style]}
      initialRegion={{
        latitude: lat,
        longitude: lng,
        latitudeDelta: delta,
        longitudeDelta: delta,
      }}
      showsUserLocation={showsUserLocation}
      followsUserLocation={false}
      showsMyLocationButton={showsMyLocationButton}
      mapType={mapType}
      showsCompass={compassEnabled}
      showsScale={false}
      showsBuildings={true}
      showsTraffic={false}
      rotateEnabled={rotateEnabled}
      pitchEnabled={pitchEnabled}
      moveOnMarkerPress={false}
      onMapReady={onMapReady}
      onPress={onPress ? handlePress : undefined}
      mapPadding={mapPadding}
      customMapStyle={customMapStyle}
    >
      {children}
    </MapView>
  );
}

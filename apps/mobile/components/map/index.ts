/**
 * components/map — public API for all map primitives.
 *
 * How to use:
 *
 *   import { BaseMap, RouteLayer, PinLayer, UserLayer, useRoute, useGeocode } from '@/components/map';
 *
 * Build new map views by composing these primitives:
 *
 *   function MyOrderTrackingMap({ pickup, delivery, driverPos }) {
 *     const cameraRef = useRef<any>(null);
 *     const { route } = useRoute(pickup, delivery);
 *     return (
 *       <BaseMap cameraRef={cameraRef}>
 *         <UserLayer />
 *         <RouteLayer id="route" coordinates={route?.coords ?? []} />
 *         <PinLayer id="pickup" coordinate={pickup} type="pickup" />
 *         <PinLayer id="delivery" coordinate={delivery} type="delivery" />
 *       </BaseMap>
 *     );
 *   }
 */

// Core
export { BaseMap, RIGA_CENTER } from './BaseMap';
export type { BaseMapProps } from './BaseMap';

// Layers
export { RouteLayer } from './layers/RouteLayer';
export { PinLayer } from './layers/PinLayer';
export type { PinType } from './layers/PinLayer';
export { UserLayer } from './layers/UserLayer';

// Hooks
export { useRoute } from './hooks/useRoute';
export { useGeocode } from './hooks/useGeocode';
export type { GeocodeSuggestion, AddressWithCity } from './hooks/useGeocode';

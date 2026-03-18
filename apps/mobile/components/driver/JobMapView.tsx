import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { BaseMap } from '@/components/map';
import type { CameraRefHandle } from '@/components/map';
import { Marker } from 'react-native-maps';
import { haversineKm, RADIUS_OPTIONS } from './job-types';
import type { TransportJob } from './job-types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function pinColor(distKm: number | null): string {
  if (distKm === null) return '#6b7280';
  if (distKm < 50) return '#111827';
  if (distKm < 120) return '#9ca3af';
  return '#111827';
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface JobMapViewProps {
  jobs: TransportJob[];
  driverLat: number | null;
  driverLng: number | null;
  mapRadius: number;
  onRadiusChange: (r: number) => void;
  onJobSelect: (job: TransportJob) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function JobMapView({
  jobs,
  driverLat,
  driverLng,
  mapRadius,
  onRadiusChange,
  onJobSelect,
}: JobMapViewProps) {
  const cameraRef = useRef<CameraRefHandle | null>(null);
  const centerLat = driverLat ?? 56.946;
  const centerLng = driverLng ?? 24.105; // Riga default

  const visibleJobs = jobs.filter((j) => {
    if (driverLat === null || driverLng === null) return true;
    return haversineKm(driverLat, driverLng, j.fromLat, j.fromLng) <= mapRadius;
  });

  // Fly camera to driver position when it becomes available
  useEffect(() => {
    if (driverLat == null || driverLng == null) return;
    cameraRef.current?.setCamera({
      centerCoordinate: [driverLng, driverLat],
      zoomLevel: 7,
      animationDuration: 500,
    });
  }, [driverLat, driverLng]);

  return (
    <View style={{ flex: 1 }}>
      <BaseMap
        cameraRef={cameraRef}
        center={[centerLng, centerLat]}
        zoom={driverLat ? 7 : 6}
        showsUserLocation={driverLat !== null && driverLng !== null}
        showsMyLocationButton
      >
        {/* Job pickup pins */}
        {visibleJobs.map((job) => {
          const distKm =
            driverLat !== null && driverLng !== null
              ? haversineKm(driverLat, driverLng, job.fromLat, job.fromLng)
              : null;
          const color = pinColor(distKm);
          return (
            <Marker
              key={job.id}
              coordinate={{ latitude: job.fromLat, longitude: job.fromLng }}
              onPress={() => onJobSelect(job)}
            >
              <View style={[s.pin, { backgroundColor: color }]}>
                <Text style={s.pinPrice}>{job.priceTotal.toFixed(0)}€</Text>
              </View>
            </Marker>
          );
        })}
      </BaseMap>

      {/* Radius chips overlay */}
      <View style={s.radiusOverlay}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.radiusChipsRow}
        >
          {RADIUS_OPTIONS.map((r) => (
            <TouchableOpacity
              key={r}
              style={[s.radiusChip, mapRadius === r && s.radiusChipActive]}
              onPress={() => onRadiusChange(r)}
            >
              <Text style={[s.radiusChipText, mapRadius === r && s.radiusChipTextActive]}>
                {r} km
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Job count badge */}
      <View style={s.countBadge}>
        <Text style={s.countBadgeText}>{visibleJobs.length} darbi</Text>
      </View>

      {/* Legend */}
      <View style={s.legend}>
        {[
          { color: '#111827', label: '<50 km' },
          { color: '#9ca3af', label: '50–120 km' },
          { color: '#111827', label: '>120 km' },
        ].map((item) => (
          <View key={item.label} style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: item.color }]} />
            <Text style={s.legendText}>{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  pin: {
    minWidth: 52,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  pinPrice: { fontSize: 12, fontWeight: '800', color: '#ffffff' },
  radiusOverlay: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
  },
  radiusChipsRow: { flexDirection: 'row', gap: 8 },
  radiusChip: {
    backgroundColor: 'rgba(31,41,55,0.88)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#4b5563',
  },
  radiusChipActive: { backgroundColor: '#111827', borderColor: '#111827' },
  radiusChipText: { fontSize: 13, fontWeight: '600', color: '#9ca3af' },
  radiusChipTextActive: { color: '#ffffff' },
  countBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
    backgroundColor: 'rgba(31,41,55,0.88)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#4b5563',
  },
  countBadgeText: { fontSize: 13, fontWeight: '700', color: '#f9fafb' },
  legend: {
    position: 'absolute',
    bottom: 16,
    left: 14,
    flexDirection: 'row',
    gap: 12,
    backgroundColor: 'rgba(31,41,55,0.88)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#4b5563',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 11, fontWeight: '600', color: '#d1d5db' },
});

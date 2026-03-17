/**
 * Services — buyer discovery hub (simplified)
 *
 * 2×2 service grid + single materials catalogue CTA.
 * No search bar, no animations — fast and clear.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { HardHat, Package, Trash2, Truck, ArrowRight } from 'lucide-react-native';
import { haptics } from '@/lib/haptics';

const SERVICES = [
  {
    id: 'materials',
    icon: HardHat,
    label: 'Materiāli',
    sub: 'Smiltis, grants, šķembas',
    color: '#d97706',
    bg: '#fef3c7',
    route: '/order-request',
  },
  {
    id: 'container',
    icon: Package,
    label: 'Konteineri',
    sub: 'Konteineru noma un izvešana',
    color: '#2563eb',
    bg: '#eff6ff',
    route: '/order',
  },
  {
    id: 'disposal',
    icon: Trash2,
    label: 'Utilizācija',
    sub: 'Atkritumu un gružu izvešana',
    color: '#059669',
    bg: '#ecfdf5',
    route: '/disposal',
  },
  {
    id: 'freight',
    icon: Truck,
    label: 'Transports',
    sub: 'Kravu pārvadāšana A → B',
    color: '#7c3aed',
    bg: '#f5f3ff',
    route: '/transport',
  },
] as const;

export default function ServicesScreen() {
  const router = useRouter();

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>Pakalpojumi</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 80, gap: 12 }}
      >
        <Text style={s.sectionLabel}>Pakalpojumi jums</Text>

        {/* 2×2 service tiles */}
        <View style={s.serviceGrid}>
          {SERVICES.map((svc) => {
            const Icon = svc.icon;
            return (
              <TouchableOpacity
                key={svc.id}
                style={s.serviceTile}
                onPress={() => {
                  haptics.light();
                  router.push(svc.route as any);
                }}
                activeOpacity={0.75}
              >
                <View style={[s.serviceIconWrap, { backgroundColor: svc.bg }]}>
                  <Icon size={22} color={svc.color} />
                </View>
                <Text style={s.serviceLabel}>{svc.label}</Text>
                <Text style={s.serviceSub} numberOfLines={2}>
                  {svc.sub}
                </Text>
                <View style={s.serviceArrow}>
                  <ArrowRight size={14} color="#9ca3af" />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Materials catalogue shortcut */}
        <TouchableOpacity
          style={s.browseAllBtn}
          onPress={() => {
            haptics.light();
            router.push('/order-request' as any);
          }}
          activeOpacity={0.8}
        >
          <HardHat size={18} color="#111827" />
          <Text style={s.browseAllText}>Skatīt materiālu katalogu</Text>
          <ArrowRight size={16} color="#111827" />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f2f2f7', paddingTop: 16 },
  header: { paddingHorizontal: 20, marginBottom: 16 },
  title: { fontSize: 28, fontWeight: '800', color: '#111827', letterSpacing: -0.5 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9ca3af',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  serviceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  serviceTile: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  serviceIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  serviceLabel: { fontSize: 14, fontWeight: '700', color: '#111827' },
  serviceSub: { fontSize: 12, color: '#6b7280', lineHeight: 16 },
  serviceArrow: { marginTop: 4 },
  browseAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  browseAllText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 10,
  },
});

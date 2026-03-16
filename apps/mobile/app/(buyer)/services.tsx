/**
 * Services — buyer discovery hub (Uber-style services tab)
 *
 * Shows all available B3Hub services as browsable tiles + a materials
 * catalogue section so users can discover what to order.
 */
import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import type { ApiMaterial } from '@/lib/api';
import {
  Search,
  HardHat,
  Package,
  Trash2,
  Recycle,
  ArrowRight,
  Layers,
  Mountain,
  Waves,
} from 'lucide-react-native';
import { haptics } from '@/lib/haptics';
import { CATEGORY_LABELS } from '@/lib/materials';

// ── Service definitions ────────────────────────────────────────────────────

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
] as const;

// Subset of quick categories surfaced on the Services screen
const FEATURED_CATEGORIES = [
  { key: 'SAND', icon: Waves, label: 'Smiltis', color: '#d97706', bg: '#fef3c7' },
  { key: 'GRAVEL', icon: Mountain, label: 'Grants', color: '#475569', bg: '#e2e8f0' },
  { key: 'STONE', icon: Mountain, label: 'Šķembas', color: '#334155', bg: '#dde1e8' },
  { key: 'RECYCLED_CONCRETE', icon: Recycle, label: 'Reciklāts', color: '#16a34a', bg: '#dcfce7' },
  { key: 'CONCRETE', icon: Layers, label: 'Betons', color: '#6b7280', bg: '#f0f0f0' },
  { key: 'OTHER', icon: Layers, label: 'Citi', color: '#9ca3af', bg: '#f3f4f6' },
];

// ── Component ─────────────────────────────────────────────────────────────

export default function ServicesScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [query, setQuery] = useState('');

  // Top-material count badge (loaded on focus)
  const [matCount, setMatCount] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      api.materials
        .getAll(token)
        .then((items: ApiMaterial[]) => setMatCount(items.length))
        .catch(() => {});
    }, [token]),
  );

  // Tile entrance animations
  const tileAnims = useRef(
    SERVICES.map(() => ({ opacity: new Animated.Value(0), y: new Animated.Value(16) })),
  ).current;

  React.useEffect(() => {
    SERVICES.forEach((_, i) => {
      Animated.sequence([
        Animated.delay(i * 60),
        Animated.parallel([
          Animated.spring(tileAnims[i].opacity, {
            toValue: 1,
            useNativeDriver: true,
            tension: 72,
            friction: 11,
          }),
          Animated.spring(tileAnims[i].y, {
            toValue: 0,
            useNativeDriver: true,
            tension: 72,
            friction: 11,
          }),
        ]),
      ]).start();
    });
  }, []);

  // Filter services by search query
  const filteredServices = SERVICES.filter(
    (s) =>
      query.length === 0 ||
      s.label.toLowerCase().includes(query.toLowerCase()) ||
      s.sub.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <View style={s.root}>
      {/* ── Header ────────────────────────────────────────────── */}
      <View style={s.header}>
        <Text style={s.title}>Pakalpojumi</Text>
      </View>

      {/* ── Search bar ────────────────────────────────────────── */}
      <View style={s.searchWrap}>
        <Search size={16} color="#9ca3af" style={s.searchIcon} />
        <TextInput
          style={s.searchInput}
          placeholder="Ko jūs meklējat?"
          placeholderTextColor="#9ca3af"
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
        />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, { paddingBottom: 80 }]}
      >
        {/* ── Service tiles 2×2 ─────────────────────────────── */}
        <Text style={s.sectionLabel}>Pakalpojumi jums</Text>
        <View style={s.serviceGrid}>
          {filteredServices.map((svc, idx) => {
            const Icon = svc.icon;
            return (
              <Animated.View
                key={svc.id}
                style={{
                  opacity: tileAnims[idx]?.opacity ?? 1,
                  transform: [{ translateY: tileAnims[idx]?.y ?? 0 }],
                  width: '48%',
                }}
              >
                <TouchableOpacity
                  style={[s.serviceTile, { width: '100%' }]}
                  onPress={() => {
                    haptics.light();
                    router.push(svc.route as any);
                  }}
                  activeOpacity={0.75}
                >
                  {/* Icon badge */}
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
              </Animated.View>
            );
          })}
        </View>

        {/* ── Materials catalogue shortcut ───────────────────── */}
        {(query.length === 0 ||
          'materiāli katalogs smiltis grants'.includes(query.toLowerCase())) && (
          <>
            <View style={s.sectionRow}>
              <Text style={s.sectionLabel}>Materiālu katalogs</Text>
              {matCount != null && (
                <Text style={s.sectionBadge}>{matCount} preces</Text>
              )}
            </View>

            {/* Featured category pills */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.pillsRow}
            >
              {FEATURED_CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                return (
                  <TouchableOpacity
                    key={cat.key}
                    style={[s.categoryPill, { backgroundColor: cat.bg }]}
                    onPress={() => {
                      haptics.light();
                      // Open order-request pre-filtered to this category
                      router.push({
                        pathname: '/order-request' as any,
                        params: { category: cat.key },
                      });
                    }}
                    activeOpacity={0.75}
                  >
                    <Icon size={14} color={cat.color} />
                    <Text style={[s.pillLabel, { color: cat.color }]}>{cat.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Browse all CTA */}
            <TouchableOpacity
              style={s.browseAllBtn}
              onPress={() => {
                haptics.light();
                router.push('/order-request' as any);
              }}
              activeOpacity={0.8}
            >
              <HardHat size={18} color="#111827" />
              <Text style={s.browseAllText}>Skatīt visu katalogu</Text>
              <ArrowRight size={16} color="#111827" />
            </TouchableOpacity>
          </>
        )}

        {/* ── No results ─────────────────────────────────────── */}
        {filteredServices.length === 0 && (
          <View style={s.emptyState}>
            <Search size={36} color="#d1d5db" />
            <Text style={s.emptyText}>Nav atbilstošu pakalpojumu</Text>
            <Text style={s.emptySubText}>Mēģiniet citu meklēšanas vārdu</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f2f2f7', paddingTop: 16 },

  // Header
  header: { paddingHorizontal: 20, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '800', color: '#111827', letterSpacing: -0.5 },

  // Search
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 20,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  searchIcon: {},
  searchInput: { flex: 1, fontSize: 15, color: '#111827', fontWeight: '500' },

  scroll: { paddingHorizontal: 16, gap: 12 },

  // Section headings
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9ca3af',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionBadge: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },

  // Service tiles 2×2
  serviceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  serviceTile: {
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

  // Category pills
  pillsRow: { gap: 8, paddingRight: 8, paddingBottom: 4 },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  pillLabel: { fontSize: 13, fontWeight: '600' },

  // Browse all button
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
    marginTop: 4,
  },
  browseAllText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#111827', marginLeft: 10 },

  // Empty state
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#374151' },
  emptySubText: { fontSize: 13, color: '#9ca3af' },
});

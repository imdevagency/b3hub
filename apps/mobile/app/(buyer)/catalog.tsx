import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  RefreshControl,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/text';
import {
  Layers,
  Leaf,
  Mountain,
  Recycle,
  Waves,
  Zap,
  MoreHorizontal,
  Box,
  Search,
  X,
  Package,
  FolderOpen,
  ChevronRight,
  MapPin,
  Calculator,
} from 'lucide-react-native';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import type { MaterialCategory, ApiMaterial } from '@/lib/api';
import {
  CATEGORY_LABELS,
  CATEGORY_DESCRIPTIONS,
  MATERIAL_CATEGORIES,
  UNIT_SHORT,
} from '@/lib/materials';

// ── Display order — most common construction materials first ──────────────

const DISPLAY_ORDER: MaterialCategory[] = [
  'GRAVEL',
  'SAND',
  'STONE',
  'CONCRETE',
  'ASPHALT',
  'SOIL',
  'CLAY',
  'RECYCLED_CONCRETE',
  'RECYCLED_SOIL',
  'OTHER',
];

// ── Category metadata ──────────────────────────────────────────────────────

type CatMeta = { bg: string; accent: string; icon: React.ElementType };

const CATEGORY_META: Record<MaterialCategory, CatMeta> = {
  SAND: { bg: '#fef3c7', accent: '#d97706', icon: Waves },
  GRAVEL: { bg: '#e2e8f0', accent: '#475569', icon: Mountain },
  STONE: { bg: '#dde1e8', accent: '#334155', icon: Mountain },
  CONCRETE: { bg: '#f0f0f0', accent: '#6b7280', icon: Box },
  SOIL: { bg: '#fefce8', accent: '#92400e', icon: Layers },
  RECYCLED_CONCRETE: { bg: '#dcfce7', accent: '#16a34a', icon: Recycle },
  RECYCLED_SOIL: { bg: '#d1fae5', accent: '#059669', icon: Recycle },
  ASPHALT: { bg: '#e5e5e5', accent: '#44403c', icon: Zap },
  CLAY: { bg: '#ffedd5', accent: '#c2410c', icon: Layers },
  OTHER: { bg: '#f3f4f6', accent: '#6b7280', icon: MoreHorizontal },
};

// ── Category card ─────────────────────────────────────────────────────────

function CategoryCard({
  category,
  hasRecycled,
  supplierCount,
  minPrice,
  onPress,
}: {
  category: MaterialCategory;
  hasRecycled: boolean;
  supplierCount: number;
  minPrice: number | null;
  onPress: () => void;
}) {
  const meta = CATEGORY_META[category] ?? { bg: '#f3f4f6', accent: '#6b7280', icon: Package };
  const Icon = meta.icon;
  const description = CATEGORY_DESCRIPTIONS[category];

  return (
    <TouchableOpacity
      style={s.catCard}
      onPress={() => {
        haptics.light();
        onPress();
      }}
      activeOpacity={0.7}
    >
      <View style={[s.catIconWrap, { backgroundColor: '#f3f4f6' }]}>
        <Icon size={24} color="#000" strokeWidth={1.5} />
      </View>

      <View style={s.catBody}>
        <View style={s.catNameRow}>
          <Text style={s.catName}>{CATEGORY_LABELS[category]}</Text>
          {hasRecycled && (
            <View style={s.recycledBadge}>
              <Text style={s.recycledText}>Pārstrādāts</Text>
            </View>
          )}
        </View>
        <Text style={s.catDesc} numberOfLines={1}>
          {supplierCount > 0 ? `${supplierCount} piegādātāji` : description}
        </Text>
      </View>

      <View style={s.catRight}>
        {minPrice != null && <Text style={s.catMinPrice}>no €{minPrice.toFixed(2)}</Text>}
      </View>
    </TouchableOpacity>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────

export default function CatalogScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useAuth();
  const params = useLocalSearchParams<{ projectId?: string }>();
  const projectId = params.projectId;

  const [allMaterials, setAllMaterials] = useState<ApiMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [filterMode, setFilterMode] = useState<'ALL' | 'RECYCLED'>('ALL');
  const [nearMe, setNearMe] = useState(false);
  const [nearMeCoords, setNearMeCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [nearMeLoading, setNearMeLoading] = useState(false);
  const [resumeDraft, setResumeDraft] = useState<{
    materialName: string;
    quantity: number;
    unit: string;
  } | null>(null);
  const [calcVisible, setCalcVisible] = useState(false);
  const [calcArea, setCalcArea] = useState('');
  const [calcDepth, setCalcDepth] = useState('');
  const [calcDensity, setCalcDensity] = useState('1.6');

  // ── Live pricing from last known delivery address ─────────────────────────
  const [savedDelivery, setSavedDelivery] = useState<{
    lat: number;
    lng: number;
    address: string;
  } | null>(null);
  const [liveData, setLiveData] = useState<
    Record<string, { minPrice: number | null; supplierCount: number }>
  >({});
  const [livePricesLoading, setLivePricesLoading] = useState(false);
  const liveDataKeyRef = React.useRef<string>('');

  const LAST_DELIVERY_KEY = '@b3hub_last_delivery';
  const DRAFT_KEY = '@b3hub_wizard_draft';
  const DRAFT_MAX_AGE_MS = 48 * 60 * 60 * 1000;

  // Check for a saved draft on every focus; also read the last delivery address
  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem(DRAFT_KEY)
        .then((raw) => {
          if (!raw) {
            setResumeDraft(null);
            return;
          }
          try {
            const d = JSON.parse(raw);
            if (Date.now() - (d.savedAt ?? 0) > DRAFT_MAX_AGE_MS) {
              AsyncStorage.removeItem(DRAFT_KEY).catch(() => {});
              setResumeDraft(null);
              return;
            }
            setResumeDraft({ materialName: d.materialName, quantity: d.quantity, unit: d.unit });
          } catch {
            setResumeDraft(null);
          }
        })
        .catch(() => {});

      AsyncStorage.getItem(LAST_DELIVERY_KEY)
        .then((raw) => {
          if (!raw) return;
          try {
            const d = JSON.parse(raw);
            if (d?.lat && d?.lng && d?.address) {
              setSavedDelivery({ lat: d.lat, lng: d.lng, address: d.address });
            }
          } catch {}
        })
        .catch(() => {});
    }, []),
  );

  // Fetch all materials — reload on every focus so new listings appear
  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      setLoading(true);
      const params: Record<string, string> = {};
      if (nearMeCoords) {
        params.lat = String(nearMeCoords.lat);
        params.lng = String(nearMeCoords.lng);
      }
      api.materials
        .getAll(token, params)
        .then((data) => {
          setAllMaterials(Array.isArray(data) ? data : ((data as any).items ?? []));
        })
        .catch(() => setAllMaterials([]))
        .finally(() => setLoading(false));
    }, [token, nearMeCoords]),
  );

  const handleNearMeToggle = useCallback(async () => {
    haptics.light();
    if (nearMe) {
      setNearMe(false);
      setNearMeCoords(null);
      return;
    }
    setNearMeLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setNearMeLoading(false);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setNearMeCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      setNearMe(true);
    } catch {
      // silently fail — if location unavailable just don't filter
    } finally {
      setNearMeLoading(false);
    }
  }, [nearMe]);

  const handleRefresh = useCallback(() => {
    if (!token) return;
    setRefreshing(true);
    const params: Record<string, string> = {};
    if (nearMeCoords) {
      params.lat = String(nearMeCoords.lat);
      params.lng = String(nearMeCoords.lng);
    }
    api.materials
      .getAll(token, params)
      .then((data) => {
        setAllMaterials(Array.isArray(data) ? data : ((data as any).items ?? []));
      })
      .catch(() => {})
      .finally(() => setRefreshing(false));
  }, [token, nearMeCoords]);

  // Fetch live per-category prices whenever the effective delivery location changes
  const STANDARD_QTY = 26; // standard truck load for price comparison
  React.useEffect(() => {
    if (!token) return;
    const loc = nearMeCoords || savedDelivery;
    if (!loc) {
      liveDataKeyRef.current = '';
      setLiveData({});
      return;
    }
    const key = `${loc.lat.toFixed(4)},${loc.lng.toFixed(4)}`;
    if (liveDataKeyRef.current === key) return; // same location, skip refetch

    // Debounce: wait 400ms after location stops changing before firing 10 API calls
    const timerId = setTimeout(() => {
      liveDataKeyRef.current = key;
      setLivePricesLoading(true);
      Promise.all(
        DISPLAY_ORDER.map(async (category) => {
          try {
            const offers = await api.materials.getOffers(
              { category, quantity: STANDARD_QTY, lat: loc.lat, lng: loc.lng },
              token,
            );
            const prices = offers.map((o) => o.effectiveUnitPrice).filter((p) => p > 0);
            return {
              category,
              minPrice: prices.length > 0 ? Math.min(...prices) : null,
              supplierCount: offers.length,
            };
          } catch {
            return { category, minPrice: null, supplierCount: 0 };
          }
        }),
      )
        .then((results) => {
          const map: Record<string, { minPrice: number | null; supplierCount: number }> = {};
          for (const r of results) {
            map[r.category] = { minPrice: r.minPrice, supplierCount: r.supplierCount };
          }
          setLiveData(map);
        })
        .finally(() => setLivePricesLoading(false));
    }, 400);

    return () => clearTimeout(timerId);
  }, [token, savedDelivery, nearMeCoords]);

  // Per-category: unique supplier count + recycled flag + lowest base price
  const categoryData = useMemo(() => {
    const map: Record<
      string,
      {
        supplierCount: number;
        hasRecycled: boolean;
        supplierIds: Set<string>;
        minPrice: number | null;
      }
    > = {};
    for (const m of allMaterials) {
      if (!map[m.category])
        map[m.category] = {
          supplierCount: 0,
          hasRecycled: false,
          supplierIds: new Set(),
          minPrice: null,
        };
      if (m.isRecycled) map[m.category].hasRecycled = true;
      map[m.category].supplierIds.add(m.supplier.id);
      if (m.basePrice > 0) {
        if (map[m.category].minPrice === null || m.basePrice < map[m.category].minPrice!) {
          map[m.category].minPrice = m.basePrice;
        }
      }
    }
    const result: Record<
      string,
      { supplierCount: number; hasRecycled: boolean; minPrice: number | null }
    > = {};
    for (const [cat, d] of Object.entries(map)) {
      result[cat] = {
        supplierCount: d.supplierIds.size,
        hasRecycled: d.hasRecycled,
        minPrice: d.minPrice,
      };
    }
    return result;
  }, [allMaterials]);

  // Filter categories by search query and recycled tab, preserving DISPLAY_ORDER
  const visibleCategories = useMemo(() => {
    const ordered = [
      ...DISPLAY_ORDER,
      ...MATERIAL_CATEGORIES.filter((c) => !DISPLAY_ORDER.includes(c)),
    ];
    const modeFiltered =
      filterMode === 'RECYCLED'
        ? ordered.filter((c) => c === 'RECYCLED_CONCRETE' || c === 'RECYCLED_SOIL')
        : ordered;
    if (!query.trim()) return modeFiltered;
    const q = query.trim().toLowerCase();
    return modeFiltered.filter(
      (cat) =>
        CATEGORY_LABELS[cat].toLowerCase().includes(q) ||
        (CATEGORY_DESCRIPTIONS[cat] ?? '').toLowerCase().includes(q) ||
        allMaterials.some((m) => m.category === cat && m.name.toLowerCase().includes(q)),
    );
  }, [query, filterMode, allMaterials]);

  const handleCategoryPress = (cat: MaterialCategory) => {
    router.push({
      pathname: '/order-request-new',
      params: { initialCategory: cat, projectId: projectId || undefined },
    });
  };

  return (
    <ScreenContainer bg="#ffffff">
      <View style={s.uberHeader}>
        <Text style={s.uberTitle}>Katalogs</Text>
      </View>
      {/* ── Header & Search ── */}
      <View style={s.topBar}>
        <View style={[s.searchBox, searchFocused && s.searchBoxFocused]}>
          <Search size={16} color={searchFocused ? '#00A878' : '#9ca3af'} />
          <TextInput
            style={s.searchInput}
            placeholder="Meklēt kategoriju..."
            placeholderTextColor="#9ca3af"
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                haptics.light();
                setQuery('');
              }}
              hitSlop={8}
            >
              <X size={16} color="#9ca3af" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Filter chips ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.chipScroll}
        contentContainerStyle={s.chipRow}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity
          style={[s.chip, filterMode === 'ALL' && s.chipActive]}
          onPress={() => {
            haptics.light();
            setFilterMode('ALL');
          }}
          activeOpacity={0.8}
        >
          <Text style={[s.chipText, filterMode === 'ALL' && s.chipTextActive]}>Visi</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.chip, filterMode === 'RECYCLED' && s.chipActive]}
          onPress={() => {
            haptics.light();
            setFilterMode('RECYCLED');
          }}
          activeOpacity={0.8}
        >
          <Recycle size={13} color={filterMode === 'RECYCLED' ? '#fff' : '#111827'} />
          <Text style={[s.chipText, filterMode === 'RECYCLED' ? s.chipTextActive : undefined]}>
            Reciklēti
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.chip, nearMe && s.chipActive]}
          onPress={handleNearMeToggle}
          activeOpacity={0.8}
          disabled={nearMeLoading}
        >
          <MapPin size={13} color={nearMe ? '#fff' : '#111827'} />
          <Text style={[s.chipText, nearMe ? s.chipTextActive : s.chipTextBlue]}>
            {nearMeLoading ? '...' : 'Tuvumā'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.chip}
          onPress={() => {
            haptics.light();
            setCalcVisible(true);
          }}
          activeOpacity={0.8}
        >
          <Calculator size={13} color="#111827" />
          <Text style={[s.chipText, { color: '#111827' }]}>Kalkulators</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ── Material quantity calculator modal ── */}
      <Modal
        visible={calcVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCalcVisible(false)}
      >
        <KeyboardAvoidingView
          style={s.calcOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={s.calcSheet}>
            <View style={s.calcHeader}>
              <Calculator size={16} color="#111827" />
              <Text style={s.calcTitle}>Daudzuma kalkulators</Text>
              <TouchableOpacity hitSlop={12} onPress={() => setCalcVisible(false)}>
                <X size={18} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <Text style={s.calcSubtitle}>
              Ievadiet laukumu un dziļumu, lai aprēķinātu nepieciešamos tonnus.
            </Text>

            <View style={s.calcRow}>
              <View style={s.calcField}>
                <Text style={s.calcLabel}>Laukums (m²)</Text>
                <TextInput
                  style={s.calcInput}
                  value={calcArea}
                  onChangeText={setCalcArea}
                  keyboardType="decimal-pad"
                  placeholder="piem., 120"
                  placeholderTextColor="#9ca3af"
                />
              </View>
              <View style={s.calcField}>
                <Text style={s.calcLabel}>Dziļums (cm)</Text>
                <TextInput
                  style={s.calcInput}
                  value={calcDepth}
                  onChangeText={setCalcDepth}
                  keyboardType="decimal-pad"
                  placeholder="piem., 15"
                  placeholderTextColor="#9ca3af"
                />
              </View>
            </View>

            <View style={s.calcDensityRow}>
              <Text style={s.calcLabel}>Blīvums (t/m³)</Text>
              <View style={s.calcDensityChips}>
                {[
                  { label: 'Grants 1.6', val: '1.6' },
                  { label: 'Smiltis 1.4', val: '1.4' },
                  { label: 'Šķembas 1.7', val: '1.7' },
                  { label: 'Augsne 1.5', val: '1.5' },
                ].map((d) => (
                  <TouchableOpacity
                    key={d.val}
                    style={[s.densityChip, calcDensity === d.val && s.densityChipActive]}
                    onPress={() => {
                      haptics.light();
                      setCalcDensity(d.val);
                    }}
                  >
                    <Text
                      style={[s.densityChipText, calcDensity === d.val && s.densityChipTextActive]}
                    >
                      {d.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={[s.calcInput, { marginTop: 6 }]}
                value={calcDensity}
                onChangeText={setCalcDensity}
                keyboardType="decimal-pad"
                placeholder="1.6"
                placeholderTextColor="#9ca3af"
              />
            </View>

            {/* Result */}
            {(() => {
              const area = parseFloat(calcArea.replace(',', '.'));
              const depth = parseFloat(calcDepth.replace(',', '.'));
              const density = parseFloat(calcDensity.replace(',', '.'));
              if (
                !isNaN(area) &&
                !isNaN(depth) &&
                !isNaN(density) &&
                area > 0 &&
                depth > 0 &&
                density > 0
              ) {
                const volumeM3 = area * (depth / 100);
                const tonnes = volumeM3 * density;
                const trucks17 = Math.ceil(tonnes / 17);
                const trucks26 = Math.ceil(tonnes / 26);
                return (
                  <View style={s.calcResult}>
                    <View style={s.calcResultMain}>
                      <Text style={s.calcResultTonnes}>{tonnes.toFixed(1)} t</Text>
                      <Text style={s.calcResultLabel}>nepieciešamo materiālu</Text>
                    </View>
                    <View style={s.calcResultMeta}>
                      <Text style={s.calcResultMetaText}>≈ {volumeM3.toFixed(1)} m³</Text>
                      <Text style={s.calcResultMetaText}>
                        · {trucks17} mašīna (17t) vai {trucks26} mašīna (26t)
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={s.calcOrderBtn}
                      onPress={() => {
                        haptics.medium();
                        setCalcVisible(false);
                        router.push({
                          pathname: '/order-request-new',
                          params: { prefilledQty: String(Math.ceil(tonnes)) },
                        } as any);
                      }}
                    >
                      <Text style={s.calcOrderBtnText}>Pasūtīt {Math.ceil(tonnes)} t</Text>
                    </TouchableOpacity>
                  </View>
                );
              }
              return (
                <View style={s.calcResultEmpty}>
                  <Text style={s.calcResultEmptyText}>Ievadiet laukumu un dziļumu</Text>
                </View>
              );
            })()}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Project context banner ── */}
      {projectId ? (
        <View style={s.projectBanner}>
          <FolderOpen size={14} color="#111827" />
          <Text style={s.projectBannerText}>Pasūtījums tiks piesaistīts projektam</Text>
        </View>
      ) : null}

      {/* ── Draft resume banner ── */}
      {resumeDraft && !query && (
        <TouchableOpacity
          style={s.draftBanner}
          onPress={() =>
            router.push({
              pathname: '/order-request-new',
              params: { resumeDraft: 'true' },
            } as any)
          }
          activeOpacity={0.8}
        >
          <View style={{ flex: 1 }}>
            <Text style={s.draftSub} numberOfLines={1}>
              <Text style={{ fontWeight: '600' }}>Nepabeigts: </Text>
              {resumeDraft.materialName}, {resumeDraft.quantity}{' '}
              {UNIT_SHORT[resumeDraft.unit as keyof typeof UNIT_SHORT] ?? resumeDraft.unit}
            </Text>
          </View>
          <TouchableOpacity
            hitSlop={12}
            onPress={() => {
              AsyncStorage.removeItem(DRAFT_KEY).catch(() => {});
              setResumeDraft(null);
            }}
          >
            <X size={16} color="#6b7280" />
          </TouchableOpacity>
        </TouchableOpacity>
      )}

      {/* ── Category list ── */}
      {loading ? (
        <View style={s.skeletonWrap}>
          <SkeletonCard count={6} />
        </View>
      ) : visibleCategories.length === 0 ? (
        <View style={s.empty}>
          <Package size={36} color="#d1d5db" />
          <Text style={s.emptyTitle}>Nav rezultātu</Text>
          <Text style={s.emptySub}>Izmēģiniet citu nosaukumu</Text>
        </View>
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={visibleCategories}
          keyExtractor={(cat) => cat}
          renderItem={({ item: cat }) => {
            const staticData = categoryData[cat] ?? {
              supplierCount: 0,
              hasRecycled: false,
              minPrice: null,
            };
            const live = liveData[cat];
            return (
              <CategoryCard
                category={cat}
                hasRecycled={staticData.hasRecycled}
                supplierCount={live ? live.supplierCount : staticData.supplierCount}
                minPrice={live ? live.minPrice : staticData.minPrice}
                onPress={() => handleCategoryPress(cat)}
              />
            );
          }}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#00A878" />
          }
        />
      )}
    </ScreenContainer>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  uberHeader: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: '#fff',
  },
  uberTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#000',
    letterSpacing: -0.5,
    lineHeight: 38,
    paddingTop: 4,
  },
  topBar: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#fff',
  },
  chipScroll: {
    backgroundColor: '#fff',
    flexGrow: 0,
    flexShrink: 0,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 16,
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 100,
    backgroundColor: '#f3f4f6',
  },
  chipActive: {
    backgroundColor: '#111827',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  chipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  chipTextBlue: {
    color: '#2563eb',
  },
  livePriceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 2,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  livePriceBannerText: {
    flex: 1,
    fontSize: 11,
    color: '#1d4ed8',
    fontWeight: '500',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchBoxFocused: {
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    paddingVertical: 0,
  },
  projectBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
  },
  projectBannerText: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '500',
  },
  draftBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
  },
  draftSub: {
    fontSize: 13,
    color: '#111827',
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 108,
    gap: 10,
  },
  skeletonWrap: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  emptySub: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
  },
  // Category card
  catCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    overflow: 'hidden',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  catStrip: {
    display: 'none',
  },
  catIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  catBody: {
    flex: 1,
    gap: 2,
  },
  catNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  catName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    letterSpacing: -0.3,
  },
  catDesc: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
    marginTop: 2,
  },
  catMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  catSupplierCount: {
    fontSize: 12,
    color: '#6b7280',
  },
  catMinPrice: {
    fontSize: 12,
    color: '#000',
    fontWeight: '600',
  },
  catRight: {
    paddingLeft: 12,
  },
  recycledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  recycledText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6b7280',
  },
  // ── Calculator modal styles ────────────────────────────────────
  calcOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  calcSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 36,
    gap: 16,
  },
  calcHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  calcTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  calcSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
    marginTop: -8,
  },
  calcRow: {
    flexDirection: 'row',
    gap: 12,
  },
  calcField: {
    flex: 1,
    gap: 6,
  },
  calcLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  calcInput: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111827',
  },
  calcDensityRow: {
    gap: 6,
  },
  calcDensityChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  densityChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  densityChipActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  densityChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  densityChipTextActive: {
    color: '#fff',
  },
  calcResult: {
    backgroundColor: '#f9fafb',
    borderRadius: 14,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  calcResultMain: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  calcResultTonnes: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
  },
  calcResultLabel: {
    fontSize: 13,
    color: '#6b7280',
  },
  calcResultMeta: {
    gap: 2,
  },
  calcResultMetaText: {
    fontSize: 12,
    color: '#6b7280',
  },
  calcOrderBtn: {
    backgroundColor: '#111827',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  calcOrderBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  calcResultEmpty: {
    padding: 16,
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 14,
  },
  calcResultEmptyText: {
    fontSize: 13,
    color: '#9ca3af',
  },
});

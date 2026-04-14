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
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
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
      activeOpacity={0.8}
    >
      {/* Left accent strip */}
      <View style={[s.catStrip, { backgroundColor: meta.accent }]} />

      {/* Icon */}
      <View style={[s.catIconWrap, { backgroundColor: meta.bg }]}>
        <Icon size={24} color={meta.accent} strokeWidth={1.8} />
      </View>

      {/* Info */}
      <View style={s.catBody}>
        <View style={s.catNameRow}>
          <Text style={s.catName}>{CATEGORY_LABELS[category]}</Text>
          {hasRecycled && (
            <View style={s.recycledBadge}>
              <Leaf size={11} color="#16a34a" fill="#16a34a" />
              <Text style={s.recycledText}>Pārstrādāts</Text>
            </View>
          )}
        </View>
        {description ? (
          <Text style={s.catDesc} numberOfLines={2}>
            {description}
          </Text>
        ) : null}
        <View style={s.catMeta}>
          {supplierCount > 0 && (
            <Text style={s.catSupplierCount}>
              {supplierCount} piegādātāj{supplierCount === 1 ? 's' : 'i'}
            </Text>
          )}
          {minPrice != null && <Text style={s.catMinPrice}>no €{minPrice.toFixed(2)}/t</Text>}
        </View>
      </View>

      {/* Arrow */}
      <View style={s.catRight}>
        <ChevronRight size={16} color="#d1d5db" />
      </View>
    </TouchableOpacity>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────

export default function CatalogScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const params = useLocalSearchParams<{ projectId?: string }>();
  const projectId = params.projectId;

  const [allMaterials, setAllMaterials] = useState<ApiMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
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
    <ScreenContainer bg="#f9fafb">
      {/* ── Search bar ── */}
      <View style={s.topBar}>
        <View style={s.searchBox}>
          <Search size={16} color="#9ca3af" />
          <TextInput
            style={s.searchInput}
            placeholder="Meklēt kategoriju..."
            placeholderTextColor="#9ca3af"
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
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
          style={[s.chip, filterMode === 'RECYCLED' && s.chipActiveGreen]}
          onPress={() => {
            haptics.light();
            setFilterMode('RECYCLED');
          }}
          activeOpacity={0.8}
        >
          <Recycle size={13} color={filterMode === 'RECYCLED' ? '#fff' : '#16a34a'} />
          <Text
            style={[s.chipText, filterMode === 'RECYCLED' ? s.chipTextActive : s.chipTextGreen]}
          >
            Reciklēti
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.chip, nearMe && s.chipActiveBlue]}
          onPress={handleNearMeToggle}
          activeOpacity={0.8}
          disabled={nearMeLoading}
        >
          <MapPin size={13} color={nearMe ? '#fff' : '#2563eb'} />
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
          <Calculator size={13} color="#7c3aed" />
          <Text style={[s.chipText, { color: '#7c3aed' }]}>Kalkulators</Text>
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
              <Calculator size={16} color="#7c3aed" />
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
          <FolderOpen size={14} color="#1d4ed8" />
          <Text style={s.projectBannerText}>Pasūtījums tiks piesaistīts projektam</Text>
        </View>
      ) : null}

      {/* ── Draft resume banner ── */}
      {resumeDraft && !query && (
        <View style={s.draftBanner}>
          <View style={{ flex: 1 }}>
            <Text style={s.draftTitle}>Nepabeigts pasūtījums</Text>
            <Text style={s.draftSub} numberOfLines={1}>
              {resumeDraft.materialName} — {resumeDraft.quantity}{' '}
              {UNIT_SHORT[resumeDraft.unit as keyof typeof UNIT_SHORT] ?? resumeDraft.unit}
            </Text>
          </View>
          <TouchableOpacity
            style={s.draftBtn}
            onPress={() =>
              router.push({
                pathname: '/order-request-new',
                params: { resumeDraft: 'true' },
              } as any)
            }
            activeOpacity={0.8}
          >
            <Text style={s.draftBtnText}>Turpināt</Text>
          </TouchableOpacity>
          <TouchableOpacity
            hitSlop={8}
            onPress={() => {
              AsyncStorage.removeItem(DRAFT_KEY).catch(() => {});
              setResumeDraft(null);
            }}
          >
            <X size={16} color="#6b7280" />
          </TouchableOpacity>
        </View>
      )}

      {/* ── Live pricing banner ── */}
      {(savedDelivery || nearMeCoords) && !loading && (
        <View style={s.livePriceBanner}>
          <MapPin size={12} color="#2563eb" />
          {livePricesLoading ? (
            <Text style={s.livePriceBannerText}>Aprēķina cenas jūsu adresei…</Text>
          ) : (
            <Text style={s.livePriceBannerText} numberOfLines={1}>
              {nearMe ? 'Cenas jūsu tuvumā' : `Cenas adresei: ${savedDelivery?.address ?? ''}`}
            </Text>
          )}
        </View>
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
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#111827" />
          }
        />
      )}
    </ScreenContainer>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  topBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    backgroundColor: '#f9fafb',
  },
  chipScroll: {
    paddingTop: 8,
    paddingBottom: 2,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  chipActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  chipActiveGreen: {
    backgroundColor: '#16a34a',
    borderColor: '#16a34a',
  },
  chipActiveBlue: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  chipTextActive: {
    color: '#fff',
  },
  chipTextGreen: {
    color: '#16a34a',
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
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
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
    gap: 6,
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  projectBannerText: {
    fontSize: 12,
    color: '#1d4ed8',
    fontWeight: '500',
  },
  draftBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#f0fdf4',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  draftTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#166534',
  },
  draftSub: {
    fontSize: 12,
    color: '#4b5563',
    marginTop: 1,
  },
  draftBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#16a34a',
    borderRadius: 8,
  },
  draftBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
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
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    minHeight: 88,
  },
  catStrip: {
    width: 4,
    alignSelf: 'stretch',
  },
  catIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
    marginRight: 12,
  },
  catBody: {
    flex: 1,
    paddingVertical: 12,
    gap: 2,
  },
  catNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  catName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.2,
  },
  catDesc: {
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 17,
    marginTop: 1,
  },
  catMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 3,
  },
  catSupplierCount: {
    fontSize: 11,
    color: '#9ca3af',
    fontWeight: '500',
  },
  catMinPrice: {
    fontSize: 11,
    color: '#00A878',
    fontWeight: '600',
  },

  catRight: {
    paddingRight: 14,
    paddingLeft: 8,
  },
  recycledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  recycledText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#16a34a',
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
    backgroundColor: '#7c3aed',
    borderColor: '#7c3aed',
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
    backgroundColor: '#f5f3ff',
    borderRadius: 14,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#ede9fe',
  },
  calcResultMain: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  calcResultTonnes: {
    fontSize: 28,
    fontWeight: '800',
    color: '#7c3aed',
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
    backgroundColor: '#7c3aed',
    borderRadius: 12,
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

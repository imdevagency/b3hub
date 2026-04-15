/**
 * (driver)/carrier-settings.tsx
 *
 * Driver: manage skip-hire pricing, service zones, and blocked availability dates.
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import {
  api,
  type CarrierPricing,
  type CarrierServiceZone,
  type CarrierBlockedDate,
  type SkipSize,
} from '@/lib/api';
import { Trash2, Plus, Check, X } from 'lucide-react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/text';
import { colors, spacing, radius, fontSizes } from '@/lib/tokens';

// ─── Constants ────────────────────────────────────────────────────────────

type Tab = 'pricing' | 'zones' | 'availability';

const SKIP_SIZES: { value: SkipSize; label: string; volume: string }[] = [
  { value: 'MINI', label: 'Mini', volume: '2 m³' },
  { value: 'MIDI', label: 'Midi', volume: '4 m³' },
  { value: 'BUILDERS', label: 'Builders', volume: '6 m³' },
  { value: 'LARGE', label: 'Liels', volume: '8 m³' },
];

// ─── Screen ───────────────────────────────────────────────────────────────

export default function CarrierSettingsScreen() {
  const { token } = useAuth();
  const [tab, setTab] = useState<Tab>('pricing');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Pricing
  const [pricing, setPricing] = useState<CarrierPricing[]>([]);
  const [priceInputs, setPriceInputs] = useState<Partial<Record<SkipSize, string>>>({});
  const [savingSize, setSavingSize] = useState<SkipSize | null>(null);

  // Zones
  const [zones, setZones] = useState<CarrierServiceZone[]>([]);
  const [newCity, setNewCity] = useState('');
  const [newPostcode, setNewPostcode] = useState('');
  const [newSurcharge, setNewSurcharge] = useState('');
  const [addingZone, setAddingZone] = useState(false);
  const [showAddZone, setShowAddZone] = useState(false);

  // Availability
  const [blockedDates, setBlockedDates] = useState<CarrierBlockedDate[]>([]);
  const [newDate, setNewDate] = useState('');
  const [newReason, setNewReason] = useState('');
  const [blockingDate, setBlockingDate] = useState(false);

  const load = useCallback(
    async (silent = false) => {
      if (!token) return;
      if (!silent) setLoading(true);
      try {
        const [p, z, d] = await Promise.all([
          api.carrierSettings.pricing.get(token).catch(() => [] as CarrierPricing[]),
          api.carrierSettings.zones.get(token).catch(() => [] as CarrierServiceZone[]),
          api.carrierSettings.availability.get(token).catch(() => [] as CarrierBlockedDate[]),
        ]);
        setPricing(p);
        setZones(z);
        setBlockedDates(d);
      } catch {
        // Non-fatal
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token],
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const priceMap = Object.fromEntries(pricing.map((r) => [r.skipSize, r]));

  const handleSavePrice = async (size: SkipSize) => {
    const raw = priceInputs[size];
    const price = parseFloat(raw ?? '');
    if (isNaN(price) || price < 0) return;
    if (!token) return;
    setSavingSize(size);
    try {
      await api.carrierSettings.pricing.set(token, size, price);
      setPriceInputs((prev) => {
        const n = { ...prev };
        delete n[size];
        return n;
      });
      await load(true);
    } catch {
      Alert.alert('Kļūda', 'Neizdevās saglabāt cenu');
    } finally {
      setSavingSize(null);
    }
  };

  const handleDeletePrice = async (size: SkipSize) => {
    if (!token) return;
    Alert.alert('Dzēst cenu', `Dzēst cenu izmēram ${size}?`, [
      { text: 'Atcelt', style: 'cancel' },
      {
        text: 'Dzēst',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.carrierSettings.pricing.delete(token, size);
            load(true);
          } catch {
            Alert.alert('Kļūda', 'Neizdevās dzēst cenu');
          }
        },
      },
    ]);
  };

  const handleAddZone = async () => {
    if (!token || !newCity.trim()) return;
    setAddingZone(true);
    try {
      const surcharge = newSurcharge ? parseFloat(newSurcharge) : undefined;
      await api.carrierSettings.zones.add(token, {
        city: newCity.trim(),
        postcode: newPostcode.trim() || undefined,
        surcharge: surcharge !== undefined && !isNaN(surcharge) ? surcharge : undefined,
      });
      setNewCity('');
      setNewPostcode('');
      setNewSurcharge('');
      setShowAddZone(false);
      load(true);
    } catch {
      Alert.alert('Kļūda', 'Neizdevās pievienot zonu');
    } finally {
      setAddingZone(false);
    }
  };

  const handleDeleteZone = (id: string, city: string) => {
    if (!token) return;
    Alert.alert('Dzēst zonu', `Dzēst "${city}"?`, [
      { text: 'Atcelt', style: 'cancel' },
      {
        text: 'Dzēst',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.carrierSettings.zones.delete(token, id);
            load(true);
          } catch {
            Alert.alert('Kļūda', 'Neizdevās dzēst zonu');
          }
        },
      },
    ]);
  };

  const handleBlockDate = async () => {
    if (!token || !newDate.trim()) return;
    // Validate YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate.trim())) {
      Alert.alert('Nepareizs formāts', 'Ievadiet datumu formātā GGGG-MM-DD');
      return;
    }
    setBlockingDate(true);
    try {
      await api.carrierSettings.availability.block(
        token,
        newDate.trim(),
        newReason.trim() || undefined,
      );
      setNewDate('');
      setNewReason('');
      load(true);
    } catch {
      Alert.alert('Kļūda', 'Neizdevās bloķēt datumu');
    } finally {
      setBlockingDate(false);
    }
  };

  const handleUnblockDate = (id: string, date: string) => {
    if (!token) return;
    Alert.alert('Atbloķēt datumu', `Atjaunot pieejamību ${date}?`, [
      { text: 'Atcelt', style: 'cancel' },
      {
        text: 'Atbloķēt',
        onPress: async () => {
          try {
            await api.carrierSettings.availability.unblock(token, id);
            load(true);
          } catch {
            Alert.alert('Kļūda', 'Neizdevās atbloķēt datumu');
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <ScreenContainer bg="#f4f5f7">
        <ScreenHeader title="Pārvadātāja iestatījumi" />
        <SkeletonCard count={3} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer bg="#f4f5f7">
      <ScreenHeader title="Pārvadātāja iestatījumi" />

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {(['pricing', 'zones', 'availability'] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
            activeOpacity={0.75}
          >
            <Text style={[styles.tabLabel, tab === t && styles.tabLabelActive]}>
              {t === 'pricing' ? 'Cenas' : t === 'zones' ? 'Zonas' : 'Pieejamība'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load(true);
            }}
          />
        }
        contentContainerStyle={styles.scroll}
      >
        {/* ── PRICING TAB ── */}
        {tab === 'pricing' && (
          <View style={styles.section}>
            <Text style={styles.sectionNote}>
              Iestatiet cenu (€/dienā) katram konteinera izmēram.
            </Text>
            {SKIP_SIZES.map(({ value, label, volume }) => {
              const existing = priceMap[value];
              const editVal = priceInputs[value];
              const displayVal =
                editVal !== undefined ? editVal : existing ? String(existing.price) : '';
              const isDirty = editVal !== undefined;
              const isSaving = savingSize === value;

              return (
                <View key={value} style={styles.pricingRow}>
                  <View style={styles.pricingInfo}>
                    <Text style={styles.pricingLabel}>{label}</Text>
                    <Text style={styles.pricingMeta}>{volume}</Text>
                  </View>
                  <View style={styles.pricingInputRow}>
                    <TextInput
                      style={styles.priceInput}
                      value={displayVal}
                      onChangeText={(v) => setPriceInputs((prev) => ({ ...prev, [value]: v }))}
                      keyboardType="decimal-pad"
                      placeholder="—"
                      placeholderTextColor={colors.textMuted}
                    />
                    <Text style={styles.pricingCurrency}>€</Text>
                    {isDirty && (
                      <TouchableOpacity
                        style={styles.saveIconBtn}
                        onPress={() => handleSavePrice(value)}
                        disabled={isSaving}
                        activeOpacity={0.75}
                      >
                        <Check size={16} color="#fff" />
                      </TouchableOpacity>
                    )}
                    {existing && !isDirty && (
                      <TouchableOpacity
                        style={styles.deleteIconBtn}
                        onPress={() => handleDeletePrice(value)}
                        activeOpacity={0.75}
                      >
                        <Trash2 size={14} color={colors.textMuted} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ── ZONES TAB ── */}
        {tab === 'zones' && (
          <View style={styles.section}>
            <Text style={styles.sectionNote}>Norādiet pilsētas, kurās sniedzat pakalpojumus.</Text>

            {showAddZone ? (
              <View style={styles.addForm}>
                <TextInput
                  style={styles.formInput}
                  placeholder="Pilsēta (piem. Rīga)"
                  placeholderTextColor={colors.textMuted}
                  value={newCity}
                  onChangeText={setNewCity}
                />
                <TextInput
                  style={styles.formInput}
                  placeholder="Pasta indekss (neobligāti)"
                  placeholderTextColor={colors.textMuted}
                  value={newPostcode}
                  onChangeText={setNewPostcode}
                />
                <TextInput
                  style={styles.formInput}
                  placeholder="Papildu maksa € (neobligāti)"
                  placeholderTextColor={colors.textMuted}
                  value={newSurcharge}
                  onChangeText={setNewSurcharge}
                  keyboardType="decimal-pad"
                />
                <View style={styles.formActions}>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => {
                      setShowAddZone(false);
                      setNewCity('');
                      setNewPostcode('');
                      setNewSurcharge('');
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.cancelBtnText}>Atcelt</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.saveBtn,
                      (!newCity.trim() || addingZone) && styles.saveBtnDisabled,
                    ]}
                    onPress={handleAddZone}
                    disabled={!newCity.trim() || addingZone}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.saveBtnText}>
                      {addingZone ? 'Pievieno...' : 'Saglabāt'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.addRowBtn}
                onPress={() => setShowAddZone(true)}
                activeOpacity={0.75}
              >
                <Plus size={16} color={colors.textMuted} />
                <Text style={styles.addRowBtnText}>Pievienot zonu</Text>
              </TouchableOpacity>
            )}

            <View style={styles.card}>
              {zones.length === 0 ? (
                <Text style={styles.emptyText}>Nav pievienotu zonu</Text>
              ) : (
                zones.map((zone, idx) => (
                  <React.Fragment key={zone.id}>
                    {idx > 0 && <View style={styles.divider} />}
                    <View style={styles.zoneRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.zoneCity}>{zone.city}</Text>
                        {zone.postcode ? (
                          <Text style={styles.zoneMeta}>Indekss: {zone.postcode}</Text>
                        ) : null}
                        {zone.surcharge ? (
                          <Text style={styles.zoneMeta}>Papildu maksa: €{zone.surcharge}</Text>
                        ) : null}
                      </View>
                      <TouchableOpacity
                        onPress={() => handleDeleteZone(zone.id, zone.city)}
                        hitSlop={8}
                        activeOpacity={0.7}
                      >
                        <Trash2 size={16} color={colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                  </React.Fragment>
                ))
              )}
            </View>
          </View>
        )}

        {/* ── AVAILABILITY TAB ── */}
        {tab === 'availability' && (
          <View style={styles.section}>
            <Text style={styles.sectionNote}>Bloķējiet datumus, kad neesat pieejams piegādēm.</Text>

            <View style={styles.addForm}>
              <TextInput
                style={styles.formInput}
                placeholder="Datums GGGG-MM-DD"
                placeholderTextColor={colors.textMuted}
                value={newDate}
                onChangeText={setNewDate}
              />
              <TextInput
                style={styles.formInput}
                placeholder="Iemesls (neobligāti)"
                placeholderTextColor={colors.textMuted}
                value={newReason}
                onChangeText={setNewReason}
              />
              <TouchableOpacity
                style={[
                  styles.saveBtn,
                  (!newDate.trim() || blockingDate) && styles.saveBtnDisabled,
                ]}
                onPress={handleBlockDate}
                disabled={!newDate.trim() || blockingDate}
                activeOpacity={0.75}
              >
                <Text style={styles.saveBtnText}>
                  {blockingDate ? 'Bloķē...' : 'Bloķēt datumu'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.card}>
              {blockedDates.length === 0 ? (
                <Text style={styles.emptyText}>Nav bloķētu datumu</Text>
              ) : (
                blockedDates
                  .sort((a, b) => a.date.localeCompare(b.date))
                  .map((d, idx) => (
                    <React.Fragment key={d.id}>
                      {idx > 0 && <View style={styles.divider} />}
                      <View style={styles.dateRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.dateText}>{d.date}</Text>
                          {d.reason ? <Text style={styles.dateMeta}>{d.reason}</Text> : null}
                        </View>
                        <TouchableOpacity
                          onPress={() => handleUnblockDate(d.id, d.date)}
                          hitSlop={8}
                          activeOpacity={0.7}
                        >
                          <X size={16} color={colors.textMuted} />
                        </TouchableOpacity>
                      </View>
                    </React.Fragment>
                  ))
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing.xl,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    gap: spacing.xs,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radius.lg,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#111827',
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  tabLabelActive: {
    color: '#fff',
  },
  section: {
    padding: spacing.base,
    gap: 12,
  },
  sectionNote: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  pricingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  pricingInfo: {
    flex: 1,
    gap: 2,
  },
  pricingLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  pricingMeta: {
    fontSize: 12,
    color: colors.textMuted,
  },
  pricingInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  priceInput: {
    width: 72,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'right',
    backgroundColor: '#f9fafb',
  },
  pricingCurrency: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '600',
  },
  saveIconBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteIconBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addForm: {
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
    gap: 10,
  },
  addRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  addRowBtnText: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '600',
  },
  formInput: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: fontSizes.sm,
    color: colors.textPrimary,
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  cancelBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelBtnText: {
    fontSize: fontSizes.sm,
    color: colors.textMuted,
  },
  saveBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: '#111827',
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveBtnText: {
    fontSize: fontSizes.sm,
    color: '#fff',
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    paddingVertical: 20,
  },
  divider: {
    height: 1,
    backgroundColor: '#f3f4f6',
  },
  zoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  zoneCity: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  zoneMeta: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  dateText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    fontVariant: ['tabular-nums'],
  },
  dateMeta: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
});

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Text,
} from 'react-native';
import { useAuth } from '@/lib/auth-context';
import {
  api,
  type CarrierPricing,
  type CarrierServiceZone,
  type CarrierBlockedDate,
  type SkipSize,
} from '@/lib/api';
import { Trash2, Plus, Calendar, MapPin, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { haptics } from '@/lib/haptics';
import { colors } from '@/lib/theme';
import { format } from 'date-fns';
import { lv } from 'date-fns/locale';

// ─── Constants ────────────────────────────────────────────────────────────

type Tab = 'pricing' | 'zones' | 'availability';

const SKIP_SIZES: { value: SkipSize; label: string; volume: string }[] = [
  { value: 'MINI', label: 'Mini', volume: 'Līdz 2 m³' },
  { value: 'MIDI', label: 'Midi', volume: 'Līdz 4 m³' },
  { value: 'BUILDERS', label: 'Builders', volume: 'Līdz 6 m³' },
  { value: 'LARGE', label: 'Liels', volume: 'Līdz 8 m³' },
];

// ─── Calendar helpers ─────────────────────────────────────────────────────

const MONTHS_LV = [
  'Janvāris',
  'Februāris',
  'Marts',
  'Aprīlis',
  'Maijs',
  'Jūnijs',
  'Jūlijs',
  'Augusts',
  'Septembris',
  'Oktobris',
  'Novembris',
  'Decembris',
];
const DOW_LV = ['P', 'O', 'T', 'C', 'Pk', 'S', 'Sv'];

function buildCalendarRows(year: number, month: number): (number | null)[][] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = (firstDay.getDay() + 6) % 7; // Mon = 0
  const rows: (number | null)[][] = [];
  let row: (number | null)[] = Array(startDow).fill(null);
  for (let d = 1; d <= lastDay.getDate(); d++) {
    row.push(d);
    if (row.length === 7) {
      rows.push(row);
      row = [];
    }
  }
  if (row.length > 0) {
    while (row.length < 7) row.push(null);
    rows.push(row);
  }
  return rows;
}

export default function CarrierSettingsScreen() {
  const { token } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('pricing');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Pricing
  const [pricing, setPricing] = useState<CarrierPricing[]>([]);
  const [localPrices, setLocalPrices] = useState<Record<SkipSize, string>>(
    {} as Record<SkipSize, string>,
  );
  const [savingSize, setSavingSize] = useState<SkipSize | null>(null);

  // Zones
  const [zones, setZones] = useState<CarrierServiceZone[]>([]);
  const [newCity, setNewCity] = useState('');
  const [addingZone, setAddingZone] = useState(false);
  const [showAddZone, setShowAddZone] = useState(false);

  // Availability
  const [blockedDates, setBlockedDates] = useState<CarrierBlockedDate[]>([]);
  const [newDate, setNewDate] = useState('');
  const [blockingDate, setBlockingDate] = useState(false);
  const [showAddDate, setShowAddDate] = useState(false);
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonthIdx, setViewMonthIdx] = useState(() => new Date().getMonth());

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

        // Sync local prices
        const priceDict: Record<string, string> = {};
        p.forEach((item) => (priceDict[item.skipSize] = String(item.price)));
        setLocalPrices(priceDict as Record<SkipSize, string>);
      } catch {
        // Non-fatal
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token],
  );

  useEffect(() => {
    load();
  }, [load]);

  const handleSavePrice = async (size: SkipSize) => {
    const raw = localPrices[size];
    if (!raw) return; // If empty, we could delete it, but let's ignore for now.
    const price = parseFloat(raw);
    if (isNaN(price) || price < 0) return;

    // Skip if unchanged
    const existing = pricing.find((p) => p.skipSize === size);
    if (existing && existing.price === price) return;

    if (!token) return;
    setSavingSize(size);
    try {
      await api.carrierSettings.pricing.set(token, size, price);
      await load(true);
      haptics.success();
      toast.success('Cena saglabāta');
    } catch {
      haptics.error();
      toast.error('Neizdevās saglabāt cenu');
    } finally {
      setSavingSize(null);
    }
  };

  const handleAddZone = async () => {
    if (!token || !newCity.trim()) return;
    setAddingZone(true);
    try {
      // Very simplified: just ask for city/region in one line
      await api.carrierSettings.zones.add(token, {
        city: newCity.trim(),
      });
      setNewCity('');
      setShowAddZone(false);
      load(true);
      haptics.success();
    } catch {
      haptics.error();
      toast.error('Neizdevās pievienot zonu');
    } finally {
      setAddingZone(false);
    }
  };

  const handleDeleteZone = (id: string, city: string) => {
    if (!token) return;
    Alert.alert('Dzēst zonu', `Vai tiešām vēlaties dzēst "${city}"?`, [
      { text: 'Atcelt', style: 'cancel' },
      {
        text: 'Dzēst',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.carrierSettings.zones.delete(token, id);
            load(true);
            haptics.light();
          } catch {
            toast.error('Neizdevās dzēst zonu');
          }
        },
      },
    ]);
  };

  const handleBlockDate = async () => {
    if (!token || !newDate) return;
    setBlockingDate(true);
    try {
      await api.carrierSettings.availability.block(token, newDate);
      setNewDate('');
      setShowAddDate(false);
      load(true);
      haptics.success();
    } catch {
      haptics.error();
      toast.error('Neizdevās bloķēt datumu');
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
        style: 'default',
        onPress: async () => {
          try {
            await api.carrierSettings.availability.unblock(token, id);
            load(true);
            haptics.light();
          } catch {
            toast.error('Neizdevās atbloķēt datumu');
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <ScreenContainer bg="#ffffff">
        <ScreenHeader title="" />
        <View className="px-5 pt-2 pb-4">
          <Text
            style={{
              fontSize: 32,
              fontWeight: '800',
              color: colors.textPrimary,
              letterSpacing: -0.8,
            }}
          >
            Pārvadātājs
          </Text>
        </View>
        <View className="px-5">
          <SkeletonCard count={3} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer bg="#ffffff" topBg="#ffffff">
      <ScreenHeader title="" />

      <View className="px-5 pt-1 pb-4">
        <Text
          style={{
            fontSize: 32,
            fontWeight: '800',
            color: colors.textPrimary,
            letterSpacing: -0.8,
          }}
        >
          Iestatījumi
        </Text>
        <Text className="text-gray-500 font-medium mt-1 mb-2" style={{ fontSize: 15 }}>
          Pārvaldi savas cenas, zonas un pieejamību.
        </Text>
      </View>

      {/* Minimalist Segmented Control */}
      <View className="px-5 mb-6">
        <View className="flex-row bg-gray-100/80 p-1 rounded-2xl">
          {(
            [
              { key: 'pricing', label: 'Cenas' },
              { key: 'zones', label: 'Zonas' },
              { key: 'availability', label: 'Brīvdienas' },
            ] as const
          ).map((s) => {
            const active = tab === s.key;
            return (
              <TouchableOpacity
                key={s.key}
                className={`flex-1 items-center justify-center py-2.5 rounded-xl ${active ? 'bg-white shadow-sm' : ''}`}
                onPress={() => {
                  haptics.light();
                  setTab(s.key as Tab);
                }}
                activeOpacity={0.8}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: active ? '600' : '500',
                    color: active ? colors.textPrimary : colors.textMuted,
                  }}
                >
                  {s.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load(true);
            }}
            tintColor="#111827"
          />
        }
      >
        {/* ── PRICING TAB ── */}
        {tab === 'pricing' && (
          <View className="px-5">
            <View className="bg-gray-50/50 border border-gray-100 rounded-3xl p-2">
              {SKIP_SIZES.map(({ value, label, volume }, i) => {
                const isSaving = savingSize === value;
                return (
                  <View
                    key={value}
                    className={`flex-row items-center justify-between p-4 ${i !== SKIP_SIZES.length - 1 ? 'border-b border-gray-100' : ''}`}
                  >
                    <View>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary }}>
                        {label}
                      </Text>
                      <Text
                        style={{
                          fontSize: 13,
                          color: colors.textMuted,
                          fontWeight: '500',
                          marginTop: 2,
                        }}
                      >
                        {volume}
                      </Text>
                    </View>
                    <View className="flex-row items-center bg-white border border-gray-200 rounded-2xl pl-4 pr-3 h-12 min-w-[110px]">
                      <TextInput
                        className="flex-1 text-right text-gray-900 font-bold"
                        style={{ fontSize: 17 }}
                        value={localPrices[value] || ''}
                        onChangeText={(txt) =>
                          setLocalPrices((prev) => ({ ...prev, [value]: txt }))
                        }
                        onBlur={() => handleSavePrice(value)}
                        keyboardType="decimal-pad"
                        placeholder="0"
                        placeholderTextColor="#cbd5e1"
                      />
                      <Text className="text-gray-400 font-semibold ml-1.5" style={{ fontSize: 16 }}>
                        €
                      </Text>
                      {isSaving && (
                        <View className="absolute right-3 bg-white pl-2">
                          <ActivityIndicator size="small" color="#111827" />
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
            <Text className="text-xs text-gray-400 text-center mt-4">
              Dienas nomas cena (€). Automātiski saglabājas, kad noņemat kursoru no lauka.
            </Text>
          </View>
        )}

        {/* ── ZONES TAB ── */}
        {tab === 'zones' && (
          <View className="px-5">
            {showAddZone ? (
              <View className="bg-gray-50/80 border border-gray-100 rounded-3xl p-4 mb-4">
                <TextInput
                  className="bg-white border border-gray-200 rounded-2xl px-4 text-gray-900 font-medium mb-3"
                  style={{ height: 50, fontSize: 16 }}
                  placeholder="Pilsēta vai Reģions"
                  placeholderTextColor="#9ca3af"
                  value={newCity}
                  onChangeText={setNewCity}
                  autoFocus
                  onSubmitEditing={handleAddZone}
                  returnKeyType="done"
                />
                <View className="flex-row gap-2">
                  <TouchableOpacity
                    className="flex-1 bg-white border border-gray-200 rounded-xl py-3 items-center"
                    onPress={() => setShowAddZone(false)}
                  >
                    <Text className="text-gray-600 font-semibold">Atcelt</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className={`flex-1 rounded-xl py-3 items-center ${!newCity.trim() ? 'bg-gray-200' : 'bg-gray-900'}`}
                    onPress={handleAddZone}
                    disabled={!newCity.trim() || addingZone}
                  >
                    {addingZone ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text
                        className={`font-semibold ${!newCity.trim() ? 'text-gray-400' : 'text-white'}`}
                      >
                        Pievienot
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                className="flex-row items-center bg-gray-50 border border-gray-100 rounded-2xl p-4 mb-4"
                onPress={() => setShowAddZone(true)}
              >
                <View className="w-10 h-10 rounded-full bg-white items-center justify-center mr-3 shadow-sm shadow-gray-100">
                  <Plus size={20} color="#111827" />
                </View>
                <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary }}>
                  Pievienot reģionu
                </Text>
              </TouchableOpacity>
            )}

            <View className="bg-white border border-gray-100 rounded-3xl overflow-hidden">
              {zones.length === 0 && !showAddZone && (
                <View className="py-8 items-center">
                  <MapPin size={32} color="#e5e7eb" className="mb-2" />
                  <Text className="text-gray-400 font-medium">Nav pievienotu reģionu</Text>
                </View>
              )}
              {zones.map((zone, idx) => (
                <View
                  key={zone.id}
                  className={`flex-row items-center justify-between p-4 ${idx !== zones.length - 1 ? 'border-b border-gray-50' : ''}`}
                >
                  <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary }}>
                    {zone.city}
                  </Text>
                  <TouchableOpacity
                    className="p-2"
                    onPress={() => handleDeleteZone(zone.id, zone.city)}
                  >
                    <Text className="text-red-500 font-medium">Dzēst</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── AVAILABILITY TAB ── */}
        {tab === 'availability' && (
          <View className="px-5">
            {showAddDate ? (
              <View className="bg-orange-50 border border-orange-100 rounded-3xl p-4 mb-4">
                <Text className="text-sm text-orange-800 font-medium mb-3">
                  Atzīmējiet dienu kā nepieejamu.
                </Text>

                {/* Month navigation */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 10,
                  }}
                >
                  <TouchableOpacity
                    style={{ padding: 8 }}
                    onPress={() => {
                      if (viewMonthIdx === 0) {
                        setViewMonthIdx(11);
                        setViewYear((y) => y - 1);
                      } else setViewMonthIdx((m) => m - 1);
                    }}
                  >
                    <ChevronLeft size={20} color="#9a3412" />
                  </TouchableOpacity>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#9a3412' }}>
                    {MONTHS_LV[viewMonthIdx]} {viewYear}
                  </Text>
                  <TouchableOpacity
                    style={{ padding: 8 }}
                    onPress={() => {
                      if (viewMonthIdx === 11) {
                        setViewMonthIdx(0);
                        setViewYear((y) => y + 1);
                      } else setViewMonthIdx((m) => m + 1);
                    }}
                  >
                    <ChevronRight size={20} color="#9a3412" />
                  </TouchableOpacity>
                </View>

                {/* Day-of-week headers */}
                <View style={{ flexDirection: 'row', marginBottom: 4 }}>
                  {DOW_LV.map((d) => (
                    <View key={d} style={{ flex: 1, alignItems: 'center' }}>
                      <Text style={{ fontSize: 11, fontWeight: '600', color: '#f97316' }}>{d}</Text>
                    </View>
                  ))}
                </View>

                {/* Day grid */}
                {buildCalendarRows(viewYear, viewMonthIdx).map((week, wi) => (
                  <View key={wi} style={{ flexDirection: 'row', marginBottom: 2 }}>
                    {week.map((day, di) => {
                      if (!day) return <View key={di} style={{ flex: 1, height: 36 }} />;
                      const pad = (n: number) => String(n).padStart(2, '0');
                      const dateStr = `${viewYear}-${pad(viewMonthIdx + 1)}-${pad(day)}`;
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const dayDate = new Date(viewYear, viewMonthIdx, day);
                      const isPast = dayDate < today;
                      const isBlocked = blockedDates.some((b) => b.date === dateStr);
                      const isSelected = newDate === dateStr;
                      return (
                        <TouchableOpacity
                          key={di}
                          style={{
                            flex: 1,
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: 36,
                            margin: 2,
                            borderRadius: 8,
                            backgroundColor: isSelected
                              ? '#f97316'
                              : isBlocked
                                ? '#fee2e2'
                                : 'transparent',
                            opacity: isPast ? 0.3 : 1,
                          }}
                          disabled={isPast || isBlocked}
                          onPress={() => setNewDate(dateStr)}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={{
                              fontSize: 14,
                              fontWeight: isSelected ? '700' : '500',
                              color: isSelected ? '#ffffff' : isBlocked ? '#dc2626' : '#9a3412',
                            }}
                          >
                            {day}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}

                {/* Actions */}
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      backgroundColor: '#ffffff',
                      borderWidth: 1,
                      borderColor: '#fed7aa',
                      borderRadius: 12,
                      paddingVertical: 12,
                      alignItems: 'center',
                    }}
                    onPress={() => {
                      setShowAddDate(false);
                      setNewDate('');
                    }}
                  >
                    <Text style={{ color: '#9a3412', fontWeight: '600' }}>Atcelt</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      backgroundColor: newDate ? '#f97316' : '#fed7aa',
                      borderRadius: 12,
                      paddingVertical: 12,
                      alignItems: 'center',
                    }}
                    onPress={handleBlockDate}
                    disabled={!newDate || blockingDate}
                  >
                    {blockingDate ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={{ color: newDate ? '#ffffff' : '#fdba74', fontWeight: '600' }}>
                        {newDate
                          ? `Bloķēt ${format(new Date(newDate), 'd. MMM', { locale: lv })}`
                          : 'Izvēlieties datumu'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                className="flex-row items-center bg-orange-50 border border-orange-100 rounded-2xl p-4 mb-4"
                onPress={() => setShowAddDate(true)}
              >
                <View className="w-10 h-10 rounded-full bg-white items-center justify-center mr-3 shadow-sm shadow-orange-100">
                  <Calendar size={20} color="#f97316" />
                </View>
                <View>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: '#9a3412' }}>
                    Atzīmēt brīvdienu
                  </Text>
                  <Text style={{ fontSize: 13, fontWeight: '500', color: '#f97316', marginTop: 1 }}>
                    Izvēlieties datumu
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            <View className="bg-white border border-gray-100 rounded-3xl overflow-hidden">
              {blockedDates.length === 0 && !showAddDate && (
                <View className="py-8 items-center">
                  <Calendar size={32} color="#e5e7eb" className="mb-2" />
                  <Text className="text-gray-400 font-medium">Nav ieplānotu brīvdienu</Text>
                </View>
              )}
              {blockedDates
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((d, idx) => (
                  <View
                    key={d.id}
                    className={`flex-row items-center justify-between p-4 ${idx !== blockedDates.length - 1 ? 'border-b border-gray-50' : ''}`}
                  >
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: '700',
                        color: colors.textPrimary,
                        fontVariant: ['tabular-nums'],
                      }}
                    >
                      {d.date}
                    </Text>
                    <TouchableOpacity
                      className="p-2"
                      onPress={() => handleUnblockDate(d.id, d.date)}
                    >
                      <Text className="text-gray-400 font-medium">Atbloķēt</Text>
                    </TouchableOpacity>
                  </View>
                ))}
            </View>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

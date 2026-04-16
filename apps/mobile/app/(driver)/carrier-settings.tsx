import React, { useCallback, useState } from 'react';
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
import { haptics } from '@/lib/haptics';

// ─── Constants ────────────────────────────────────────────────────────────

type Tab = 'pricing' | 'zones' | 'availability';

const SKIP_SIZES: { value: SkipSize; label: string; volume: string }[] = [
  { value: 'MINI', label: 'Mini', volume: 'Līdz 2 m³' },
  { value: 'MIDI', label: 'Midi', volume: 'Līdz 4 m³' },
  { value: 'BUILDERS', label: 'Builders', volume: 'Līdz 6 m³' },
  { value: 'LARGE', label: 'Liels', volume: 'Līdz 8 m³' },
];

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
    haptics.light();
    setSavingSize(size);
    try {
      await api.carrierSettings.pricing.set(token, size, price);
      setPriceInputs((prev) => {
        const n = { ...prev };
        delete n[size];
        return n;
      });
      await load(true);
      haptics.success();
    } catch {
      haptics.error();
      Alert.alert('Kļūda', 'Neizdevās saglabāt cenu');
    } finally {
      setSavingSize(null);
    }
  };

  const handleDeletePrice = async (size: SkipSize) => {
    if (!token) return;
    haptics.light();
    Alert.alert('Dzēst cenu', `Dzēst cenu izmēram ${size}?`, [
      { text: 'Atcelt', style: 'cancel' },
      {
        text: 'Dzēst',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.carrierSettings.pricing.delete(token, size);
            load(true);
            haptics.success();
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
      haptics.success();
    } catch {
      haptics.error();
      Alert.alert('Kļūda', 'Neizdevās pievienot zonu');
    } finally {
      setAddingZone(false);
    }
  };

  const handleDeleteZone = (id: string, city: string) => {
    if (!token) return;
    haptics.light();
    Alert.alert('Dzēst zonu', `Dzēst "${city}"?`, [
      { text: 'Atcelt', style: 'cancel' },
      {
        text: 'Dzēst',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.carrierSettings.zones.delete(token, id);
            load(true);
            haptics.success();
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
      haptics.success();
    } catch {
      haptics.error();
      Alert.alert('Kļūda', 'Neizdevās bloķēt datumu');
    } finally {
      setBlockingDate(false);
    }
  };

  const handleUnblockDate = (id: string, date: string) => {
    if (!token) return;
    haptics.light();
    Alert.alert('Atbloķēt datumu', `Atjaunot pieejamību ${date}?`, [
      { text: 'Atcelt', style: 'cancel' },
      {
        text: 'Atbloķēt',
        onPress: async () => {
          try {
            await api.carrierSettings.availability.unblock(token, id);
            load(true);
            haptics.success();
          } catch {
            Alert.alert('Kļūda', 'Neizdevās atbloķēt datumu');
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
          <Text style={{ fontSize: 32, fontWeight: '800', color: '#111827', letterSpacing: -0.8 }}>Pārvadātājs</Text>
        </View>
        <View className="px-5"><SkeletonCard count={3} /></View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer bg="#ffffff" topBg="#ffffff">
      <ScreenHeader title="" />
      
      <View className="px-5 pt-1 pb-4">
        <Text style={{ fontSize: 32, fontWeight: '800', color: '#111827', letterSpacing: -0.8 }}>
          Pārvadātājs
        </Text>
        <Text className="text-gray-500 font-medium text-[15px] mt-1 mb-2">Reģioni un izcenojumi</Text>
      </View>

      {/* Segmented Control */}
      <View className="px-5 mb-4">
        <View className="flex-row bg-gray-100 p-1 rounded-2xl">
          {([
            { key: 'pricing', label: 'Cenas' },
            { key: 'zones', label: 'Zonas' },
            { key: 'availability', label: 'Pieejamība' },
          ] as const).map((s) => {
            const active = tab === s.key;
            return (
              <TouchableOpacity
                key={s.key}
                className={`flex-1 flex-row items-center justify-center py-2.5 rounded-xl ${active ? 'bg-white' : ''}`}
                style={active ? { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 1, shadowOffset: { width: 0, height: 1 } } : {}}
                onPress={() => { haptics.light(); setTab(s.key as Tab); }}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: active ? '#111827' : '#6b7280' }}>
                  {s.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 60 }}
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
          <View>
            <View className="px-5 pb-3">
              <Text className="text-[14px] text-gray-500 font-medium tracking-tight">Iestatiet cenu (€/dienā) katram konteinera izmēram.</Text>
            </View>
            
            {SKIP_SIZES.map(({ value, label, volume }, i) => {
              const existing = priceMap[value];
              const editVal = priceInputs[value];
              const displayVal = editVal !== undefined ? editVal : (existing ? String(existing.price) : '');
              const isDirty = editVal !== undefined;
              const isSaving = savingSize === value;

              return (
                <View key={value} className={`flex-row items-center justify-between px-5 py-4 bg-white border-gray-100 ${i !== SKIP_SIZES.length - 1 ? 'border-b' : ''}`}>
                  <View className="flex-1 pr-4">
                    <Text style={{ fontSize: 17, fontWeight: '700', color: '#111827', letterSpacing: -0.3 }}>{label}</Text>
                    <Text style={{ fontSize: 14, color: '#6b7280', fontWeight: '500', marginTop: 2 }}>{volume}</Text>
                  </View>
                  <View className="flex-row items-center" style={{ gap: 8 }}>
                    <View className="relative flex-row items-center">
                      <TextInput
                        className="bg-gray-100 rounded-2xl pl-4 pr-8 text-gray-900 font-bold"
                        style={{ paddingTop: 14, paddingBottom: 14, fontSize: 18, minWidth: 90, textAlign: 'right' }}
                        value={displayVal}
                        onChangeText={(v) => setPriceInputs((prev) => ({ ...prev, [value]: v }))}
                        keyboardType="decimal-pad"
                        placeholder="0.00"
                        placeholderTextColor="#9ca3af"
                      />
                      {displayVal.length > 0 && <Text className="absolute right-4 text-gray-400 font-bold" style={{ fontSize: 18 }}>€</Text>}
                    </View>
                    
                    {isDirty ? (
                      <TouchableOpacity
                        className="w-12 h-12 rounded-full bg-gray-900 items-center justify-center"
                        onPress={() => handleSavePrice(value)}
                        disabled={isSaving}
                        activeOpacity={0.7}
                      >
                        {isSaving ? <ActivityIndicator size="small" color="#fff" /> : <Check size={18} color="#fff" strokeWidth={3} />}
                      </TouchableOpacity>
                    ) : existing ? (
                      <TouchableOpacity
                        className="w-12 h-12 rounded-full bg-gray-100 items-center justify-center"
                        onPress={() => handleDeletePrice(value)}
                        activeOpacity={0.7}
                      >
                        <Trash2 size={18} color="#9ca3af" />
                      </TouchableOpacity>
                    ) : (
                      <View className="w-12 h-12" /> // spacer to keep alignment
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ── ZONES TAB ── */}
        {tab === 'zones' && (
          <View>
            <View className="px-5 pb-3">
              <Text className="text-[14px] text-gray-500 font-medium tracking-tight mb-4">Norādiet pilsētas un reģionus, kuros sniedzat pakalpojumus.</Text>
              
              {showAddZone ? (
                <View className="bg-gray-50 rounded-3xl p-5 mb-2" style={{ gap: 12 }}>
                  <TextInput
                    className="bg-white rounded-2xl px-5 text-gray-900 font-medium"
                    style={{ paddingVertical: 14, fontSize: 16 }}
                    placeholder="Pilsēta / Reģions (piem. Rīga)"
                    placeholderTextColor="#9ca3af"
                    value={newCity}
                    onChangeText={setNewCity}
                    autoFocus
                  />
                  <View className="flex-row" style={{ gap: 12 }}>
                    <TextInput
                      className="flex-1 bg-white rounded-2xl px-5 text-gray-900 font-medium"
                      style={{ paddingVertical: 14, fontSize: 16 }}
                      placeholder="Indekss (nav obligāti)"
                      placeholderTextColor="#9ca3af"
                      value={newPostcode}
                      onChangeText={setNewPostcode}
                    />
                    <TextInput
                      className="flex-1 bg-white rounded-2xl px-5 text-gray-900 font-medium"
                      style={{ paddingVertical: 14, fontSize: 16 }}
                      placeholder="Piemaksa €"
                      placeholderTextColor="#9ca3af"
                      value={newSurcharge}
                      onChangeText={setNewSurcharge}
                      keyboardType="decimal-pad"
                    />
                  </View>
                  
                  <View className="flex-row mt-2" style={{ gap: 12 }}>
                    <TouchableOpacity
                      className="flex-1 items-center justify-center rounded-full py-3.5 bg-white border border-gray-200"
                      onPress={() => { setShowAddZone(false); setNewCity(''); setNewPostcode(''); setNewSurcharge(''); }}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 15, fontWeight: '600', color: '#6b7280' }}>Atcelt</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      className={`flex-1 items-center justify-center rounded-full py-3.5 ${!newCity.trim() || addingZone ? 'bg-gray-200' : 'bg-gray-900'}`}
                      onPress={handleAddZone}
                      disabled={!newCity.trim() || addingZone}
                      activeOpacity={0.7}
                    >
                      {addingZone ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ fontSize: 15, fontWeight: '700', color: !newCity.trim() ? '#9ca3af' : '#fff' }}>Pievienot</Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  className="flex-row items-center justify-center rounded-full bg-gray-100 py-3.5 mb-2"
                  style={{ gap: 8 }}
                  onPress={() => { haptics.light(); setShowAddZone(true); }}
                  activeOpacity={0.7}
                >
                  <Plus size={18} color="#111827" />
                  <Text style={{ fontSize: 15, fontWeight: '600', color: '#111827' }}>Pievienot zonu</Text>
                </TouchableOpacity>
              )}
            </View>

            <View className="mt-2">
              {zones.length === 0 && !showAddZone && (
                <View className="items-center py-10">
                  <Text className="text-gray-400 font-medium text-[15px]">Nav pievienotu zonu</Text>
                </View>
              )}
              {zones.map((zone, idx) => (
                <View key={zone.id} className={`flex-row items-center justify-between px-5 py-4 bg-white border-gray-100 ${idx !== zones.length - 1 ? 'border-b' : ''}`}>
                  <View className="flex-1 pr-4">
                    <Text style={{ fontSize: 17, fontWeight: '700', color: '#111827', letterSpacing: -0.3 }}>{zone.city}</Text>
                    <View className="flex-row items-center mt-1.5" style={{ gap: 12 }}>
                      {zone.postcode ? (
                        <Text style={{ fontSize: 13, color: '#6b7280', fontWeight: '500' }}>Indekss: {zone.postcode}</Text>
                      ) : null}
                      {zone.surcharge ? (
                        <View className="bg-red-50 px-2 py-0.5 rounded-md">
                          <Text style={{ fontSize: 12, color: '#b91c1c', fontWeight: '600' }}>+€{zone.surcharge}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                  <TouchableOpacity
                    className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center"
                    onPress={() => handleDeleteZone(zone.id, zone.city)}
                    activeOpacity={0.7}
                  >
                    <Trash2 size={16} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── AVAILABILITY TAB ── */}
        {tab === 'availability' && (
          <View>
            <View className="px-5 pb-3">
              <Text className="text-[14px] text-gray-500 font-medium tracking-tight mb-4">Bloķējiet datumus, kad neesat pieejams piegādēm.</Text>
              
              <View className="bg-gray-50 rounded-3xl p-5 mb-2" style={{ gap: 12 }}>
                <TextInput
                  className="bg-white rounded-2xl px-5 text-gray-900 font-medium"
                  style={{ paddingVertical: 14, fontSize: 16 }}
                  placeholder="Datums GGGG-MM-DD"
                  placeholderTextColor="#9ca3af"
                  value={newDate}
                  onChangeText={setNewDate}
                />
                <TextInput
                  className="bg-white rounded-2xl px-5 text-gray-900 font-medium"
                  style={{ paddingVertical: 14, fontSize: 16 }}
                  placeholder="Iemesls (neobligāti, piem. Brīvdiena)"
                  placeholderTextColor="#9ca3af"
                  value={newReason}
                  onChangeText={setNewReason}
                />
                <TouchableOpacity
                  className={`items-center justify-center rounded-full py-4 mt-2 ${!newDate.trim() || blockingDate ? 'bg-gray-200' : 'bg-gray-900'}`}
                  onPress={handleBlockDate}
                  disabled={!newDate.trim() || blockingDate}
                  activeOpacity={0.7}
                >
                  {blockingDate ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ fontSize: 15, fontWeight: '700', color: !newDate.trim() ? '#9ca3af' : '#fff' }}>Bloķēt datumu</Text>}
                </TouchableOpacity>
              </View>
            </View>

            <View className="mt-2">
              {blockedDates.length === 0 && (
                <View className="items-center py-10">
                  <Text className="text-gray-400 font-medium text-[15px]">Nav bloķētu datumu</Text>
                </View>
              )}
              {blockedDates.sort((a, b) => a.date.localeCompare(b.date)).map((d, idx) => (
                <View key={d.id} className={`flex-row items-center justify-between px-5 py-4 bg-white border-gray-100 ${idx !== blockedDates.length - 1 ? 'border-b' : ''}`}>
                  <View className="flex-1 pr-4">
                    <Text style={{ fontSize: 17, fontWeight: '700', color: '#111827', letterSpacing: -0.3, fontVariant: ['tabular-nums'] }}>{d.date}</Text>
                    {d.reason ? <Text style={{ fontSize: 14, color: '#6b7280', fontWeight: '500', marginTop: 2 }}>{d.reason}</Text> : null}
                  </View>
                  <TouchableOpacity
                    className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center"
                    onPress={() => handleUnblockDate(d.id, d.date)}
                    activeOpacity={0.7}
                  >
                    <Trash2 size={16} color="#9ca3af" />
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

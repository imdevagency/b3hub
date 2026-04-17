import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Switch,
  FlatList,
} from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useRouter } from 'expo-router';
import { Plus, X, Trash2, Truck, ChevronRight } from 'lucide-react-native';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { StatusPill } from '@/components/ui/StatusPill';
import { haptics } from '@/lib/haptics';
import type { ApiVehicle, VehicleType } from '@/lib/api';

// ── Constants ──────────────────────────────────────────────────

const VEHICLE_LABELS: Record<VehicleType, string> = {
  DUMP_TRUCK: 'Pašizgāzējs',
  FLATBED_TRUCK: 'Platforma',
  SEMI_TRAILER: 'Vilcējs ar puspiekabi',
  HOOK_LIFT: 'Āķa pacēlājs',
  SKIP_LOADER: 'Konteinerauto',
  TANKER: 'Cisternauto',
  VAN: 'Furgons',
};

const TYPES = Object.keys(VEHICLE_LABELS) as VehicleType[];

interface VehicleForm {
  licensePlate: string;
  vehicleType: VehicleType;
  make: string;
  model: string;
  year: string;
  capacity: string;
  isActive: boolean;
  insuranceExpiry: string;
  inspectionExpiry: string;
}

const BLANK: VehicleForm = {
  licensePlate: '',
  vehicleType: 'DUMP_TRUCK',
  make: '',
  model: '',
  year: '',
  capacity: '',
  isActive: true,
  insuranceExpiry: '',
  inspectionExpiry: '',
};

// ── Vehicle Card ───────────────────────────────────────────────

function VehicleCard({
  vehicle,
  onPress,
  isReadOnly = false,
}: {
  vehicle: ApiVehicle;
  onPress: (v: ApiVehicle) => void;
  isReadOnly?: boolean;
}) {
  return (
    <TouchableOpacity
      className="flex-row items-center py-4 px-5 bg-white border-b border-gray-100"
      onPress={() => onPress(vehicle)}
      disabled={isReadOnly}
      activeOpacity={0.7}
    >
      <View className="w-12 h-12 rounded-full bg-gray-50 items-center justify-center mr-4">
        <Truck size={24} color="#6b7280" />
      </View>

      <View className="flex-1 pr-4 gap-1">
        <View className="flex-row items-center gap-2">
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', letterSpacing: 0.5 }}>
            {vehicle.licensePlate}
          </Text>
          {vehicle.isActive && <StatusPill label="Akтīvs" bg="#dcfce7" color="#166534" size="sm" />}
        </View>
        <Text style={{ fontSize: 13, color: '#6b7280', fontWeight: '500' }}>
          {VEHICLE_LABELS[vehicle.vehicleType]}
          {vehicle.capacity ? ` • ${vehicle.capacity}t` : ''}
        </Text>
      </View>

      {!isReadOnly && (
        <View>
          <ChevronRight size={20} color="#d1d5db" />
        </View>
      )}
    </TouchableOpacity>
  );
}

// ── Form Modal ─────────────────────────────────────────────────

function VehicleModal({
  visible,
  initial,
  onClose,
  onSave,
  onDelete,
  saving,
}: {
  visible: boolean;
  initial: ApiVehicle | null;
  onClose: () => void;
  onSave: (form: VehicleForm) => void;
  onDelete?: (id: string) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<VehicleForm>(BLANK);

  useEffect(() => {
    if (visible) {
      if (initial) {
        setForm({
          licensePlate: initial.licensePlate,
          vehicleType: initial.vehicleType,
          make: initial.make ?? '',
          model: initial.model ?? '',
          year: initial.year != null ? String(initial.year) : '',
          capacity: initial.capacity != null ? String(initial.capacity) : '',
          isActive: initial.isActive,
          insuranceExpiry: initial.insuranceExpiry ? initial.insuranceExpiry.slice(0, 10) : '',
          inspectionExpiry: initial.inspectionExpiry ? initial.inspectionExpiry.slice(0, 10) : '',
        });
      } else {
        setForm(BLANK);
      }
    }
  }, [visible, initial]);

  const set = (k: keyof VehicleForm) => (v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const canSave = form.licensePlate.trim().length > 0 && !saving;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: '#ffffff' }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between pt-6 pb-4 px-5">
          <Text style={{ fontSize: 24, fontWeight: '800', color: '#111827', letterSpacing: -0.5 }}>
            {initial?.id ? 'Rediģēt transportu' : 'Jauns transports'}
          </Text>
          <TouchableOpacity
            onPress={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
            activeOpacity={0.8}
          >
            <X size={18} color="#6b7280" />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100, gap: 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* License Plate - Hero Input */}
          <View className="bg-gray-100 rounded-3xl p-6 items-center mt-2">
            <Text
              style={{
                fontSize: 12,
                fontWeight: '600',
                color: '#6b7280',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 8,
              }}
            >
              Valsts numurzīme
            </Text>
            <TextInput
              style={{
                fontSize: 36,
                fontWeight: '800',
                color: '#111827',
                letterSpacing: 2,
                textAlign: 'center',
                minWidth: '100%',
              }}
              placeholder="AA-1234"
              placeholderTextColor="#9ca3af"
              value={form.licensePlate}
              onChangeText={set('licensePlate')}
              autoCapitalize="characters"
            />
          </View>

          {/* Type Selector */}
          <View>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#111827', marginBottom: 12 }}>
              Transporta veids
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              {TYPES.map((t) => {
                const isActive = form.vehicleType === t;
                return (
                  <TouchableOpacity
                    key={t}
                    className={`px-5 py-3 rounded-full flex-row items-center justify-center border ${isActive ? 'bg-gray-900 border-gray-900' : 'bg-white border-gray-200'}`}
                    onPress={() => {
                      haptics.light();
                      set('vehicleType')(t);
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: isActive ? '700' : '600',
                        color: isActive ? '#ffffff' : '#374151',
                      }}
                    >
                      {VEHICLE_LABELS[t]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Make / Model */}
          <View className="flex-row gap-3">
            <View className="flex-1 bg-gray-50 rounded-2xl px-4 py-3">
              <Text style={{ fontSize: 12, color: '#6b7280', fontWeight: '500', marginBottom: 4 }}>
                Marka
              </Text>
              <TextInput
                style={{ fontSize: 16, fontWeight: '600', color: '#111827' }}
                placeholder="Scania"
                placeholderTextColor="#9ca3af"
                value={form.make}
                onChangeText={set('make')}
              />
            </View>
            <View className="flex-1 bg-gray-50 rounded-2xl px-4 py-3">
              <Text style={{ fontSize: 12, color: '#6b7280', fontWeight: '500', marginBottom: 4 }}>
                Modelis
              </Text>
              <TextInput
                style={{ fontSize: 16, fontWeight: '600', color: '#111827' }}
                placeholder="R450"
                placeholderTextColor="#9ca3af"
                value={form.model}
                onChangeText={set('model')}
              />
            </View>
          </View>

          {/* Year / Capacity */}
          <View className="flex-row gap-3">
            <View className="flex-1 bg-gray-50 rounded-2xl px-4 py-3">
              <Text style={{ fontSize: 12, color: '#6b7280', fontWeight: '500', marginBottom: 4 }}>
                Gads
              </Text>
              <TextInput
                style={{ fontSize: 16, fontWeight: '600', color: '#111827' }}
                placeholder="2020"
                placeholderTextColor="#9ca3af"
                value={form.year}
                onChangeText={set('year')}
                keyboardType="number-pad"
              />
            </View>
            <View className="flex-1 bg-gray-50 rounded-2xl px-4 py-3">
              <Text style={{ fontSize: 12, color: '#6b7280', fontWeight: '500', marginBottom: 4 }}>
                Krava (t)
              </Text>
              <TextInput
                style={{ fontSize: 16, fontWeight: '600', color: '#111827' }}
                placeholder="20.5"
                placeholderTextColor="#9ca3af"
                value={form.capacity}
                onChangeText={set('capacity')}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          {/* Dates */}
          <View className="flex-row gap-3">
            <View className="flex-1 bg-gray-50 rounded-2xl px-4 py-3">
              <Text style={{ fontSize: 12, color: '#6b7280', fontWeight: '500', marginBottom: 4 }}>
                OCTA līdz
              </Text>
              <TextInput
                style={{ fontSize: 16, fontWeight: '600', color: '#111827' }}
                placeholder="GGGG-MM-DD"
                placeholderTextColor="#9ca3af"
                value={form.insuranceExpiry}
                onChangeText={set('insuranceExpiry')}
                keyboardType="numbers-and-punctuation"
                maxLength={10}
              />
            </View>
            <View className="flex-1 bg-gray-50 rounded-2xl px-4 py-3">
              <Text style={{ fontSize: 12, color: '#6b7280', fontWeight: '500', marginBottom: 4 }}>
                Skate līdz
              </Text>
              <TextInput
                style={{ fontSize: 16, fontWeight: '600', color: '#111827' }}
                placeholder="GGGG-MM-DD"
                placeholderTextColor="#9ca3af"
                value={form.inspectionExpiry}
                onChangeText={set('inspectionExpiry')}
                keyboardType="numbers-and-punctuation"
                maxLength={10}
              />
            </View>
          </View>

          {/* Status Toggle */}
          <View className="flex-row items-center justify-between py-2">
            <View>
              <Text style={{ fontSize: 16, color: '#111827', fontWeight: '700' }}>
                Aktīvs statuss
              </Text>
              <Text style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
                Transportlīdzeklis tiks izmantots plānošanā
              </Text>
            </View>
            <Switch
              value={form.isActive}
              onValueChange={(v) => {
                haptics.light();
                set('isActive')(v);
              }}
              trackColor={{ true: '#111827', false: '#e5e7eb' }}
              thumbColor="#fff"
            />
          </View>

          {/* Delete Option */}
          {initial && onDelete && (
            <TouchableOpacity
              className="py-4"
              onPress={() => onDelete(initial.id)}
              activeOpacity={0.8}
            >
              <Text
                style={{ color: '#ef4444', fontSize: 15, fontWeight: '600', textAlign: 'center' }}
              >
                Dzēst transportlīdzekli
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        {/* Sticky Bottom Actions */}
        <View className="absolute bottom-0 w-full px-5 py-6 bg-white border-t border-gray-100 pb-10">
          <TouchableOpacity
            onPress={() => {
              haptics.medium();
              onSave(form);
            }}
            disabled={!canSave}
            className={`py-4 rounded-full flex-row items-center justify-center ${canSave ? 'bg-gray-900' : 'bg-gray-200'}`}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text
                style={{ fontSize: 17, fontWeight: '700', color: canSave ? '#ffffff' : '#9ca3af' }}
              >
                Saglabāt
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Main Screen ────────────────────────────────────────────────

export default function VehiclesScreen() {
  const { token, user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [vehicles, setVehicles] = useState<ApiVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<ApiVehicle | null>(null);
  const [saving, setSaving] = useState(false);

  // Company DRIVERs and MEMBERs can view vehicles but cannot create/edit/delete them —
  // fleet management is a dispatcher/owner task done in the web portal.
  // Owner-operators (no company) and OWNER/MANAGER roles retain full CRUD.
  const isReadOnly =
    !!user?.company && (user.companyRole === 'DRIVER' || user.companyRole === 'MEMBER');

  const load = useCallback(
    async (refresh = false) => {
      if (!token) return;
      try {
        refresh ? setRefreshing(true) : setLoading(true);
        const data = await api.vehicles.getAll(token);
        setVehicles(data);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Neizdevās ielādēt transportlīdzeļlus');
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

  const handleSave = async (form: VehicleForm) => {
    if (!token) return;
    setSaving(true);
    const payload = {
      licensePlate: form.licensePlate.trim().toUpperCase(),
      vehicleType: form.vehicleType,
      make: form.make.trim(),
      model: form.model.trim(),
      year: form.year ? Number(form.year) : undefined,
      capacity: form.capacity ? Number(form.capacity) : undefined,
      isActive: form.isActive,
      insuranceExpiry: form.insuranceExpiry.trim() || undefined,
      inspectionExpiry: form.inspectionExpiry.trim() || undefined,
    };
    try {
      if (editing?.id) {
        await api.vehicles.update(editing.id, payload, token);
      } else {
        await api.vehicles.create(payload as any, token);
      }
      setModalVisible(false);
      toast.success(editing?.id ? 'Transports atjaunināts!' : 'Transports pievienots!');
      load();
    } catch (err: unknown) {
      Alert.alert('Kļūda', err instanceof Error ? err.message : 'Neizdevās saglabāt');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    const v = vehicles.find((x) => x.id === id);
    if (!v) return;

    Alert.alert('Dzēst transportlīdzekli?', `${v.licensePlate} tiks neatgriezeniski dzēsts.`, [
      { text: 'Atcelt', style: 'cancel' },
      {
        text: 'Dzēst',
        style: 'destructive',
        onPress: async () => {
          if (!token) return;
          try {
            await api.vehicles.remove(id, token);
            setVehicles((prev) => prev.filter((x) => x.id !== id));
            setModalVisible(false);
            haptics.success();
          } catch (err: unknown) {
            Alert.alert('Kļūda', err instanceof Error ? err.message : 'Neizdevās dzēst');
          }
        },
      },
    ]);
  };

  const openModal = (v?: ApiVehicle) => {
    haptics.light();
    setEditing(v || null);
    setModalVisible(true);
  };

  return (
    <ScreenContainer bg="#ffffff" topBg="#ffffff">
      <ScreenHeader
        title="Transporti"
        rightAction={
          !isReadOnly ? (
            <TouchableOpacity
              className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center"
              onPress={() => openModal()}
              activeOpacity={0.8}
              hitSlop={8}
            >
              <Plus size={20} color="#111827" strokeWidth={3} />
            </TouchableOpacity>
          ) : undefined
        }
      />

      <FlatList
        data={vehicles}
        keyExtractor={(item) => item.id}
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor="#111827"
          />
        }
        ListEmptyComponent={
          !loading ? (
            <View className="mt-8">
              <EmptyState
                icon={<Truck size={40} color="#d1d5db" />}
                title="Nav transportlīdzekļu"
                subtitle={
                  isReadOnly
                    ? 'Transportlīdzekļu pārvaldība pieejama uzņēmuma portālā'
                    : 'Pievienojiet savu pirmo transportlīdzekli!'
                }
                action={
                  !isReadOnly ? (
                    <TouchableOpacity
                      className="px-8 py-3.5 bg-gray-900 rounded-full mt-4"
                      onPress={() => openModal()}
                      activeOpacity={0.8}
                    >
                      <Text style={{ fontSize: 15, fontWeight: '700', color: '#ffffff' }}>
                        Pievienot transportu
                      </Text>
                    </TouchableOpacity>
                  ) : undefined
                }
              />
            </View>
          ) : (
            <View className="px-5 border-t border-gray-100 pt-4">
              <SkeletonCard count={3} />
            </View>
          )
        }
        renderItem={({ item }) => (
          <VehicleCard vehicle={item} isReadOnly={isReadOnly} onPress={openModal} />
        )}
      />

      <VehicleModal
        visible={modalVisible}
        initial={editing}
        onClose={() => setModalVisible(false)}
        onSave={handleSave}
        onDelete={!isReadOnly ? handleDelete : undefined}
        saving={saving}
      />
    </ScreenContainer>
  );
}

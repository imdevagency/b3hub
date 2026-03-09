import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Plus, Pencil, Trash2, Truck } from 'lucide-react-native';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { SkeletonCard } from '@/components/ui/Skeleton';
import type { ApiVehicle, VehicleType } from '@/lib/api';

// ── Constants ──────────────────────────────────────────────────

const VEHICLE_LABELS: Record<VehicleType, string> = {
  TRUCK: 'Kravas auto',
  SEMI_TRUCK: 'Vilcējs',
  TIPPER: 'Pašizgāzējs',
  FLATBED: 'Platforma',
  VAN: 'Furgons',
  OTHER: 'Cits',
};

const VEHICLE_ICON: Record<VehicleType, string> = {
  TRUCK: '🚛',
  SEMI_TRUCK: '🚚',
  TIPPER: '🚜',
  FLATBED: '🛻',
  VAN: '🚐',
  OTHER: '🚗',
};

const TYPES = Object.keys(VEHICLE_LABELS) as VehicleType[];

interface VehicleForm {
  licensePlate: string;
  vehicleType: VehicleType;
  make: string;
  model: string;
  year: string;
  payloadTonnes: string;
  isActive: boolean;
}

const BLANK: VehicleForm = {
  licensePlate: '',
  vehicleType: 'TIPPER',
  make: '',
  model: '',
  year: '',
  payloadTonnes: '',
  isActive: true,
};

// ── Vehicle Card ───────────────────────────────────────────────

function VehicleCard({
  vehicle,
  onEdit,
  onDelete,
}: {
  vehicle: ApiVehicle;
  onEdit: (v: ApiVehicle) => void;
  onDelete: (v: ApiVehicle) => void;
}) {
  return (
    <View style={s.card}>
      <View style={s.cardRow}>
        <Text style={s.cardIcon}>{VEHICLE_ICON[vehicle.vehicleType]}</Text>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={s.cardPlate}>{vehicle.licensePlate}</Text>
          <Text style={s.cardType}>{VEHICLE_LABELS[vehicle.vehicleType]}</Text>
          {vehicle.make || vehicle.model ? (
            <Text style={s.cardMeta}>
              {[vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(' ')}
            </Text>
          ) : null}
        </View>
        <View style={[s.statusBadge, !vehicle.isActive && s.statusBadgeInactive]}>
          <Text style={[s.statusText, !vehicle.isActive && s.statusTextInactive]}>
            {vehicle.isActive ? 'Aktīvs' : 'Neaktīvs'}
          </Text>
        </View>
      </View>

      {vehicle.payloadTonnes != null && (
        <Text style={s.payload}>Krava: {vehicle.payloadTonnes} t</Text>
      )}

      <View style={s.cardActions}>
        <TouchableOpacity style={s.editBtn} onPress={() => onEdit(vehicle)} activeOpacity={0.8}>
          <Pencil size={14} color="#2563eb" />
          <Text style={s.editBtnText}>Labot</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.deleteBtn} onPress={() => onDelete(vehicle)} activeOpacity={0.8}>
          <Trash2 size={14} color="#dc2626" />
          <Text style={s.deleteBtnText}>Dzēst</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Form Modal ─────────────────────────────────────────────────

function VehicleModal({
  visible,
  initial,
  onClose,
  onSave,
  saving,
}: {
  visible: boolean;
  initial: ApiVehicle | null;
  onClose: () => void;
  onSave: (form: VehicleForm) => void;
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
          payloadTonnes: initial.payloadTonnes != null ? String(initial.payloadTonnes) : '',
          isActive: initial.isActive,
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
        style={{ flex: 1, backgroundColor: '#f2f2f7' }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={s.modalHandle}>
          <View style={s.handleBar} />
        </View>
        <View style={s.modalToolbar}>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <Text style={s.cancelText}>Atcelt</Text>
          </TouchableOpacity>
          <Text style={s.modalTitle}>
            {initial?.id ? 'Labot transportu' : 'Pievienot transportu'}
          </Text>
          <TouchableOpacity onPress={() => onSave(form)} disabled={!canSave} hitSlop={10}>
            <Text style={[s.saveText, !canSave && s.saveTextDisabled]}>
              {saving ? 'Saglabā...' : 'Saglabāt'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={s.formScroll} keyboardShouldPersistTaps="handled">
          <Text style={s.formLabel}>Reģ. numurs *</Text>
          <TextInput
            style={s.input}
            placeholder="AA-1234"
            value={form.licensePlate}
            onChangeText={set('licensePlate')}
            autoCapitalize="characters"
          />

          <Text style={s.formLabel}>Tips *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipRow}>
            {TYPES.map((t) => (
              <TouchableOpacity
                key={t}
                style={[s.chip, form.vehicleType === t && s.chipActive]}
                onPress={() => set('vehicleType')(t)}
              >
                <Text style={[s.chipText, form.vehicleType === t && s.chipTextActive]}>
                  {VEHICLE_ICON[t]} {VEHICLE_LABELS[t]}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={s.formLabel}>Marka</Text>
          <TextInput
            style={s.input}
            placeholder="Scania"
            value={form.make}
            onChangeText={set('make')}
          />

          <Text style={s.formLabel}>Modelis</Text>
          <TextInput
            style={s.input}
            placeholder="R450"
            value={form.model}
            onChangeText={set('model')}
          />

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={s.formLabel}>Gads</Text>
              <TextInput
                style={s.input}
                placeholder="2020"
                value={form.year}
                onChangeText={set('year')}
                keyboardType="number-pad"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.formLabel}>Krava (t)</Text>
              <TextInput
                style={s.input}
                placeholder="20"
                value={form.payloadTonnes}
                onChangeText={set('payloadTonnes')}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <View style={s.toggleRow}>
            <Text style={s.toggleLabel}>Aktīvs</Text>
            <Switch
              value={form.isActive}
              onValueChange={(v) => set('isActive')(v)}
              trackColor={{ true: '#2563eb', false: '#d1d5db' }}
              thumbColor="#fff"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Main Screen ────────────────────────────────────────────────

export default function VehiclesScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [vehicles, setVehicles] = useState<ApiVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<ApiVehicle | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(
    async (refresh = false) => {
      if (!token) return;
      try {
        refresh ? setRefreshing(true) : setLoading(true);
        const data = await api.vehicles.getAll(token);
        setVehicles(data);
      } catch (err) {
        console.error(err);
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
      year: form.year ? parseInt(form.year) : undefined,
      payloadTonnes: form.payloadTonnes ? parseFloat(form.payloadTonnes) : undefined,
      isActive: form.isActive,
    };
    try {
      if (editing?.id) {
        await api.vehicles.update(editing.id, payload, token);
      } else {
        await api.vehicles.create(payload as Parameters<typeof api.vehicles.create>[0], token);
      }
      setModalVisible(false);
      load();
    } catch (err: unknown) {
      Alert.alert('Kļūda', err instanceof Error ? err.message : 'Neizdevās saglabāt');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (v: ApiVehicle) => {
    Alert.alert('Dzēst transportlīdzekli?', `${v.licensePlate} tiks dzēsts.`, [
      { text: 'Atcelt', style: 'cancel' },
      {
        text: 'Dzēst',
        style: 'destructive',
        onPress: async () => {
          if (!token) return;
          try {
            await api.vehicles.remove(v.id, token);
            setVehicles((prev) => prev.filter((x) => x.id !== v.id));
          } catch (err: unknown) {
            Alert.alert('Kļūda', err instanceof Error ? err.message : 'Neizdevās dzēst');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Mani transportlīdzekļi</Text>
        <TouchableOpacity
          style={s.addBtn}
          onPress={() => {
            setEditing(null);
            setModalVisible(true);
          }}
          activeOpacity={0.8}
        >
          <Plus size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <SkeletonCard count={3} />
      ) : (
        <ScrollView
          contentContainerStyle={s.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor="#2563eb"
            />
          }
        >
          {vehicles.length === 0 ? (
            <View style={s.emptyWrap}>
              <Truck size={48} color="#9ca3af" />
              <Text style={s.emptyTitle}>Nav transportlīdzekļu</Text>
              <Text style={s.emptyDesc}>Pievienojiet savu pirmo transportlīdzekli!</Text>
              <TouchableOpacity
                style={s.emptyAddBtn}
                onPress={() => {
                  setEditing(null);
                  setModalVisible(true);
                }}
                activeOpacity={0.8}
              >
                <Plus size={16} color="#fff" />
                <Text style={s.emptyAddText}>Pievienot</Text>
              </TouchableOpacity>
            </View>
          ) : (
            vehicles.map((v) => (
              <VehicleCard
                key={v.id}
                vehicle={v}
                onEdit={(veh) => {
                  setEditing(veh);
                  setModalVisible(true);
                }}
                onDelete={handleDelete}
              />
            ))
          )}
        </ScrollView>
      )}

      <VehicleModal
        visible={modalVisible}
        initial={editing}
        onClose={() => setModalVisible(false)}
        onSave={handleSave}
        saving={saving}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f2f7' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardIcon: { fontSize: 32 },
  cardPlate: { fontSize: 17, fontWeight: '800', color: '#111827', letterSpacing: 1 },
  cardType: { fontSize: 13, color: '#374151' },
  cardMeta: { fontSize: 12, color: '#9ca3af' },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: '#dcfce7',
  },
  statusBadgeInactive: { backgroundColor: '#f3f4f6' },
  statusText: { fontSize: 11, fontWeight: '600', color: '#16a34a' },
  statusTextInactive: { color: '#9ca3af' },
  payload: { fontSize: 12, color: '#6b7280', marginTop: 6 },
  cardActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  editBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2563eb',
  },
  editBtnText: { fontSize: 13, fontWeight: '600', color: '#2563eb' },
  deleteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dc2626',
  },
  deleteBtnText: { fontSize: 13, fontWeight: '600', color: '#dc2626' },
  emptyWrap: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#374151' },
  emptyDesc: { fontSize: 14, color: '#6b7280', textAlign: 'center' },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2563eb',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    marginTop: 8,
  },
  emptyAddText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  modalHandle: { paddingTop: 12, alignItems: 'center' },
  handleBar: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#d1d5db' },
  modalToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  cancelText: { fontSize: 15, color: '#6b7280' },
  saveText: { fontSize: 15, fontWeight: '700', color: '#2563eb' },
  saveTextDisabled: { color: '#9ca3af' },
  formScroll: { padding: 16, gap: 4, paddingBottom: 48 },
  formLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginTop: 12, marginBottom: 4 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    color: '#111827',
  },
  chipRow: { marginBottom: 4 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginRight: 8,
  },
  chipActive: { backgroundColor: '#dbeafe', borderColor: '#2563eb' },
  chipText: { fontSize: 13, color: '#374151', fontWeight: '500' },
  chipTextActive: { color: '#2563eb', fontWeight: '700' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    marginTop: 12,
  },
  toggleLabel: { fontSize: 15, color: '#111827' },
});

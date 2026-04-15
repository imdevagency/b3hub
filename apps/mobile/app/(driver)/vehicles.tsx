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
  FlatList,
} from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { useRouter } from 'expo-router';
import { Plus, Pencil, Trash2, Truck, ChevronRight } from 'lucide-react-native';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
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

const VEHICLE_ICON: Record<VehicleType, string> = {
  DUMP_TRUCK: '🚜',
  FLATBED_TRUCK: '🛻',
  SEMI_TRAILER: '🚚',
  HOOK_LIFT: '🏗️',
  SKIP_LOADER: '🚛',
  TANKER: '🛢️',
  VAN: '🚐',
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
      style={s.card}
      onPress={() => onPress(vehicle)}
      disabled={isReadOnly}
      activeOpacity={0.7}
    >
      <View style={s.cardIconContainer}>
        <Text style={s.cardIcon}>{VEHICLE_ICON[vehicle.vehicleType]}</Text>
      </View>

      <View style={s.cardContent}>
        <View style={s.cardHeader}>
          <Text style={s.cardPlate}>{vehicle.licensePlate}</Text>
          {vehicle.isActive && <StatusPill label="Akтīvs" bg="#dcfce7" color="#166534" size="sm" />}
        </View>
        <Text style={s.cardSubtext}>
          {VEHICLE_LABELS[vehicle.vehicleType]}
          {vehicle.capacity ? ` • ${vehicle.capacity}t` : ''}
        </Text>
      </View>

      {!isReadOnly && (
        <View style={s.cardChevron}>
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
        <View style={s.modalHandle}>
          <View style={s.handleBar} />
        </View>
        <View style={s.modalToolbar}>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <Text style={s.cancelText}>Atcelt</Text>
          </TouchableOpacity>
          <Text style={s.modalTitle}>
            {initial?.id ? 'Rediģēt transportu' : 'Jauns transports'}
          </Text>
          <TouchableOpacity onPress={() => onSave(form)} disabled={!canSave} hitSlop={10}>
            <Text style={[s.saveText, !canSave && s.saveTextDisabled]}>
              {saving ? '...' : 'Saglabāt'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={s.formScroll} keyboardShouldPersistTaps="handled">
          <View style={s.formSection}>
            <Text style={s.formLabel}>Reģistrācijas numurs</Text>
            <TextInput
              style={s.inputBig}
              placeholder="AA-1234"
              value={form.licensePlate}
              onChangeText={set('licensePlate')}
              autoCapitalize="characters"
            />
          </View>

          <Text style={s.formLabel}>Transporta veids</Text>
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

          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.formLabel}>Marka</Text>
              <TextInput
                style={s.input}
                placeholder="Scania"
                value={form.make}
                onChangeText={set('make')}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.formLabel}>Modelis</Text>
              <TextInput
                style={s.input}
                placeholder="R450"
                value={form.model}
                onChangeText={set('model')}
              />
            </View>
          </View>

          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.formLabel}>Izlaiduma gads</Text>
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
                placeholder="20.5"
                value={form.capacity}
                onChangeText={set('capacity')}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <View style={s.toggleRow}>
            <Text style={s.toggleLabel}>Aktīvs statuss</Text>
            <Switch
              value={form.isActive}
              onValueChange={(v) => set('isActive')(v)}
              trackColor={{ true: '#111827', false: '#e5e7eb' }}
              thumbColor="#fff"
            />
          </View>

          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.formLabel}>Apdrošināšanas derīgums</Text>
              <TextInput
                style={s.input}
                placeholder="GGGG-MM-DD"
                value={form.insuranceExpiry}
                onChangeText={set('insuranceExpiry')}
                keyboardType="numbers-and-punctuation"
                maxLength={10}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.formLabel}>Tehniskās apskates derīgums</Text>
              <TextInput
                style={s.input}
                placeholder="GGGG-MM-DD"
                value={form.inspectionExpiry}
                onChangeText={set('inspectionExpiry')}
                keyboardType="numbers-and-punctuation"
                maxLength={10}
              />
            </View>
          </View>

          {initial && onDelete && (
            <TouchableOpacity
              style={s.deleteButton}
              onPress={() => onDelete(initial.id)}
              activeOpacity={0.8}
            >
              <Trash2 size={18} color="#ef4444" />
              <Text style={s.deleteButtonText}>Dzēst transportlīdzekli</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
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
    <ScreenContainer bg="#ffffff">
      <ScreenHeader
        title="Mani transporti"
        rightAction={
          !isReadOnly ? (
            <TouchableOpacity
              style={s.addBtn}
              onPress={() => openModal()}
              activeOpacity={0.8}
              hitSlop={8}
            >
              <Plus size={20} color="#fff" />
            </TouchableOpacity>
          ) : undefined
        }
      />

      <FlatList
        data={vehicles}
        keyExtractor={(item) => item.id}
        style={{ flex: 1 }}
        contentContainerStyle={s.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor="#00A878"
          />
        }
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon={<Truck size={32} color="#9ca3af" />}
              title="Nav transportlīdzekļu"
              subtitle={
                isReadOnly
                  ? 'Transportlīdzekļu pārvaldība pieejama uzņēmuma portālā'
                  : 'Pievienojiet savu pirmo transportlīdzekli!'
              }
              action={
                !isReadOnly ? (
                  <TouchableOpacity
                    style={s.emptyAddBtn}
                    onPress={() => openModal()}
                    activeOpacity={0.8}
                  >
                    <Plus size={18} color="#fff" />
                    <Text style={s.emptyAddText}>Pievienot</Text>
                  </TouchableOpacity>
                ) : undefined
              }
            />
          ) : null
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

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#111827', letterSpacing: -0.5 },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { padding: 16, gap: 12, flexGrow: 1, backgroundColor: '#ffffff' },

  // Card
  card: {
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  cardIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  cardIcon: { fontSize: 24 },
  cardContent: { flex: 1, gap: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardPlate: { fontSize: 16, fontWeight: '700', color: '#111827', letterSpacing: 0.5 },
  cardSubtext: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  cardChevron: { paddingLeft: 8 },

  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#111827',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 100,
    marginTop: 12,
  },
  emptyAddText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  modalHandle: { paddingTop: 16, alignItems: 'center', backgroundColor: '#ffffff' },
  handleBar: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#d1d5db' },
  modalToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    backgroundColor: '#ffffff',
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  cancelText: { fontSize: 15, color: '#6b7280' },
  saveText: { fontSize: 15, fontWeight: '700', color: '#111827' },
  saveTextDisabled: { color: '#9ca3af' },

  // Form
  formScroll: { padding: 20, gap: 16, paddingBottom: 48 },
  formSection: { marginBottom: 8 },
  formLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  inputBig: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 24,
    color: '#111827',
    fontWeight: '800',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    textAlign: 'center',
    letterSpacing: 2,
  },
  row: { flexDirection: 'row', gap: 12 },

  chipRow: { marginBottom: 4 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 100,
    backgroundColor: '#f9fafb',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  chipActive: { backgroundColor: '#111827', borderColor: '#111827' },
  chipText: { fontSize: 14, color: '#6b7280', fontWeight: '600' },
  chipTextActive: { color: '#ffffff', fontWeight: '700' },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    marginTop: 8,
  },
  toggleLabel: { fontSize: 16, color: '#111827', fontWeight: '600' },

  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
    paddingVertical: 16,
    backgroundColor: '#fef2f2',
    borderRadius: 16,
  },
  deleteButtonText: { color: '#ef4444', fontSize: 15, fontWeight: '600' },
});

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useToast } from '@/components/ui/Toast';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { StatusPill } from '@/components/ui/StatusPill';
import { Box, Package, ChevronRight, X, CheckCircle } from 'lucide-react-native';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { haptics } from '@/lib/haptics';
import type { ApiContainer, ApiContainerOrder, ContainerType, ContainerSize } from '@/lib/api';

// ─────────────────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<ContainerType, string> = {
  SKIP: 'Konteiners',
  ROLL_OFF: 'Piekabk. kont.',
  COMPACTOR: 'Kompaktors',
  HOOKLOADER: 'Āķkrāvējs',
  FLATBED: 'Platforma',
};

const SIZE_LABELS: Record<ContainerSize, string> = {
  SMALL: 'Mazs',
  MEDIUM: 'Vidējs',
  LARGE: 'Liels',
  EXTRA_LARGE: 'Ļoti liels',
};

const ORDER_STATUS_LABELS: Record<string, { label: string; bg: string; color: string }> = {
  PENDING: { label: 'Gaida', bg: '#f3f4f6', color: '#6b7280' },
  CONFIRMED: { label: 'Apstiprināts', bg: '#dbeafe', color: '#1d4ed8' },
  DELIVERED: { label: 'Nogādāts', bg: '#d1fae5', color: '#059669' },
  AWAITING_PICKUP: { label: 'Gaida izņemšanu', bg: '#fef3c7', color: '#d97706' },
  COLLECTED: { label: 'Savākts', bg: '#e0e7ff', color: '#4338ca' },
  COMPLETED: { label: 'Pabeigts', bg: '#dcfce7', color: '#15803d' },
  CANCELLED: { label: 'Atcelts', bg: '#fee2e2', color: '#b91c1c' },
};

// ─────────────────────────────────────────────────────────────────────────────

function ContainerCard({ item, onRent }: { item: ApiContainer; onRent: () => void }) {
  return (
    <TouchableOpacity style={s.card} onPress={onRent} activeOpacity={0.85}>
      <View style={s.cardIconBox}>
        <Box size={22} color="#dc2626" />
      </View>
      <View style={s.cardBody}>
        <Text style={s.cardType}>{TYPE_LABELS[item.containerType] ?? item.containerType}</Text>
        <Text style={s.cardSub}>
          {SIZE_LABELS[item.size] ?? item.size} · {item.volume} m³ · max{' '}
          {(item.maxWeight / 1000).toFixed(1)}t
        </Text>
        <Text style={s.cardLocation}>{item.owner.city}</Text>
      </View>
      <View style={s.cardRight}>
        <Text style={s.cardPrice}>€{item.rentalPrice.toFixed(0)}</Text>
        <Text style={s.cardPriceSub}>/dienā</Text>
        <ChevronRight size={16} color="#9ca3af" style={{ marginTop: 4 }} />
      </View>
    </TouchableOpacity>
  );
}

function OrderCard({ item }: { item: ApiContainerOrder }) {
  const st = ORDER_STATUS_LABELS[item.status] ?? {
    label: item.status,
    bg: '#f3f4f6',
    color: '#6b7280',
  };
  return (
    <View style={s.orderCard}>
      <View style={s.orderCardRow}>
        <Text style={s.orderCardType}>
          {TYPE_LABELS[item.container.containerType] ?? item.container.containerType}
        </Text>
        <StatusPill label={st.label} bg={st.bg} color={st.color} />
      </View>
      <Text style={s.orderCardSub}>
        {item.deliveryCity} · {item.rentalDays} d. · €{item.totalPrice.toFixed(2)}
      </Text>
      {item.deliveryDate && (
        <Text style={s.orderCardDate}>
          Piegāde: {new Date(item.deliveryDate).toLocaleDateString('lv-LV')}
        </Text>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function ContainersScreen() {
  const { token } = useAuth();
  const [tab, setTab] = useState<'browse' | 'mine'>('browse');

  // Browse
  const [containers, setContainers] = useState<ApiContainer[]>([]);
  const [loadingBrowse, setLoadingBrowse] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // My orders
  const [orders, setOrders] = useState<ApiContainerOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Rent modal
  const [selected, setSelected] = useState<ApiContainer | null>(null);
  const [rentForm, setRentForm] = useState({
    deliveryAddress: '',
    deliveryCity: '',
    rentalDays: '7',
    notes: '',
  });
  const [renting, setRenting] = useState(false);
  const toast = useToast();

  const loadContainers = useCallback(async () => {
    if (!token) return;
    try {
      const res = await api.containers.list({}, token);
      setContainers(res.data);
    } catch {
      // silent
    } finally {
      setLoadingBrowse(false);
      setRefreshing(false);
    }
  }, [token]);

  const loadOrders = useCallback(async () => {
    if (!token) return;
    setLoadingOrders(true);
    try {
      const res = await api.containers.myOrders(token);
      setOrders(res);
    } catch {
      // silent
    } finally {
      setLoadingOrders(false);
    }
  }, [token]);

  useEffect(() => {
    loadContainers();
  }, [loadContainers]);

  useEffect(() => {
    if (tab === 'mine') loadOrders();
  }, [tab, loadOrders]);

  const handleRent = async () => {
    if (!token || !selected) return;
    const days = parseInt(rentForm.rentalDays, 10);
    if (!rentForm.deliveryAddress.trim() || !rentForm.deliveryCity.trim()) {
      toast.error('Lūdzu ievadiet piegādes adresi un pilsētu.');
      return;
    }
    if (!days || days < 1) {
      toast.error('Ievadiet derīgu īres dienu skaitu.');
      return;
    }
    setRenting(true);
    try {
      await api.containers.rent(
        selected.id,
        {
          deliveryAddress: rentForm.deliveryAddress.trim(),
          deliveryCity: rentForm.deliveryCity.trim(),
          rentalDays: days,
          notes: rentForm.notes.trim() || undefined,
        },
        token,
      );
      haptics.success();
      setSelected(null);
      setRentForm({ deliveryAddress: '', deliveryCity: '', rentalDays: '7', notes: '' });
      setTab('mine');
      loadOrders();
      toast.success('Konteinera nomas pieprasījums pieņemts.');
    } catch (err: any) {
      haptics.error();
      toast.error(err?.message ?? 'Neizdevās pasūtīt konteineru.');
    } finally {
      setRenting(false);
    }
  };

  return (
    <ScreenContainer bg="#f2f2f7">
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Konteineri</Text>
        <Text style={s.headerSub}>Nomājiet konteineru atkritumu izvešanai</Text>
      </View>

      {/* Tabs */}
      <View style={s.tabRow}>
        <TouchableOpacity
          style={[s.tabBtn, tab === 'browse' && s.tabBtnActive]}
          onPress={() => setTab('browse')}
          activeOpacity={0.7}
        >
          <Text style={[s.tabBtnText, tab === 'browse' && s.tabBtnTextActive]}>Pieejamie</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tabBtn, tab === 'mine' && s.tabBtnActive]}
          onPress={() => setTab('mine')}
          activeOpacity={0.7}
        >
          <Text style={[s.tabBtnText, tab === 'mine' && s.tabBtnTextActive]}>Manie pasūtījumi</Text>
        </TouchableOpacity>
      </View>

      {/* Browse tab */}
      {tab === 'browse' && (
        <>
          {loadingBrowse ? (
            <ActivityIndicator color="#111827" style={{ marginTop: 40 }} />
          ) : containers.length === 0 ? (
            <View style={s.empty}>
              <Box size={48} color="#d1d5db" />
              <Text style={s.emptyText}>Nav pieejamu konteineru</Text>
            </View>
          ) : (
            <FlatList
              data={containers}
              keyExtractor={(i) => i.id}
              renderItem={({ item }) => (
                <ContainerCard item={item} onRent={() => setSelected(item)} />
              )}
              contentContainerStyle={{ padding: 16, gap: 10 }}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => {
                    setRefreshing(true);
                    loadContainers();
                  }}
                  tintColor="#111827"
                />
              }
            />
          )}
        </>
      )}

      {/* My orders tab */}
      {tab === 'mine' && (
        <>
          {loadingOrders ? (
            <ActivityIndicator color="#111827" style={{ marginTop: 40 }} />
          ) : orders.length === 0 ? (
            <View style={s.empty}>
              <Package size={48} color="#d1d5db" />
              <Text style={s.emptyText}>Nav aktīvu nomas pasūtījumu</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
              {orders.map((o) => (
                <OrderCard key={o.id} item={o} />
              ))}
            </ScrollView>
          )}
        </>
      )}

      {/* Rent modal */}
      <Modal
        visible={!!selected}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelected(null)}
      >
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <View>
              <Text style={s.modalTitle}>Nomāt konteineru</Text>
              {selected && (
                <Text style={s.modalSub}>
                  {TYPE_LABELS[selected.containerType]} · {SIZE_LABELS[selected.size]} ·{' '}
                  {selected.volume} m³
                </Text>
              )}
            </View>
            <TouchableOpacity onPress={() => setSelected(null)} style={s.modalClose}>
              <X size={20} color="#374151" />
            </TouchableOpacity>
          </View>

          {selected && (
            <ScrollView contentContainerStyle={s.modalScroll}>
              {/* Price summary */}
              <View style={s.priceBox}>
                <View style={s.priceRow}>
                  <Text style={s.priceLabel}>Noma/diena</Text>
                  <Text style={s.priceValue}>€{selected.rentalPrice.toFixed(2)}</Text>
                </View>
                <View style={s.priceRow}>
                  <Text style={s.priceLabel}>Piegāde</Text>
                  <Text style={s.priceValue}>€{selected.deliveryFee.toFixed(2)}</Text>
                </View>
                <View style={s.priceRow}>
                  <Text style={s.priceLabel}>Savākšana</Text>
                  <Text style={s.priceValue}>€{selected.pickupFee.toFixed(2)}</Text>
                </View>
              </View>

              <View style={s.formSection}>
                <Text style={s.formLabel}>PIEGĀDES ADRESE *</Text>
                <TextInput
                  style={s.input}
                  value={rentForm.deliveryAddress}
                  onChangeText={(v) => setRentForm((p) => ({ ...p, deliveryAddress: v }))}
                  placeholder="Iela, mājas nr."
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <View style={s.formSection}>
                <Text style={s.formLabel}>PILSĒTA *</Text>
                <TextInput
                  style={s.input}
                  value={rentForm.deliveryCity}
                  onChangeText={(v) => setRentForm((p) => ({ ...p, deliveryCity: v }))}
                  placeholder="Rīga"
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <View style={s.formSection}>
                <Text style={s.formLabel}>ĪRES DIENAS *</Text>
                <TextInput
                  style={s.input}
                  value={rentForm.rentalDays}
                  onChangeText={(v) => setRentForm((p) => ({ ...p, rentalDays: v }))}
                  keyboardType="number-pad"
                  placeholder="7"
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <View style={s.formSection}>
                <Text style={s.formLabel}>PIEZĪMES (pēc izvēles)</Text>
                <TextInput
                  style={[s.input, { height: 80, textAlignVertical: 'top' }]}
                  value={rentForm.notes}
                  onChangeText={(v) => setRentForm((p) => ({ ...p, notes: v }))}
                  placeholder="Piegādes īpatnības..."
                  placeholderTextColor="#9ca3af"
                  multiline
                />
              </View>

              {/* Total calc */}
              {parseInt(rentForm.rentalDays, 10) > 0 && (
                <View style={s.totalBox}>
                  <Text style={s.totalLabel}>Kopējā summa (aprēķins):</Text>
                  <Text style={s.totalValue}>
                    €
                    {(
                      selected.rentalPrice * (parseInt(rentForm.rentalDays, 10) || 0) +
                      selected.deliveryFee +
                      selected.pickupFee
                    ).toFixed(2)}
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={[s.rentBtn, renting && { opacity: 0.6 }]}
                onPress={handleRent}
                disabled={renting}
                activeOpacity={0.85}
              >
                {renting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <CheckCircle size={18} color="#fff" />
                    <Text style={s.rentBtnText}>Pasūtīt konteineru</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </Modal>
    </ScreenContainer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#111827' },
  headerSub: { fontSize: 14, color: '#6b7280', marginTop: 2 },

  tabRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 4 },
  tabBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  tabBtnActive: { backgroundColor: '#111827' },
  tabBtnText: { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  tabBtnTextActive: { color: '#fff' },

  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1 },
  cardType: { fontSize: 15, fontWeight: '600', color: '#111827' },
  cardSub: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  cardLocation: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  cardRight: { alignItems: 'flex-end' },
  cardPrice: { fontSize: 18, fontWeight: '700', color: '#111827' },
  cardPriceSub: { fontSize: 11, color: '#9ca3af' },

  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  orderCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  orderCardType: { fontSize: 15, fontWeight: '600', color: '#111827' },
  orderCardSub: { fontSize: 13, color: '#6b7280' },
  orderCardDate: { fontSize: 12, color: '#9ca3af', marginTop: 2 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyText: { fontSize: 15, color: '#9ca3af' },

  modal: { flex: 1, backgroundColor: '#fff' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#111827' },
  modalSub: { fontSize: 14, color: '#6b7280', marginTop: 2 },
  modalClose: { padding: 4 },
  modalScroll: { padding: 20, gap: 16 },

  priceBox: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between' },
  priceLabel: { fontSize: 14, color: '#6b7280' },
  priceValue: { fontSize: 14, fontWeight: '600', color: '#111827' },

  formSection: { gap: 6 },
  formLabel: { fontSize: 11, fontWeight: '700', color: '#6b7280', letterSpacing: 0.5 },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    color: '#111827',
  },

  totalBox: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: { fontSize: 14, color: '#374151' },
  totalValue: { fontSize: 20, fontWeight: '700', color: '#111827' },

  rentBtn: {
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  rentBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});

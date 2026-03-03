import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { t } from '@/lib/translations';

// ── Types ─────────────────────────────────────────────────────────────────────
type OrderStatus = 'PENDING' | 'CONFIRMED' | 'LOADING' | 'DISPATCHED';

interface IncomingOrder {
  id: string;
  orderNumber: string;
  material: string;
  weightTonnes: number;
  buyerName: string;
  deliveryAddress: string;
  requestedDate: string;
  price: number;
  status: OrderStatus;
}

// ── Mock data ─────────────────────────────────────────────────────────────────
const MOCK_ORDERS: IncomingOrder[] = [
  {
    id: 'o-001',
    orderNumber: 'ORD-2025-0041',
    material: 'Grants 0/45mm',
    weightTonnes: 26,
    buyerName: 'SIA BuildCo',
    deliveryAddress: 'Brīvības iela 23, Rīga',
    requestedDate: '29.04.2025',
    price: 312,
    status: 'PENDING',
  },
  {
    id: 'o-002',
    orderNumber: 'ORD-2025-0040',
    material: 'Smilts 0/4mm',
    weightTonnes: 18,
    buyerName: 'Jānis Bērziņš',
    deliveryAddress: 'Meža iela 5, Sigulda',
    requestedDate: '30.04.2025',
    price: 175,
    status: 'CONFIRMED',
  },
  {
    id: 'o-003',
    orderNumber: 'ORD-2025-0039',
    material: 'Šķembas 25/40mm',
    weightTonnes: 20,
    buyerName: 'SIA RoadWorks',
    deliveryAddress: 'Ventspils šoseja km 12',
    requestedDate: '28.04.2025',
    price: 280,
    status: 'LOADING',
  },
];

const STATUS_COLORS: Record<OrderStatus, { bg: string; text: string; label: string }> = {
  PENDING: { bg: '#fef3c7', text: '#d97706', label: '⏳ Jauns' },
  CONFIRMED: { bg: '#dbeafe', text: '#2563eb', label: '✅ Apstiprināts' },
  LOADING: { bg: '#fce7f3', text: '#db2777', label: '📦 Iekraušana' },
  DISPATCHED: { bg: '#dcfce7', text: '#16a34a', label: '🚛 Nosūtīts' },
};

// ── Loading confirmation modal (BeladeFLIX-style) ────────────────────────────
function LoadingModal({
  order,
  visible,
  onClose,
  onConfirm,
}: {
  order: IncomingOrder;
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={modalStyles.container} edges={['top', 'bottom']}>
        <View style={modalStyles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={modalStyles.closeBtn}>✕</Text>
          </TouchableOpacity>
          <Text style={modalStyles.title}>{t.incoming.loading}</Text>
          <View style={{ width: 32 }} />
        </View>

        <ScrollView contentContainerStyle={modalStyles.body}>
          {/* Order summary */}
          <View style={modalStyles.summaryCard}>
            <Text style={modalStyles.orderNum}>#{order.orderNumber}</Text>
            <Text style={modalStyles.materialText}>{order.material}</Text>
            <View style={modalStyles.summaryRow}>
              <Text style={modalStyles.summaryLabel}>Svars</Text>
              <Text style={modalStyles.summaryValue}>{order.weightTonnes}t</Text>
            </View>
            <View style={modalStyles.summaryRow}>
              <Text style={modalStyles.summaryLabel}>Pircējs</Text>
              <Text style={modalStyles.summaryValue}>{order.buyerName}</Text>
            </View>
            <View style={modalStyles.summaryRow}>
              <Text style={modalStyles.summaryLabel}>Adrese</Text>
              <Text style={modalStyles.summaryValue}>{order.deliveryAddress}</Text>
            </View>
            <View style={modalStyles.summaryRow}>
              <Text style={modalStyles.summaryLabel}>Datums</Text>
              <Text style={modalStyles.summaryValue}>{order.requestedDate}</Text>
            </View>
          </View>

          {/* Checklist */}
          <View style={modalStyles.checklistCard}>
            <Text style={modalStyles.checklistTitle}>Pirms iekraušanas pārbaudīt:</Text>
            {[
              'Kravas automašīna atrodas pareizajā vietā',
              'Svars sakrīt ar pasūtījumu',
              'Materiāls ir pareizs un kvalitatīvs',
              'Vadītājs ir klāt un gatavs',
            ].map((item, i) => (
              <View key={i} style={modalStyles.checkRow}>
                <Text style={modalStyles.checkIcon}>☐</Text>
                <Text style={modalStyles.checkText}>{item}</Text>
              </View>
            ))}
          </View>
        </ScrollView>

        {/* Confirm button */}
        <View style={modalStyles.footer}>
          <Text style={modalStyles.footerDesc}>{t.incoming.loadingDesc}</Text>
          <TouchableOpacity style={modalStyles.confirmBtn} onPress={onConfirm}>
            <Text style={modalStyles.confirmBtnText}>{t.incoming.confirmLoad}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// ── Order card ────────────────────────────────────────────────────────────────
function OrderCard({
  order,
  onConfirm,
  onReject,
  onStartLoading,
}: {
  order: IncomingOrder;
  onConfirm: (id: string) => void;
  onReject: (id: string) => void;
  onStartLoading: (id: string) => void;
}) {
  const statusInfo = STATUS_COLORS[order.status];

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <Text style={styles.orderNumber}>#{order.orderNumber}</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
          <Text style={[styles.statusText, { color: statusInfo.text }]}>{statusInfo.label}</Text>
        </View>
      </View>

      {/* Material info */}
      <View style={styles.materialRow}>
        <Text style={styles.materialName}>{order.material}</Text>
        <Text style={styles.weightTag}>{order.weightTonnes}t</Text>
      </View>

      {/* Details */}
      <View style={styles.detailsGrid}>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Pircējs</Text>
          <Text style={styles.detailValue}>{order.buyerName}</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Datums</Text>
          <Text style={styles.detailValue}>{order.requestedDate}</Text>
        </View>
        <View style={[styles.detailItem, { flex: 2 }]}>
          <Text style={styles.detailLabel}>📍 Adrese</Text>
          <Text style={styles.detailValue}>{order.deliveryAddress}</Text>
        </View>
      </View>

      {/* Price row */}
      <View style={styles.priceRow}>
        <Text style={styles.priceLabel}>Summa</Text>
        <Text style={styles.priceValue}>€{order.price}</Text>
      </View>

      {/* Actions based on status */}
      {order.status === 'PENDING' && (
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.rejectBtn} onPress={() => onReject(order.id)}>
            <Text style={styles.rejectBtnText}>{t.incoming.reject}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.confirmBtn} onPress={() => onConfirm(order.id)}>
            <Text style={styles.confirmBtnText}>{t.incoming.confirm} ✓</Text>
          </TouchableOpacity>
        </View>
      )}

      {order.status === 'CONFIRMED' && (
        <TouchableOpacity style={styles.loadingBtn} onPress={() => onStartLoading(order.id)}>
          <Text style={styles.loadingBtnText}>📦 {t.incoming.confirmLoad}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function IncomingScreen() {
  const [orders, setOrders] = useState<IncomingOrder[]>(MOCK_ORDERS);
  const [loadingOrder, setLoadingOrder] = useState<IncomingOrder | null>(null);

  const handleConfirm = (id: string) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status: 'CONFIRMED' as OrderStatus } : o)),
    );
  };

  const handleReject = (id: string) => {
    Alert.alert(t.incoming.reject, 'Vai tiešām noraidīt šo pasūtījumu?', [
      { text: 'Atcelt', style: 'cancel' },
      {
        text: 'Noraidīt',
        style: 'destructive',
        onPress: () => setOrders((prev) => prev.filter((o) => o.id !== id)),
      },
    ]);
  };

  const handleStartLoading = (id: string) => {
    const order = orders.find((o) => o.id === id);
    if (order) setLoadingOrder(order);
  };

  const handleConfirmLoad = () => {
    if (loadingOrder) {
      setOrders((prev) =>
        prev.map((o) =>
          o.id === loadingOrder.id ? { ...o, status: 'DISPATCHED' as OrderStatus } : o,
        ),
      );
      setLoadingOrder(null);
      Alert.alert('✅ Iekraušana apstiprināta', 'Transporta darbs sākts. Pircējs ir informēts.');
    }
  };

  const pendingCount = orders.filter((o) => o.status === 'PENDING').length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t.incoming.title}</Text>
        {pendingCount > 0 && (
          <View style={styles.pendingBadge}>
            <Text style={styles.pendingBadgeText}>{pendingCount} jauns</Text>
          </View>
        )}
      </View>

      {orders.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>📭</Text>
          <Text style={styles.emptyTitle}>{t.incoming.empty}</Text>
          <Text style={styles.emptyDesc}>{t.incoming.emptyDesc}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onConfirm={handleConfirm}
              onReject={handleReject}
              onStartLoading={handleStartLoading}
            />
          ))}
        </ScrollView>
      )}

      {/* Loading modal */}
      {loadingOrder && (
        <LoadingModal
          order={loadingOrder}
          visible={!!loadingOrder}
          onClose={() => setLoadingOrder(null)}
          onConfirm={handleConfirmLoad}
        />
      )}
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 10,
  },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#111827', flex: 1 },
  pendingBadge: {
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  pendingBadgeText: { color: '#d97706', fontWeight: '700', fontSize: 12 },

  list: { padding: 16, gap: 12 },

  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    gap: 12,
  },

  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderNumber: { fontSize: 12, fontWeight: '600', color: '#6b7280', letterSpacing: 0.5 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 12, fontWeight: '700' },

  materialRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  materialName: { fontSize: 18, fontWeight: '700', color: '#111827', flex: 1 },
  weightTag: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
  },

  detailsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  detailItem: { flex: 1, minWidth: '40%' },
  detailLabel: {
    fontSize: 11,
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  detailValue: { fontSize: 14, fontWeight: '600', color: '#111827' },

  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  priceLabel: { fontSize: 13, color: '#6b7280' },
  priceValue: { fontSize: 22, fontWeight: '800', color: '#16a34a' },

  actionsRow: { flexDirection: 'row', gap: 10 },
  rejectBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#fca5a5',
    alignItems: 'center',
  },
  rejectBtnText: { fontSize: 14, fontWeight: '600', color: '#dc2626' },
  confirmBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#16a34a',
    alignItems: 'center',
  },
  confirmBtnText: { fontSize: 14, fontWeight: '700', color: '#ffffff' },

  loadingBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#db2777',
    alignItems: 'center',
  },
  loadingBtnText: { fontSize: 14, fontWeight: '700', color: '#ffffff' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#374151' },
  emptyDesc: { fontSize: 14, color: '#9ca3af', textAlign: 'center' },
});

const modalStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  closeBtn: { fontSize: 18, color: '#6b7280', fontWeight: '600', padding: 6 },
  title: { fontSize: 17, fontWeight: '700', color: '#111827' },

  body: { padding: 20, gap: 16 },

  summaryCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 14,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  orderNum: { fontSize: 12, color: '#9ca3af', fontWeight: '600', letterSpacing: 0.5 },
  materialText: { fontSize: 20, fontWeight: '800', color: '#111827' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { fontSize: 13, color: '#6b7280' },
  summaryValue: { fontSize: 13, fontWeight: '600', color: '#111827' },

  checklistCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  checklistTitle: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 4 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkIcon: { fontSize: 18, color: '#9ca3af' },
  checkText: { fontSize: 14, color: '#374151', flex: 1 },

  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 10,
  },
  footerDesc: { fontSize: 13, color: '#6b7280', textAlign: 'center' },
  confirmBtn: {
    backgroundColor: '#db2777',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  confirmBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 16 },
});

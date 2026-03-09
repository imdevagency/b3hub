/**
 * invoices.tsx — Buyer: invoice list with status badges
 *
 * Lists all invoices for the logged-in buyer, grouped by status.
 * Tapping an invoice shows totals + VAT + due date + order link.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import {
  FileText,
  X,
  CheckCircle2,
  Clock,
  AlertCircle,
  Package,
  CreditCard,
  Calendar,
  Receipt,
} from 'lucide-react-native';
import { useAuth } from '@/lib/auth-context';
import { api, type ApiInvoice, type InvoiceStatus } from '@/lib/api';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { haptics } from '@/lib/haptics';
import { useToast } from '@/components/ui/Toast';

// ── Helpers ────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('lv-LV', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function fmtEur(n: number): string {
  return `€${n.toFixed(2)}`;
}

const STATUS_META: Record<
  InvoiceStatus,
  { label: string; bg: string; color: string; icon: React.ReactNode }
> = {
  DRAFT: {
    label: 'Melnraksts',
    bg: '#f3f4f6',
    color: '#6b7280',
    icon: <FileText size={13} color="#6b7280" />,
  },
  ISSUED: {
    label: 'Izrakstīts',
    bg: '#dbeafe',
    color: '#1d4ed8',
    icon: <Clock size={13} color="#1d4ed8" />,
  },
  PAID: {
    label: 'Apmaksāts',
    bg: '#dcfce7',
    color: '#15803d',
    icon: <CheckCircle2 size={13} color="#15803d" />,
  },
  OVERDUE: {
    label: 'Kavēts',
    bg: '#fee2e2',
    color: '#b91c1c',
    icon: <AlertCircle size={13} color="#b91c1c" />,
  },
  CANCELLED: {
    label: 'Atcelts',
    bg: '#f3f4f6',
    color: '#9ca3af',
    icon: <X size={13} color="#9ca3af" />,
  },
};

// ── Invoice row ────────────────────────────────────────────────

function InvoiceRow({ invoice, onPress }: { invoice: ApiInvoice; onPress: () => void }) {
  const meta = STATUS_META[invoice.status];
  const overdue =
    invoice.status === 'OVERDUE' ||
    (invoice.status === 'ISSUED' &&
      invoice.dueDate != null &&
      new Date(invoice.dueDate) < new Date());

  return (
    <TouchableOpacity style={s.row} onPress={onPress} activeOpacity={0.75}>
      <View style={[s.rowIcon, { backgroundColor: overdue ? '#fee2e2' : '#f0fdf4' }]}>
        <Receipt size={20} color={overdue ? '#ef4444' : '#16a34a'} />
      </View>
      <View style={s.rowBody}>
        <Text style={s.rowNum}>#{invoice.invoiceNumber}</Text>
        {invoice.order && <Text style={s.rowOrder}>Pasūt. #{invoice.order.orderNumber}</Text>}
        <Text style={s.rowDate}>
          {invoice.dueDate
            ? `Termiņš: ${fmtDate(invoice.dueDate)}`
            : `Izrakstīts: ${fmtDate(invoice.issuedAt)}`}
        </Text>
      </View>
      <View style={s.rowRight}>
        <Text style={s.rowTotal}>{fmtEur(invoice.total)}</Text>
        <View style={[s.badge, { backgroundColor: meta.bg }]}>
          {meta.icon}
          <Text style={[s.badgeText, { color: meta.color }]}>{meta.label}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Detail modal ───────────────────────────────────────────────

function InvoiceModal({
  invoice,
  onClose,
  onPay,
  paying,
}: {
  invoice: ApiInvoice;
  onClose: () => void;
  onPay: () => void;
  paying: boolean;
}) {
  const meta = STATUS_META[invoice.status];

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={m.backdrop}>
        <View style={m.sheet}>
          <View style={m.handle} />

          {/* Header */}
          <View style={m.header}>
            <View>
              <Text style={m.title}>Rēķins #{invoice.invoiceNumber}</Text>
              {invoice.order && <Text style={m.sub}>Pasūtījums #{invoice.order.orderNumber}</Text>}
            </View>
            <TouchableOpacity style={m.closeBtn} onPress={onClose}>
              <X size={18} color="#6b7280" />
            </TouchableOpacity>
          </View>

          {/* Status pill */}
          <View style={[m.statusPill, { backgroundColor: meta.bg }]}>
            {meta.icon}
            <Text style={[m.statusText, { color: meta.color }]}>{meta.label}</Text>
          </View>

          {/* Amounts */}
          <View style={m.amountBlock}>
            <View style={m.amountRow}>
              <Text style={m.amountLabel}>Bez PVN</Text>
              <Text style={m.amountVal}>{fmtEur(invoice.subtotal)}</Text>
            </View>
            <View style={m.amountRow}>
              <Text style={m.amountLabel}>PVN (21%)</Text>
              <Text style={m.amountVal}>{fmtEur(invoice.vatAmount)}</Text>
            </View>
            <View style={[m.amountRow, m.amountTotalRow]}>
              <Text style={m.amountTotalLabel}>Kopā</Text>
              <Text style={m.amountTotal}>{fmtEur(invoice.total)}</Text>
            </View>
          </View>

          {/* Dates */}
          <View style={m.datesRow}>
            <View style={m.dateCard}>
              <Calendar size={16} color="#6b7280" />
              <Text style={m.dateLabel}>Izrakstīts</Text>
              <Text style={m.dateVal}>{fmtDate(invoice.issuedAt)}</Text>
            </View>
            <View style={m.dateCard}>
              <Clock size={16} color="#d97706" />
              <Text style={m.dateLabel}>Apmaksas termiņš</Text>
              <Text style={m.dateVal}>{fmtDate(invoice.dueDate)}</Text>
            </View>
            {invoice.paidAt && (
              <View style={m.dateCard}>
                <CheckCircle2 size={16} color="#16a34a" />
                <Text style={m.dateLabel}>Apmaksāts</Text>
                <Text style={m.dateVal}>{fmtDate(invoice.paidAt)}</Text>
              </View>
            )}
          </View>

          {/* Pay button — shown only for ISSUED / OVERDUE */}
          {(invoice.status === 'ISSUED' || invoice.status === 'OVERDUE') && (
            <TouchableOpacity
              style={[m.payBtn, paying && m.payBtnDisabled]}
              onPress={onPay}
              disabled={paying}
              activeOpacity={0.85}
            >
              {paying ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <CreditCard size={18} color="#fff" />
                  <Text style={m.payBtnText}>Apstiprināt apmaksu — {fmtEur(invoice.total)}</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ── Main screen ────────────────────────────────────────────────

export default function InvoicesScreen() {
  const { token } = useAuth();
  const toast = useToast();
  const [invoices, setInvoices] = useState<ApiInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<ApiInvoice | null>(null);
  const [paying, setPaying] = useState(false);

  // Filter
  const [filter, setFilter] = useState<InvoiceStatus | 'ALL'>('ALL');

  const load = useCallback(
    async (silent = false) => {
      if (!token) return;
      if (!silent) setLoading(true);
      try {
        const data = await api.invoices.getAll(token);
        setInvoices(data);
      } catch {
        // silent fail — show empty state
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

  const onRefresh = () => {
    setRefreshing(true);
    load(true);
  };

  const handlePay = async () => {
    if (!selected || !token) return;
    setPaying(true);
    try {
      await api.invoices.markAsPaid(selected.id, token);
      await load(true);
      setSelected(null);
      haptics.success();
      toast.success('Rēķins ir veiksmīgi apmaksāts!');
    } catch (err) {
      haptics.error();
      toast.error(err instanceof Error ? err.message : 'Neizdevās apstrādāt apmaksu.');
    } finally {
      setPaying(false);
    }
  };

  const FILTERS: { key: InvoiceStatus | 'ALL'; label: string }[] = [
    { key: 'ALL', label: 'Visi' },
    { key: 'ISSUED', label: 'Gaida' },
    { key: 'OVERDUE', label: 'Kavēti' },
    { key: 'PAID', label: 'Apmaksāti' },
  ];

  const visible = filter === 'ALL' ? invoices : invoices.filter((i) => i.status === filter);

  // Stats
  const totalOwed = invoices
    .filter((i) => i.status === 'ISSUED' || i.status === 'OVERDUE')
    .reduce((s, i) => s + i.total, 0);
  const overdueCount = invoices.filter((i) => i.status === 'OVERDUE').length;

  if (loading) {
    return (
      <ScreenContainer>
        <SkeletonCard count={4} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      {/* ── Hero header ── */}
      <View style={s.hero}>
        <Text style={s.heroSuper}>Rēķini</Text>
        <Text style={s.heroAmount}>{fmtEur(totalOwed)}</Text>
        <Text style={s.heroSub}>
          {overdueCount > 0
            ? `${overdueCount} kavēts rēķins — ${fmtEur(totalOwed)} jāsamaksā`
            : invoices.length > 0
              ? 'Visi rēķini kārtībā'
              : 'Nav rēķinu'}
        </Text>
      </View>

      {/* ── Filter chips ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.filtersRow}
      >
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[s.chip, filter === f.key && s.chipActive]}
            onPress={() => setFilter(f.key)}
            activeOpacity={0.75}
          >
            <Text style={[s.chipText, filter === f.key && s.chipTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── List ── */}
      <ScrollView
        style={s.list}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#dc2626" />
        }
      >
        {visible.length === 0 ? (
          <View style={s.empty}>
            <FileText size={40} color="#d1d5db" />
            <Text style={s.emptyTitle}>Nav rēķinu</Text>
            <Text style={s.emptySub}>Rēķini parādīsies, kad pasūtījumi tiks apstiprināti.</Text>
          </View>
        ) : (
          <View style={s.card}>
            {visible.map((inv, idx) => (
              <View key={inv.id}>
                <InvoiceRow invoice={inv} onPress={() => setSelected(inv)} />
                {idx < visible.length - 1 && <View style={s.divider} />}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* ── Detail modal ── */}
      {selected && (
        <InvoiceModal
          invoice={selected}
          onClose={() => setSelected(null)}
          onPay={handlePay}
          paying={paying}
        />
      )}
    </ScreenContainer>
  );
}

// ── Styles ─────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f2f2f7' },

  hero: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 28,
  },
  heroSuper: { fontSize: 13, color: '#fca5a5', fontWeight: '500' },
  heroAmount: { fontSize: 40, fontWeight: '800', color: '#fff', marginTop: 4, letterSpacing: -1 },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4 },

  filtersRow: { paddingHorizontal: 16, paddingVertical: 14, gap: 8 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  chipActive: { backgroundColor: '#dc2626', borderColor: '#dc2626' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  chipTextActive: { color: '#fff' },

  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingBottom: 40, gap: 12 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rowBody: { flex: 1, gap: 2 },
  rowNum: { fontSize: 14, fontWeight: '700', color: '#111827' },
  rowOrder: { fontSize: 12, color: '#6b7280' },
  rowDate: { fontSize: 11, color: '#9ca3af', marginTop: 1 },
  rowRight: { alignItems: 'flex-end', gap: 4 },
  rowTotal: { fontSize: 15, fontWeight: '800', color: '#111827' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeText: { fontSize: 10, fontWeight: '700' },

  divider: { height: 1, backgroundColor: '#f3f4f6', marginHorizontal: 16 },

  empty: {
    backgroundColor: '#fff',
    borderRadius: 16,
    alignItems: 'center',
    paddingVertical: 48,
    gap: 10,
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#374151' },
  emptySub: { fontSize: 13, color: '#9ca3af', textAlign: 'center', paddingHorizontal: 24 },
});

// ── Modal styles ───────────────────────────────────────────────

const m = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 12,
    gap: 16,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 999,
    alignSelf: 'center',
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: { fontSize: 20, fontWeight: '800', color: '#111827' },
  sub: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusText: { fontSize: 12, fontWeight: '700' },
  amountBlock: {
    backgroundColor: '#f9fafb',
    borderRadius: 14,
    padding: 16,
    gap: 8,
  },
  amountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  amountLabel: { fontSize: 14, color: '#6b7280' },
  amountVal: { fontSize: 14, color: '#374151', fontWeight: '500' },
  amountTotalRow: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 10,
    marginTop: 2,
  },
  amountTotalLabel: { fontSize: 16, fontWeight: '700', color: '#111827' },
  amountTotal: { fontSize: 18, fontWeight: '800', color: '#111827' },
  datesRow: { flexDirection: 'row', gap: 10 },
  dateCard: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    gap: 4,
  },
  dateLabel: { fontSize: 10, color: '#9ca3af', fontWeight: '500', textAlign: 'center' },
  dateVal: { fontSize: 13, fontWeight: '700', color: '#374151', textAlign: 'center' },
  payBtn: {
    backgroundColor: '#dc2626',
    borderRadius: 999,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  payBtnDisabled: { backgroundColor: '#f87171' },
  payBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

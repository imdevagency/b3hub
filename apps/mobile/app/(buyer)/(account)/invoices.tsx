/**
 * invoices.tsx — Buyer: invoice list (Uber-style clean finance UI)
 */

import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Linking,
} from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import {
  FileText,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  ChevronRight,
  Download,
  ExternalLink,
} from 'lucide-react-native';
import { useAuth } from '@/lib/auth-context';
import { api, type ApiInvoice, type InvoiceStatus } from '@/lib/api';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { haptics } from '@/lib/haptics';
import { useToast } from '@/components/ui/Toast';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusPill } from '@/components/ui/StatusPill';
import { API_URL } from '@/lib/api/common';
import { colors } from '@/lib/theme';

const WEB_INVOICES_URL = 'https://b3hub.lv/dashboard/invoices';

// Guard: expo-file-system / expo-sharing — available in dev builds and Expo Go
let FileSystem: typeof import('expo-file-system') | null = null;
let Sharing: typeof import('expo-sharing') | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
  FileSystem = require('expo-file-system');
  // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
  Sharing = require('expo-sharing');
} catch {
  /* fallback — download unavailable */
}

// ── Helpers ────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('lv-LV', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function fmtEur(n: number): string {
  return `€${n.toFixed(2)}`;
}

const STATUS_META: Record<InvoiceStatus, { label: string; bg: string; color: string }> = {
  DRAFT: { label: 'Melnraksts', bg: '#f3f4f6', color: colors.textMuted },
  ISSUED: { label: 'Gaida apmaksu', bg: '#eff6ff', color: '#1d4ed8' },
  PAID: { label: 'Apmaksāts', bg: '#dcfce7', color: colors.successText },
  OVERDUE: { label: 'Kavēts', bg: '#fee2e2', color: colors.dangerText },
  CANCELLED: { label: 'Atcelts', bg: '#f3f4f6', color: colors.textDisabled },
};

// ── Invoice row ────────────────────────────────────────────────

function InvoiceRow({ invoice, onPress }: { invoice: ApiInvoice; onPress: () => void }) {
  const meta = STATUS_META[invoice.status];
  const isActionable = invoice.status === 'ISSUED' || invoice.status === 'OVERDUE';

  return (
    <TouchableOpacity style={s.row} onPress={onPress} activeOpacity={0.6}>
      <View style={s.rowLeft}>
        <View style={s.rowTopLine}>
          <Text style={s.rowNum}>Rēķins #{invoice.invoiceNumber}</Text>
          <Text style={[s.rowAmount, isActionable && s.rowAmountDue]}>{fmtEur(invoice.total)}</Text>
        </View>
        <View style={s.rowBottomLine}>
          <StatusPill label={meta.label} bg={meta.bg} color={meta.color} size="sm" />
          <Text style={s.rowDate}>
            {invoice.dueDate ? `Termiņš ${fmtDate(invoice.dueDate)}` : fmtDate(invoice.issuedAt)}
          </Text>
        </View>
        {invoice.order && <Text style={s.rowOrder}>Pasūtījums #{invoice.order.orderNumber}</Text>}
      </View>
      <ChevronRight size={16} color="#d1d5db" />
    </TouchableOpacity>
  );
}

// ── Detail modal ───────────────────────────────────────────────

function InvoiceModal({
  invoice,
  visible,
  onClose,
  onDownload,
  downloading,
}: {
  invoice: ApiInvoice | null;
  visible: boolean;
  onClose: () => void;
  onDownload: () => void;
  downloading: boolean;
}) {
  const lastRef = useRef<ApiInvoice | null>(invoice);
  if (invoice) lastRef.current = invoice;
  const inv = invoice ?? lastRef.current;
  if (!inv) return null;

  const meta = STATUS_META[inv.status];
  const isActionable = inv.status === 'ISSUED' || inv.status === 'OVERDUE';

  return (
    <BottomSheet visible={visible} onClose={onClose} scrollable>
      <View style={{ gap: 0, paddingBottom: 8 }}>
        {/* Amount hero */}
        <View style={m.amountHero}>
          <Text style={m.amountHeroLabel}>Kopā jāmaksā</Text>
          <Text style={[m.amountHeroVal, isActionable && { color: colors.textPrimary }]}>
            {fmtEur(inv.total)}
          </Text>
          <StatusPill label={meta.label} bg={meta.bg} color={meta.color} size="md" />
        </View>

        {/* Reference */}
        <View style={m.refRow}>
          <Text style={m.refLabel}>Rēķins</Text>
          <Text style={m.refVal}>#{inv.invoiceNumber}</Text>
        </View>
        {inv.order && (
          <View style={m.refRow}>
            <Text style={m.refLabel}>Pasūtījums</Text>
            <Text style={m.refVal}>#{inv.order.orderNumber}</Text>
          </View>
        )}

        <View style={m.divider} />

        {/* Line items */}
        <View style={m.lineItem}>
          <Text style={m.lineLabel}>Summa bez PVN</Text>
          <Text style={m.lineVal}>{fmtEur(inv.subtotal)}</Text>
        </View>
        <View style={m.lineItem}>
          <Text style={m.lineLabel}>PVN (21%)</Text>
          <Text style={m.lineVal}>{fmtEur(inv.vatAmount)}</Text>
        </View>
        <View style={[m.lineItem, m.lineItemTotal]}>
          <Text style={m.lineTotalLabel}>Kopā</Text>
          <Text style={m.lineTotalVal}>{fmtEur(inv.total)}</Text>
        </View>

        <View style={m.divider} />

        {/* Dates */}
        <View style={m.lineItem}>
          <Text style={m.lineLabel}>Izrakstīts</Text>
          <Text style={m.lineVal}>{fmtDate(inv.issuedAt)}</Text>
        </View>
        {inv.dueDate && (
          <View style={m.lineItem}>
            <Text style={m.lineLabel}>Apmaksas termiņš</Text>
            <Text
              style={[
                m.lineVal,
                inv.status === 'OVERDUE' && { color: colors.danger, fontWeight: '700' },
              ]}
            >
              {fmtDate(inv.dueDate)}
            </Text>
          </View>
        )}
        {inv.paidAt && (
          <View style={m.lineItem}>
            <Text style={m.lineLabel}>Apmaksāts</Text>
            <Text style={[m.lineVal, { color: '#16a34a' }]}>{fmtDate(inv.paidAt)}</Text>
          </View>
        )}

        {/* Payment instructions */}
        {isActionable && (
          <View style={m.payInfo}>
            <CreditCard size={16} color="#2563eb" />
            <Text style={m.payInfoText}>
              Lūdzu veiciet pārskaitījumu uz B3Hub bankas kontu. Maksājums tiks apstiprināts
              automātiski pēc bankas apstrādes.
            </Text>
          </View>
        )}

        {/* Download PDF CTA */}
        <TouchableOpacity
          style={[m.downloadBtn, downloading && m.downloadBtnDisabled]}
          onPress={onDownload}
          disabled={downloading}
          activeOpacity={0.85}
        >
          {downloading ? (
            <ActivityIndicator color="#111827" />
          ) : (
            <>
              <Download size={18} color="#111827" />
              <Text style={m.downloadBtnText}>Lejupielādēt PDF</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );
}

// ── Main screen ────────────────────────────────────────────────

const FILTERS: { key: InvoiceStatus | 'ALL'; label: string }[] = [
  { key: 'ALL', label: 'Visi' },
  { key: 'ISSUED', label: 'Gaida' },
  { key: 'OVERDUE', label: 'Kavēti' },
  { key: 'PAID', label: 'Apmaksāti' },
];

export default function InvoicesScreen() {
  const { token, user } = useAuth();
  const toast = useToast();
  const [invoices, setInvoices] = useState<ApiInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<ApiInvoice | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [filter, setFilter] = useState<InvoiceStatus | 'ALL'>('ALL');

  // Company members without permViewFinancials cannot see invoice data.
  const canViewFinancials = !user?.companyRole || (user?.permViewFinancials ?? false);

  const load = useCallback(
    async (silent = false) => {
      if (!token) return;
      if (!silent) setLoading(true);
      try {
        const data = await api.invoices.getAll(token);
        setInvoices(Array.isArray(data) ? data : []);
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

  const handleDownload = async () => {
    if (!selected || !token || !FileSystem || !Sharing) {
      toast.error('Lejupielāde nav pieejama šajā ierīcē.');
      return;
    }
    setDownloading(true);
    haptics.light();
    try {
      const url = `${API_URL}/invoices/${selected.id}/pdf`;
      const fileUri = `${(FileSystem as any).documentDirectory ?? ''}invoice-${selected.invoiceNumber}.pdf`;

      const downloadRes = await FileSystem.downloadAsync(url, fileUri, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (downloadRes.status !== 200) {
        throw new Error('Neizdevās lejupielādēt PDF');
      }

      if (Platform.OS === 'ios') {
        await Sharing.shareAsync(downloadRes.uri, {
          UTI: 'com.adobe.pdf',
          mimeType: 'application/pdf',
        });
      } else {
        await Sharing.shareAsync(downloadRes.uri);
      }
      haptics.success();
    } catch (err) {
      haptics.error();
      toast.error(err instanceof Error ? err.message : 'Neizdevās piekļūt rēķinam.');
    } finally {
      setDownloading(false);
    }
  };

  const visible = filter === 'ALL' ? invoices : invoices.filter((i) => i.status === filter);
  const totalOwed = invoices
    .filter((i) => i.status === 'ISSUED' || i.status === 'OVERDUE')
    .reduce((s, i) => s + i.total, 0);
  const overdueCount = invoices.filter((i) => i.status === 'OVERDUE').length;
  const paidCount = invoices.filter((i) => i.status === 'PAID').length;

  if (loading) {
    return (
      <ScreenContainer bg="#fff">
        <ScreenHeader title="Rēķini" />
        <View style={{ padding: 20 }}>
          <SkeletonCard count={4} />
        </View>
      </ScreenContainer>
    );
  }

  if (!canViewFinancials) {
    return (
      <ScreenContainer bg="#fff">
        <ScreenHeader title="Rēķini" />
        <EmptyState
          icon={<AlertCircle size={32} color="#d1d5db" />}
          title="Nepietiekamas tiesības"
          subtitle="Lūdzu sazinieties ar uzņēmuma administratoru, lai piešķirtu piekļuvi finansēm."
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer bg="#fff">
      <ScreenHeader title="Rēķini" />
      {/* ── Summary ── */}
      <View style={s.summary}>
        <View style={s.summaryMain}>
          <Text style={s.summaryLabel}>Apmaksājams</Text>
          <Text style={s.summaryAmount}>{fmtEur(totalOwed)}</Text>
        </View>
        <View style={s.summaryCaps}>
          {overdueCount > 0 && (
            <View style={[s.summaryChip, s.summaryChipRed]}>
              <AlertCircle size={12} color="#dc2626" />
              <Text style={[s.summaryChipText, { color: colors.danger }]}>
                {overdueCount} kavēts
              </Text>
            </View>
          )}
          {paidCount > 0 && (
            <View style={[s.summaryChip, s.summaryChipGreen]}>
              <CheckCircle2 size={12} color="#16a34a" />
              <Text style={[s.summaryChipText, { color: '#16a34a' }]}>{paidCount} apmaksāts</Text>
            </View>
          )}
          {invoices.length === 0 && <Text style={s.summaryEmpty}>Nav rēķinu</Text>}
        </View>
      </View>

      {/* ── Web banner ── */}
      <TouchableOpacity
        style={s.webBanner}
        onPress={() => {
          haptics.light();
          Linking.openURL(WEB_INVOICES_URL);
        }}
        activeOpacity={0.85}
      >
        <View style={{ flex: 1 }}>
          <Text style={s.webBannerTitle}>Finanšu pārskats un CSV eksports</Text>
          <Text style={s.webBannerSub}>Pilna grāmatvedība — b3hub.lv</Text>
        </View>
        <ExternalLink size={16} color="#2563eb" />
      </TouchableOpacity>

      {/* ── Segmented filter ── */}
      <View style={s.segmentWrap}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[s.segment, filter === f.key && s.segmentActive]}
            onPress={() => {
              haptics.light();
              setFilter(f.key);
            }}
            activeOpacity={0.7}
          >
            <Text style={[s.segmentText, filter === f.key && s.segmentTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── List ── */}
      <ScrollView
        style={s.list}
        contentContainerStyle={visible.length === 0 ? s.listEmpty : s.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00A878" />
        }
      >
        {visible.length === 0 ? (
          <EmptyState
            icon={<FileText size={32} color="#9ca3af" />}
            title="Nav rēķinu"
            subtitle={
              filter === 'ALL'
                ? 'Rēķini parādīsīsies, kad pasūtījumi tiks apstiprrināti.'
                : 'Nav rēķinu šajā kategorijā.'
            }
          />
        ) : (
          <>
            {visible.map((inv, idx) => (
              <View key={inv.id}>
                <InvoiceRow
                  invoice={inv}
                  onPress={() => {
                    haptics.light();
                    setSelected(inv);
                  }}
                />
                {idx < visible.length - 1 && <View style={s.divider} />}
              </View>
            ))}
          </>
        )}
      </ScrollView>

      <InvoiceModal
        invoice={selected}
        visible={!!selected}
        onClose={() => setSelected(null)}
        onDownload={handleDownload}
        downloading={downloading}
      />
    </ScreenContainer>
  );
}

// ── Styles ─────────────────────────────────────────────────────

const s = StyleSheet.create({
  // Summary header
  summary: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f3f4f6',
  },
  summaryMain: { marginBottom: 10 },
  summaryLabel: {
    fontSize: 12,
    color: colors.textDisabled,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  summaryAmount: {
    fontSize: 40,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -1.5,
    marginTop: 2,
  },
  summaryCaps: { flexDirection: 'row', gap: 8 },
  summaryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  summaryChipRed: { backgroundColor: '#fef2f2' },
  summaryChipGreen: { backgroundColor: '#f0fdf4' },
  summaryChipText: { fontSize: 12, fontWeight: '600' },
  summaryEmpty: { fontSize: 13, color: colors.textDisabled },

  // Segmented control
  segmentWrap: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f3f4f6',
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
    borderRadius: 8,
  },
  segmentActive: { backgroundColor: colors.bgMuted },
  segmentText: { fontSize: 13, fontWeight: '500', color: colors.textMuted },
  segmentTextActive: { color: colors.textPrimary, fontWeight: '700' },

  // List
  list: { flex: 1 },
  listContent: { paddingBottom: 40 },
  listEmpty: { flex: 1 },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 8,
  },
  rowLeft: { flex: 1, gap: 5 },
  rowTopLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowNum: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  rowAmount: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  rowAmountDue: { color: colors.textPrimary },
  rowBottomLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  statusLabel: { fontSize: 12, fontWeight: '500' },
  rowDate: { fontSize: 12, color: colors.textDisabled },
  rowOrder: { fontSize: 12, color: colors.textDisabled },

  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.bgMuted, marginLeft: 20 },

  // Web banner
  webBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 20,
    marginTop: 12,
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  webBannerTitle: { fontSize: 13, fontWeight: '600', color: '#1e3a8a' },
  webBannerSub: { fontSize: 11, color: '#2563eb', marginTop: 1 },
});

// ── Modal styles ───────────────────────────────────────────────

const m = StyleSheet.create({
  // Amount hero at top of sheet
  amountHero: { alignItems: 'center', paddingVertical: 20 },
  amountHeroLabel: {
    fontSize: 12,
    color: colors.textDisabled,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  amountHeroVal: {
    fontSize: 42,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -1.5,
    marginTop: 4,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: colors.bgSubtle,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: '600' },

  // Reference rows
  refRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  refLabel: { fontSize: 13, color: colors.textDisabled },
  refVal: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.bgMuted,
    marginVertical: 12,
  },

  // Line items
  lineItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  lineItemTotal: { paddingTop: 12, marginTop: 4 },
  lineLabel: { fontSize: 14, color: colors.textMuted },
  lineVal: { fontSize: 14, color: colors.textSecondary, fontWeight: '500' },
  lineTotalLabel: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  lineTotalVal: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },

  // CTA
  payInfo: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#eff6ff',
    borderRadius: 14,
    padding: 16,
  },
  payInfoText: { flex: 1, fontSize: 13, color: '#1d4ed8', lineHeight: 18 },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 14,
    backgroundColor: colors.bgMuted,
    marginTop: 12,
    gap: 8,
  },
  downloadBtnDisabled: {
    opacity: 0.45,
  },
  downloadBtnText: { color: colors.textPrimary, fontWeight: '600', fontSize: 15 },
});

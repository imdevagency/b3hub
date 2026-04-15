/**
 * documents.tsx — Buyer: unified documents hub
 * Three top-level tabs: Dokumenti | Rēķini | Sertifikāti
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Alert,
  RefreshControl,
  Platform,
} from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { StatusPill } from '@/components/ui/StatusPill';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import type {
  ApiDocument,
  DocumentType,
  ApiInvoice,
  InvoiceStatus,
  ApiWasteRecord,
  WasteType,
} from '@/lib/api';
import { API_URL } from '@/lib/api/common';
import {
  FileText,
  Weight,
  ClipboardCheck,
  Recycle,
  Truck,
  ScrollText,
  ExternalLink,
  Download,
  FolderOpen,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  ChevronRight,
  ShieldCheck,
  FileDown,
} from 'lucide-react-native';
import { haptics } from '@/lib/haptics';

// ── Lazy‑load optional native modules ────────────────────────────────────────
let FileSystem: typeof import('expo-file-system') | null = null;
let Sharing: typeof import('expo-sharing') | null = null;
try {
  FileSystem = require('expo-file-system');
} catch {
  /* unavailable in Expo Go */
}
try {
  Sharing = require('expo-sharing');
} catch {
  /* unavailable in Expo Go */
}

// ── Top-level tab ─────────────────────────────────────────────────────────────
type TopTab = 'docs' | 'invoices' | 'certs';
const TOP_TABS: { key: TopTab; label: string }[] = [
  { key: 'docs', label: 'Dokumenti' },
  { key: 'invoices', label: 'Rēķini' },
  { key: 'certs', label: 'Sertifikāti' },
];

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 1 — DOCUMENTS
// ══════════════════════════════════════════════════════════════════════════════

type DocFilter = 'ALL' | Exclude<DocumentType, 'INVOICE'>;

const DOC_TABS: { key: DocFilter; label: string }[] = [
  { key: 'ALL', label: 'Visi' },
  { key: 'WEIGHING_SLIP', label: 'Svēršanas' },
  { key: 'DELIVERY_PROOF', label: 'Piegādes' },
  { key: 'WASTE_CERTIFICATE', label: 'Atkritumi' },
  { key: 'DELIVERY_NOTE', label: 'CMR' },
  { key: 'CONTRACT', label: 'Līgumi' },
];

const DOC_TYPE_META: Record<
  DocumentType,
  { label: string; icon: React.ElementType; iconColor: string; iconBg: string }
> = {
  INVOICE: { label: 'Rēķins', icon: FileText, iconColor: '#2563eb', iconBg: '#eff6ff' },
  WEIGHING_SLIP: { label: 'Svēršanas lapa', icon: Weight, iconColor: '#d97706', iconBg: '#fffbeb' },
  DELIVERY_PROOF: {
    label: 'Piegādes apstiprinājums',
    icon: ClipboardCheck,
    iconColor: '#16a34a',
    iconBg: '#f0fdf4',
  },
  WASTE_CERTIFICATE: {
    label: 'Atkritumu sertifikāts',
    icon: Recycle,
    iconColor: '#059669',
    iconBg: '#ecfdf5',
  },
  DELIVERY_NOTE: {
    label: 'Piegādes pavadzīme',
    icon: Truck,
    iconColor: '#7c3aed',
    iconBg: '#f5f3ff',
  },
  CMR_NOTE: { label: 'CMR', icon: Truck, iconColor: '#7c3aed', iconBg: '#f5f3ff' },
  CONTRACT: { label: 'Līgums', icon: ScrollText, iconColor: '#374151', iconBg: '#f3f4f6' },
};

const DOC_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Melnraksts',
  ISSUED: 'Izdots',
  SIGNED: 'Parakstīts',
  ARCHIVED: 'Arhivēts',
  EXPIRED: 'Beidzies',
};
const DOC_STATUS_COLOR: Record<string, string> = {
  DRAFT: '#9ca3af',
  ISSUED: '#2563eb',
  SIGNED: '#16a34a',
  ARCHIVED: '#d97706',
  EXPIRED: '#ef4444',
};
const DOC_STATUS_BG: Record<string, string> = {
  DRAFT: '#f3f4f6',
  ISSUED: '#eff6ff',
  SIGNED: '#f0fdf4',
  ARCHIVED: '#fffbeb',
  EXPIRED: '#fef2f2',
};

function docFmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('lv-LV', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function DocRow({ doc }: { doc: ApiDocument }) {
  const toast = useToast();
  const meta = DOC_TYPE_META[doc.type] ?? DOC_TYPE_META.CONTRACT;
  const Icon = meta.icon;
  const handleOpen = () => {
    if (!doc.fileUrl) {
      toast.info('Fails vēl nav augšupielādēts.');
      return;
    }
    haptics.light();
    Linking.openURL(doc.fileUrl).catch(() => toast.error('Neizdevās atvērt dokumentu.'));
  };
  return (
    <TouchableOpacity style={ds.row} onPress={handleOpen} activeOpacity={0.7}>
      <View style={[ds.iconWrap, { backgroundColor: meta.iconBg }]}>
        <Icon size={20} color={meta.iconColor} />
      </View>
      <View style={ds.rowBody}>
        <Text style={ds.rowTitle} numberOfLines={1}>
          {doc.title}
        </Text>
        <View style={ds.rowMeta}>
          <StatusPill
            label={DOC_STATUS_LABEL[doc.status] ?? doc.status}
            bg={DOC_STATUS_BG[doc.status] ?? '#f3f4f6'}
            color={DOC_STATUS_COLOR[doc.status] ?? '#6b7280'}
            size="sm"
          />
          <Text style={ds.rowSep}>·</Text>
          <Text style={ds.rowDate}>{docFmtDate(doc.createdAt)}</Text>
        </View>
        {doc.notes ? (
          <Text style={ds.rowNotes} numberOfLines={1}>
            {doc.notes}
          </Text>
        ) : null}
      </View>
      {doc.fileUrl ? (
        <ExternalLink size={16} color="#9ca3af" />
      ) : (
        <Download size={16} color="#d1d5db" />
      )}
    </TouchableOpacity>
  );
}

function DocsTab() {
  const { token } = useAuth();
  const [docs, setDocs] = useState<ApiDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<DocFilter>('ALL');

  const load = useCallback(
    async (silent = false) => {
      if (!token) return;
      if (!silent) setLoading(true);
      try {
        const res = await api.documents.getAll(token);
        setDocs(res.filter((d: ApiDocument) => d.type !== 'INVOICE'));
      } catch {
        setDocs([]);
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

  const visible =
    filter === 'ALL'
      ? docs
      : docs.filter(
          (d) => d.type === filter || (filter === 'DELIVERY_NOTE' && d.type === 'CMR_NOTE'),
        );

  const counts: Record<string, number> = { ALL: docs.length };
  for (const d of docs) {
    const k = d.type === 'CMR_NOTE' ? 'DELIVERY_NOTE' : d.type;
    counts[k] = (counts[k] ?? 0) + 1;
  }

  if (loading)
    return (
      <View style={{ padding: 20 }}>
        <SkeletonCard count={5} />
      </View>
    );

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={ds.filterScroll}
        contentContainerStyle={ds.filterContent}
      >
        {DOC_TABS.map((tb) => {
          const count = counts[tb.key] ?? 0;
          const active = filter === tb.key;
          return (
            <TouchableOpacity
              key={tb.key}
              style={[ds.chip, active && ds.chipActive]}
              onPress={() => {
                haptics.light();
                setFilter(tb.key);
              }}
              activeOpacity={0.75}
            >
              <Text style={[ds.chipText, active && ds.chipTextActive]}>{tb.label}</Text>
              {count > 0 && (
                <View style={[ds.chipBadge, active && ds.chipBadgeActive]}>
                  <Text style={[ds.chipBadgeText, active && ds.chipBadgeTextActive]}>{count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <ScrollView
        style={ds.list}
        contentContainerStyle={visible.length === 0 ? ds.listEmpty : ds.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load(true);
            }}
            tintColor="#00A878"
          />
        }
      >
        {visible.length === 0 ? (
          <EmptyState
            icon={<FolderOpen size={36} color="#9ca3af" />}
            title="Nav dokumentu"
            subtitle={
              filter === 'ALL'
                ? 'Dokumenti parādīsies pēc pasūtījumu izpildes.'
                : 'Nav dokumentu šajā kategorijā.'
            }
          />
        ) : (
          <View style={ds.card}>
            {visible.map((doc, idx) => (
              <View key={doc.id}>
                <DocRow doc={doc} />
                {idx < visible.length - 1 && <View style={ds.divider} />}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 2 — INVOICES
// ══════════════════════════════════════════════════════════════════════════════

function invFmtDate(iso: string | null): string {
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

const INV_STATUS_META: Record<InvoiceStatus, { label: string; bg: string; color: string }> = {
  DRAFT: { label: 'Melnraksts', bg: '#f3f4f6', color: '#6b7280' },
  ISSUED: { label: 'Gaida apmaksu', bg: '#eff6ff', color: '#1d4ed8' },
  PAID: { label: 'Apmaksāts', bg: '#dcfce7', color: '#15803d' },
  OVERDUE: { label: 'Kavēts', bg: '#fee2e2', color: '#b91c1c' },
  CANCELLED: { label: 'Atcelts', bg: '#f3f4f6', color: '#9ca3af' },
};

const INV_FILTERS: { key: InvoiceStatus | 'ALL'; label: string }[] = [
  { key: 'ALL', label: 'Visi' },
  { key: 'ISSUED', label: 'Gaida' },
  { key: 'OVERDUE', label: 'Kavēti' },
  { key: 'PAID', label: 'Apmaksāti' },
];

function InvoiceRow({ invoice, onPress }: { invoice: ApiInvoice; onPress: () => void }) {
  const meta = INV_STATUS_META[invoice.status];
  const isActionable = invoice.status === 'ISSUED' || invoice.status === 'OVERDUE';
  return (
    <TouchableOpacity style={is.row} onPress={onPress} activeOpacity={0.6}>
      <View style={is.rowLeft}>
        <View style={is.rowTopLine}>
          <Text style={is.rowNum}>Rēķins #{invoice.invoiceNumber}</Text>
          <Text style={[is.rowAmount, isActionable && is.rowAmountDue]}>
            {fmtEur(invoice.total)}
          </Text>
        </View>
        <View style={is.rowBottomLine}>
          <StatusPill label={meta.label} bg={meta.bg} color={meta.color} size="sm" />
          <Text style={is.rowDate}>
            {invoice.dueDate
              ? `Termiņš ${invFmtDate(invoice.dueDate)}`
              : invFmtDate(invoice.issuedAt)}
          </Text>
        </View>
        {invoice.order && <Text style={is.rowOrder}>Pasūtījums #{invoice.order.orderNumber}</Text>}
      </View>
      <ChevronRight size={16} color="#d1d5db" />
    </TouchableOpacity>
  );
}

function InvoiceDetailSheet({
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
  const meta = INV_STATUS_META[inv.status];
  const isActionable = inv.status === 'ISSUED' || inv.status === 'OVERDUE';

  return (
    <BottomSheet visible={visible} onClose={onClose} scrollable>
      <View style={{ gap: 0, paddingBottom: 8 }}>
        <View style={im.amountHero}>
          <Text style={im.amountHeroLabel}>Kopā jāmaksā</Text>
          <Text style={[im.amountHeroVal, isActionable && { color: '#111827' }]}>
            {fmtEur(inv.total)}
          </Text>
          <StatusPill label={meta.label} bg={meta.bg} color={meta.color} size="md" />
        </View>
        <View style={im.refRow}>
          <Text style={im.refLabel}>Rēķins</Text>
          <Text style={im.refVal}>#{inv.invoiceNumber}</Text>
        </View>
        {inv.order && (
          <View style={im.refRow}>
            <Text style={im.refLabel}>Pasūtījums</Text>
            <Text style={im.refVal}>#{inv.order.orderNumber}</Text>
          </View>
        )}
        <View style={im.divider} />
        <View style={im.lineItem}>
          <Text style={im.lineLabel}>Summa bez PVN</Text>
          <Text style={im.lineVal}>{fmtEur(inv.subtotal)}</Text>
        </View>
        <View style={im.lineItem}>
          <Text style={im.lineLabel}>PVN (21%)</Text>
          <Text style={im.lineVal}>{fmtEur(inv.vatAmount)}</Text>
        </View>
        <View style={[im.lineItem, im.lineItemTotal]}>
          <Text style={im.lineTotalLabel}>Kopā</Text>
          <Text style={im.lineTotalVal}>{fmtEur(inv.total)}</Text>
        </View>
        <View style={im.divider} />
        <View style={im.lineItem}>
          <Text style={im.lineLabel}>Izrakstīts</Text>
          <Text style={im.lineVal}>{invFmtDate(inv.issuedAt)}</Text>
        </View>
        {inv.dueDate && (
          <View style={im.lineItem}>
            <Text style={im.lineLabel}>Apmaksas termiņš</Text>
            <Text
              style={[
                im.lineVal,
                inv.status === 'OVERDUE' && { color: '#dc2626', fontWeight: '700' },
              ]}
            >
              {invFmtDate(inv.dueDate)}
            </Text>
          </View>
        )}
        {inv.paidAt && (
          <View style={im.lineItem}>
            <Text style={im.lineLabel}>Apmaksāts</Text>
            <Text style={[im.lineVal, { color: '#16a34a' }]}>{invFmtDate(inv.paidAt)}</Text>
          </View>
        )}
        {isActionable && (
          <View style={im.payInfo}>
            <CreditCard size={16} color="#2563eb" />
            <Text style={im.payInfoText}>
              Lūdzu veiciet pārskaitījumu uz B3Hub bankas kontu. Maksājums tiks apstiprināts
              automātiski pēc bankas apstrādes.
            </Text>
          </View>
        )}
        <TouchableOpacity
          style={im.downloadBtn}
          onPress={onDownload}
          disabled={downloading}
          activeOpacity={0.85}
        >
          {downloading ? (
            <ActivityIndicator color="#111827" />
          ) : (
            <>
              <Download size={18} color="#111827" />
              <Text style={im.downloadBtnText}>Lejupielādēt PDF</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );
}

function InvoicesTab() {
  const { token } = useAuth();
  const toast = useToast();
  const [invoices, setInvoices] = useState<ApiInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<ApiInvoice | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [filter, setFilter] = useState<InvoiceStatus | 'ALL'>('ALL');

  const load = useCallback(
    async (silent = false) => {
      if (!token) return;
      if (!silent) setLoading(true);
      try {
        const data = await api.invoices.getAll(token);
        setInvoices(Array.isArray(data) ? data : []);
      } catch {
        /* silent fail — show empty state */
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
      const dlRes = await FileSystem.downloadAsync(url, fileUri, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (dlRes.status !== 200) throw new Error('Neizdevās lejupielādēt PDF');
      if (Platform.OS === 'ios') {
        await Sharing.shareAsync(dlRes.uri, { UTI: 'com.adobe.pdf', mimeType: 'application/pdf' });
      } else {
        await Sharing.shareAsync(dlRes.uri);
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

  if (loading)
    return (
      <View style={{ padding: 20 }}>
        <SkeletonCard count={4} />
      </View>
    );

  return (
    <>
      <View style={is.summary}>
        <View style={is.summaryMain}>
          <Text style={is.summaryLabel}>Apmaksājams</Text>
          <Text style={is.summaryAmount}>{fmtEur(totalOwed)}</Text>
        </View>
        <View style={is.summaryCaps}>
          {overdueCount > 0 && (
            <View style={[is.summaryChip, is.summaryChipRed]}>
              <AlertCircle size={12} color="#dc2626" />
              <Text style={[is.summaryChipText, { color: '#dc2626' }]}>{overdueCount} kavēts</Text>
            </View>
          )}
          {paidCount > 0 && (
            <View style={[is.summaryChip, is.summaryChipGreen]}>
              <CheckCircle2 size={12} color="#16a34a" />
              <Text style={[is.summaryChipText, { color: '#16a34a' }]}>{paidCount} apmaksāts</Text>
            </View>
          )}
          {invoices.length === 0 && <Text style={is.summaryEmpty}>Nav rēķinu</Text>}
        </View>
      </View>
      <View style={is.segmentWrap}>
        {INV_FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[is.segment, filter === f.key && is.segmentActive]}
            onPress={() => {
              haptics.light();
              setFilter(f.key);
            }}
            activeOpacity={0.7}
          >
            <Text style={[is.segmentText, filter === f.key && is.segmentTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <ScrollView
        style={is.list}
        contentContainerStyle={visible.length === 0 ? is.listEmpty : is.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load(true);
            }}
            tintColor="#00A878"
          />
        }
      >
        {visible.length === 0 ? (
          <EmptyState
            icon={<FileText size={32} color="#9ca3af" />}
            title="Nav rēķinu"
            subtitle={
              filter === 'ALL'
                ? 'Rēķini parādīsīsies, kad pasūtījumi tiks apstiprināti.'
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
                {idx < visible.length - 1 && <View style={is.divider} />}
              </View>
            ))}
          </>
        )}
      </ScrollView>
      <InvoiceDetailSheet
        invoice={selected}
        visible={!!selected}
        onClose={() => setSelected(null)}
        onDownload={handleDownload}
        downloading={downloading}
      />
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 3 — CERTIFICATES
// ══════════════════════════════════════════════════════════════════════════════

const WASTE_TYPE_LABELS: Record<WasteType, string> = {
  CONCRETE: 'Betons',
  BRICK: 'Ķieģeļi',
  WOOD: 'Koks',
  METAL: 'Metāls',
  PLASTIC: 'Plastmasa',
  SOIL: 'Zeme',
  MIXED: 'Jaukti atkritumi',
  HAZARDOUS: 'Bīstamie atkritumi',
};
const WASTE_TYPE_COLORS: Record<WasteType, string> = {
  CONCRETE: '#6b7280',
  BRICK: '#b45309',
  WOOD: '#92400e',
  METAL: '#374151',
  PLASTIC: '#0369a1',
  SOIL: '#78350f',
  MIXED: '#6b7280',
  HAZARDOUS: '#b91c1c',
};

function RecordCard({ item }: { item: ApiWasteRecord }) {
  const typeColor = WASTE_TYPE_COLORS[item.wasteType] ?? '#6b7280';
  const typeLabel = WASTE_TYPE_LABELS[item.wasteType] ?? item.wasteType;
  const hasCertificate = !!item.certificateUrl;
  const handleOpen = () => {
    if (!item.certificateUrl) return;
    Linking.openURL(item.certificateUrl).catch(() =>
      Alert.alert('Kļūda', 'Neizdevās atvērt sertifikātu.'),
    );
  };
  return (
    <View style={cs.card}>
      <View style={cs.cardTopRow}>
        <View style={[cs.typePill, { backgroundColor: typeColor + '18' }]}>
          <Text style={[cs.typePillText, { color: typeColor }]}>{typeLabel}</Text>
        </View>
        {hasCertificate ? (
          <StatusPill label="Sertificēts" bg="#dcfce7" color="#166534" size="sm" />
        ) : (
          <StatusPill label="Gaida sertifikātu" bg="#fef9c3" color="#92400e" size="sm" />
        )}
      </View>
      <Text style={cs.centerName}>{item.recyclingCenter.name}</Text>
      <Text style={cs.centerCity}>{item.recyclingCenter.city}</Text>
      <View style={cs.metricsRow}>
        <View style={cs.metric}>
          <Text style={cs.metricValue}>{item.weight.toFixed(2)}t</Text>
          <Text style={cs.metricLabel}>Svars</Text>
        </View>
        {item.recyclableWeight != null && (
          <View style={cs.metric}>
            <Text style={[cs.metricValue, { color: '#16a34a' }]}>
              {item.recyclableWeight.toFixed(2)}t
            </Text>
            <Text style={cs.metricLabel}>Pārstrādāts</Text>
          </View>
        )}
        {item.recyclingRate != null && (
          <View style={cs.metric}>
            <View style={cs.rateRow}>
              <Recycle size={13} color="#16a34a" />
              <Text style={[cs.metricValue, { color: '#16a34a' }]}>
                {item.recyclingRate.toFixed(0)}%
              </Text>
            </View>
            <Text style={cs.metricLabel}>Pārstrādes līmenis</Text>
          </View>
        )}
        {item.processedDate && (
          <View style={cs.metric}>
            <Text style={cs.metricValue}>
              {new Date(item.processedDate).toLocaleDateString('lv-LV', {
                day: 'numeric',
                month: 'short',
              })}
            </Text>
            <Text style={cs.metricLabel}>Apstrādāts</Text>
          </View>
        )}
      </View>
      {hasCertificate && (
        <TouchableOpacity style={cs.certBtn} onPress={handleOpen} activeOpacity={0.8}>
          <FileDown size={16} color="#15803d" />
          <Text style={cs.certBtnText}>Atvērt sertifikātu</Text>
          <ExternalLink size={14} color="#15803d" />
        </TouchableOpacity>
      )}
      <Text style={cs.cardDate}>
        {new Date(item.createdAt).toLocaleDateString('lv-LV', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}
      </Text>
    </View>
  );
}

function CertsTab() {
  const { token, user } = useAuth();
  const [records, setRecords] = useState<ApiWasteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setError(false);
    try {
      const res = await api.recyclingCenters.myDisposalRecords(token);
      setRecords(res);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  if (!user?.canSkipHire) {
    return (
      <EmptyState
        icon={<ShieldCheck size={42} color="#9ca3af" />}
        title="Nav pieejams"
        subtitle="Atkritumu sertifikāti ir pieejami tikai apstiprinātu konteineru operatoriem."
      />
    );
  }

  if (loading)
    return (
      <View style={{ padding: 20 }}>
        <SkeletonCard count={4} />
      </View>
    );

  if (error) {
    return (
      <View style={cs.center}>
        <ShieldCheck size={52} color="#fca5a5" />
        <Text style={cs.emptyTitle}>Neizdevās ielādēt</Text>
        <Text style={cs.emptyDesc}>Pārbaudiet savienojumu un mēģiniet vēlreiz.</Text>
        <TouchableOpacity
          onPress={() => {
            setLoading(true);
            load();
          }}
          style={cs.retryBtn}
        >
          <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Mēģināt vēlreiz</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const certified = records.filter((r) => !!r.certificateUrl);
  const pending = records.filter((r) => !r.certificateUrl);

  return records.length === 0 ? (
    <View style={cs.center}>
      <ShieldCheck size={52} color="#d1d5db" />
      <Text style={cs.emptyTitle}>Nav sertifikātu</Text>
      <Text style={cs.emptyDesc}>
        Kad pārvadātājs nogādās konteineru atkritumu pārstrādes centrā, šeit parādīsies jūsu
        atbilstības sertifikāti.
      </Text>
    </View>
  ) : (
    <ScrollView
      contentContainerStyle={{ padding: 16, gap: 12 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load();
          }}
          tintColor="#16a34a"
        />
      }
    >
      <View style={cs.summaryBar}>
        <View style={cs.summaryItem}>
          <Text style={cs.summaryNum}>{certified.length}</Text>
          <Text style={cs.summaryLabel}>Sertificēti</Text>
        </View>
        <View style={cs.summaryDivider} />
        <View style={cs.summaryItem}>
          <Text style={[cs.summaryNum, { color: '#d97706' }]}>{pending.length}</Text>
          <Text style={cs.summaryLabel}>Gaida</Text>
        </View>
        <View style={cs.summaryDivider} />
        <View style={cs.summaryItem}>
          <Text style={cs.summaryNum}>{records.reduce((a, r) => a + r.weight, 0).toFixed(1)}t</Text>
          <Text style={cs.summaryLabel}>Kopā</Text>
        </View>
      </View>
      {records.map((r) => (
        <RecordCard key={r.id} item={r} />
      ))}
    </ScrollView>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN SCREEN
// ══════════════════════════════════════════════════════════════════════════════

export default function DocumentsScreen() {
  const [topTab, setTopTab] = useState<TopTab>('docs');

  return (
    <ScreenContainer bg="#f9fafb">
      <ScreenHeader title="Dokumenti" />

      {/* Top-level segmented switcher */}
      <View style={sh.topTabRow}>
        {TOP_TABS.map((tb) => (
          <TouchableOpacity
            key={tb.key}
            style={[sh.topTab, topTab === tb.key && sh.topTabActive]}
            onPress={() => {
              haptics.light();
              setTopTab(tb.key);
            }}
            activeOpacity={0.75}
          >
            <Text style={[sh.topTabText, topTab === tb.key && sh.topTabTextActive]}>
              {tb.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {topTab === 'docs' && <DocsTab />}
      {topTab === 'invoices' && <InvoicesTab />}
      {topTab === 'certs' && <CertsTab />}
    </ScreenContainer>
  );
}

// ── Shared hub styles ─────────────────────────────────────────────────────────
const sh = StyleSheet.create({
  topTabRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  topTab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10 },
  topTabActive: { backgroundColor: '#000' },
  topTabText: { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  topTabTextActive: { color: '#fff' },
});

// ── Documents tab styles ──────────────────────────────────────────────────────
const ds = StyleSheet.create({
  filterScroll: { flexGrow: 0 },
  filterContent: { paddingHorizontal: 16, paddingVertical: 12, gap: 8, flexDirection: 'row' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#f3f4f6',
    borderWidth: 0,
  },
  chipActive: { backgroundColor: '#000000' },
  chipText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  chipTextActive: { color: '#ffffff' },
  chipBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  chipBadgeActive: { backgroundColor: '#374151' },
  chipBadgeText: { fontSize: 12, fontWeight: '700', color: '#6b7280' },
  chipBadgeTextActive: { color: '#ffffff' },
  list: { flex: 1 },
  listContent: { padding: 16, gap: 0 },
  listEmpty: { flex: 1, paddingHorizontal: 16 },
  card: {
    backgroundColor: 'transparent',
  },
  divider: { height: 1, backgroundColor: '#f3f4f6', marginLeft: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rowBody: { flex: 1, gap: 3 },
  rowTitle: { fontSize: 14, fontWeight: '600', color: '#111827' },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  rowSep: { fontSize: 11, color: '#d1d5db' },
  rowDate: { fontSize: 12, color: '#9ca3af' },
  rowNotes: { fontSize: 12, color: '#6b7280' },
});

// ── Invoices tab styles ───────────────────────────────────────────────────────
const is = StyleSheet.create({
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
    color: '#9ca3af',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  summaryAmount: {
    fontSize: 40,
    fontWeight: '800',
    color: '#111827',
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
  summaryEmpty: { fontSize: 13, color: '#9ca3af' },
  segmentWrap: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 999, backgroundColor: '#f9fafb' },
  segmentActive: { backgroundColor: '#f3f4f6' },
  segmentText: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  segmentTextActive: { color: '#111827', fontWeight: '700' },
  list: { flex: 1 },
  listContent: { paddingBottom: 40 },
  listEmpty: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 8,
  },
  rowLeft: { flex: 1, gap: 5 },
  rowTopLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowNum: { fontSize: 15, fontWeight: '600', color: '#111827' },
  rowAmount: { fontSize: 16, fontWeight: '700', color: '#111827' },
  rowAmountDue: { color: '#111827' },
  rowBottomLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowDate: { fontSize: 12, color: '#9ca3af' },
  rowOrder: { fontSize: 12, color: '#9ca3af' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#f3f4f6', marginLeft: 20 },
});

// ── Invoice detail sheet styles ───────────────────────────────────────────────
const im = StyleSheet.create({
  amountHero: { alignItems: 'center', paddingVertical: 20 },
  amountHeroLabel: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  amountHeroVal: {
    fontSize: 42,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -1.5,
    marginTop: 4,
  },
  refRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  refLabel: { fontSize: 13, color: '#9ca3af' },
  refVal: { fontSize: 13, fontWeight: '600', color: '#374151' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#f3f4f6', marginVertical: 12 },
  lineItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  lineItemTotal: { paddingTop: 12, marginTop: 4 },
  lineLabel: { fontSize: 14, color: '#6b7280' },
  lineVal: { fontSize: 14, color: '#374151', fontWeight: '500' },
  lineTotalLabel: { fontSize: 15, fontWeight: '700', color: '#111827' },
  lineTotalVal: { fontSize: 18, fontWeight: '800', color: '#111827' },
  payInfo: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 14,
  },
  payInfoText: { flex: 1, fontSize: 13, color: '#1d4ed8', lineHeight: 18 },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 14,
    backgroundColor: '#f3f4f6',
    marginTop: 12,
    gap: 8,
  },
  downloadBtnText: { color: '#111827', fontWeight: '600', fontSize: 15 },
});

// ── Certificates tab styles ───────────────────────────────────────────────────
const cs = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#374151' },
  emptyDesc: { fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 22 },
  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: '#111827',
    borderRadius: 100,
  },
  summaryBar: {
    backgroundColor: '#f3f4f6',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  summaryItem: { alignItems: 'center', gap: 2 },
  summaryNum: { fontSize: 22, fontWeight: '700', color: '#111827' },
  summaryLabel: { fontSize: 12, color: '#9ca3af' },
  summaryDivider: { width: StyleSheet.hairlineWidth, height: 32, backgroundColor: '#e5e7eb' },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    gap: 12,
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  typePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  typePillText: { fontSize: 12, fontWeight: '700' },
  centerName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  centerCity: { fontSize: 13, color: '#6b7280' },
  metricsRow: { flexDirection: 'row', gap: 16, flexWrap: 'wrap' },
  metric: { gap: 1 },
  metricValue: { fontSize: 16, fontWeight: '700', color: '#111827' },
  metricLabel: { fontSize: 11, color: '#9ca3af' },
  rateRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  certBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  certBtnText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#111827' },
  cardDate: { fontSize: 12, color: '#9ca3af' },
});

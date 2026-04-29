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
  ActivityIndicator,
  Linking,
  Alert,
  RefreshControl,
  Platform,
} from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
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
import { colors } from '@/lib/theme';

let FileSystem: typeof import('expo-file-system') | null = null;
let Sharing: typeof import('expo-sharing') | null = null;
try {
  FileSystem = require('expo-file-system');
} catch {}
try {
  Sharing = require('expo-sharing');
} catch {}

type TopTab = 'docs' | 'invoices' | 'certs';
const TOP_TABS: { key: TopTab; label: string }[] = [
  { key: 'docs', label: 'Dokumenti' },
  { key: 'invoices', label: 'Rēķini' },
  { key: 'certs', label: 'Sertifikāti' },
];

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
    <TouchableOpacity
      className="flex-row items-center py-4 px-5 border-b border-gray-100 bg-white"
      onPress={handleOpen}
      activeOpacity={0.7}
    >
      <View
        className="w-12 h-12 rounded-full items-center justify-center mr-4"
        style={{ backgroundColor: meta.iconBg }}
      >
        <Icon size={20} color={meta.iconColor} />
      </View>
      <View className="flex-1 justify-center gap-0.5 pr-2">
        <Text className="text-gray-900 font-semibold text-base tracking-tight" numberOfLines={1}>
          {doc.title}
        </Text>
        <View className="flex-row items-center mt-1">
          <StatusPill
            label={DOC_STATUS_LABEL[doc.status] ?? doc.status}
            bg={DOC_STATUS_BG[doc.status] ?? '#f3f4f6'}
            color={DOC_STATUS_COLOR[doc.status] ?? '#6b7280'}
            size="sm"
          />
          <Text className="text-gray-300 mx-2">•</Text>
          <Text className="text-gray-500 " style={{ fontSize: 13 }}>
            {docFmtDate(doc.createdAt)}
          </Text>
        </View>
      </View>
      {doc.fileUrl ? (
        <View className="bg-gray-100 p-2 rounded-full">
          <ExternalLink size={16} color="#6b7280" />
        </View>
      ) : (
        <View className="bg-gray-100 p-2 rounded-full">
          <Download size={16} color="#d1d5db" />
        </View>
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
      <View className="p-5">
        <SkeletonCard count={5} />
      </View>
    );

  return (
    <>
      <View className="my-3">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
        >
          {DOC_TABS.map((tb) => {
            const count = counts[tb.key] ?? 0;
            const active = filter === tb.key;
            return (
              <TouchableOpacity
                key={tb.key}
                className={`flex-row items-center px-4 py-2 rounded-full ${active ? 'bg-[#166534]' : 'bg-gray-100'}`}
                onPress={() => {
                  haptics.light();
                  setFilter(tb.key);
                }}
              >
                <Text className={`font-semibold text-sm ${active ? 'text-white' : 'text-gray-900'}`}>
                  {tb.label}
                </Text>
                {count > 0 && (
                  <View
                    className={`ml-2 px-1.5 py-0.5 rounded-full items-center justify-center ${active ? 'bg-gray-700' : 'bg-gray-200'}`}
                  >
                    <Text className={` font-black ${active ? 'text-white' : 'text-gray-500'}`}>
                      {count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
      <ScrollView
        className="flex-1"
        contentContainerStyle={
          visible.length === 0 ? { flex: 1, paddingHorizontal: 20 } : { paddingBottom: 40 }
        }
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
          <View>
            {visible.map((doc) => (
              <DocRow key={doc.id} doc={doc} />
            ))}
          </View>
        )}
      </ScrollView>
    </>
  );
}

const INV_STATUS_META: Record<InvoiceStatus, { label: string; bg: string; color: string }> = {
  DRAFT: { label: 'Melnraksts', bg: '#f3f4f6', color: colors.textMuted },
  ISSUED: { label: 'Gaida apmaksu', bg: '#eff6ff', color: '#1d4ed8' },
  PAID: { label: 'Apmaksāts', bg: '#dcfce7', color: colors.successText },
  OVERDUE: { label: 'Kavēts', bg: '#fee2e2', color: colors.dangerText },
  CANCELLED: { label: 'Atcelts', bg: '#f3f4f6', color: colors.textDisabled },
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
    <TouchableOpacity
      className="flex-row items-center px-5 py-4 border-b border-gray-100 bg-white"
      onPress={onPress}
      activeOpacity={0.6}
    >
      <View className="flex-1 gap-1.5 pr-4">
        <View className="flex-row justify-between items-center">
          <Text className="text-gray-900 font-semibold text-base tracking-tight">
            #{invoice.invoiceNumber}
          </Text>
          <Text
            className={` font-black tracking-tight ${isActionable ? 'text-gray-900' : 'text-gray-500'}`}
          >
            {fmtEur(invoice.total)}
          </Text>
        </View>
        <View className="flex-row justify-between items-center mt-1">
          <StatusPill label={meta.label} bg={meta.bg} color={meta.color} size="sm" />
          <Text className="text-gray-400 font-medium " style={{ fontSize: 13 }}>
            {invoice.dueDate
              ? `Termiņš ${invFmtDate(invoice.dueDate)}`
              : invFmtDate(invoice.issuedAt)}
          </Text>
        </View>
      </View>
      <ChevronRight size={20} color="#d1d5db" />
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
      <View className="pb-4">
        <View className="items-center py-6 mb-2 border-b border-gray-100">
          <Text className="text-gray-400 font-semibold text-xs uppercase tracking-widest mb-1">
            Kopā jāmaksā
          </Text>
          <Text
            className="text-gray-900 font-black tracking-tighter leading-none mb-3"
            style={{ fontSize: 42 }}
          >
            {fmtEur(inv.total)}
          </Text>
          <StatusPill label={meta.label} bg={meta.bg} color={meta.color} size="md" />
        </View>

        <View className="px-2">
          <View className="flex-row justify-between py-2.5">
            <Text className="text-gray-500 text-sm">Rēķins</Text>
            <Text className="text-gray-900 font-semibold text-sm">#{inv.invoiceNumber}</Text>
          </View>
          {inv.order && (
            <View className="flex-row justify-between py-2.5 border-b border-gray-100">
              <Text className="text-gray-500 text-sm">Pasūtījums</Text>
              <Text className="text-gray-900 font-semibold text-sm">#{inv.order.orderNumber}</Text>
            </View>
          )}

          <View className="flex-row justify-between py-2 mt-4">
            <Text className="text-gray-500 text-sm">Summa bez PVN</Text>
            <Text className="text-gray-900 font-medium text-sm">{fmtEur(inv.subtotal)}</Text>
          </View>
          <View className="flex-row justify-between py-2">
            <Text className="text-gray-500 text-sm">PVN (21%)</Text>
            <Text className="text-gray-900 font-medium text-sm">{fmtEur(inv.vatAmount)}</Text>
          </View>
          <View className="flex-row justify-between py-3 mt-1 border-t border-gray-100">
            <Text className="text-gray-900 font-semibold text-base">Kopā</Text>
            <Text className="text-gray-900 font-black text-lg">{fmtEur(inv.total)}</Text>
          </View>

          <View className="flex-row justify-between py-2.5 mt-4 border-t border-gray-100 pt-5">
            <Text className="text-gray-500 text-sm">Izrakstīts</Text>
            <Text className="text-gray-900 font-medium text-sm">{invFmtDate(inv.issuedAt)}</Text>
          </View>
          {inv.dueDate && (
            <View className="flex-row justify-between py-2.5">
              <Text className="text-gray-500 text-sm">Apmaksas termiņš</Text>
              <Text
                className={`font-semibold text-sm ${inv.status === 'OVERDUE' ? 'text-red-600' : 'text-gray-900'}`}
              >
                {invFmtDate(inv.dueDate)}
              </Text>
            </View>
          )}
          {inv.paidAt && (
            <View className="flex-row justify-between py-2.5">
              <Text className="text-gray-500 text-sm">Apmaksāts</Text>
              <Text className="text-green-600 font-semibold text-sm">{invFmtDate(inv.paidAt)}</Text>
            </View>
          )}

          {isActionable && (
            <View className="bg-blue-50 rounded-2xl p-4 mt-6 flex-row items-center">
              <CreditCard size={20} color="#2563eb" className="mr-3" />
              <Text className="flex-1 text-blue-700 leading-5 font-medium" style={{ fontSize: 13 }}>
                Pārskaitiet uz B3Hub bankas kontu. Maksājums tiks apstiprināts automātiski.
              </Text>
            </View>
          )}

          <TouchableOpacity
            className="flex-row items-center justify-center p-4 bg-gray-100 rounded-full mt-6"
            onPress={onDownload}
            disabled={downloading}
            activeOpacity={0.8}
          >
            {downloading ? (
              <ActivityIndicator color="#111827" />
            ) : (
              <>
                <Download size={20} color="#111827" />
                <Text className="text-gray-900 font-semibold text-base ml-2">Lejupielādēt PDF</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </BottomSheet>
  );
}

function InvoicesTab() {
  const { token } = useAuth();
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
    if (!selected || !token || !FileSystem || !Sharing) return;
    setDownloading(true);
    try {
      const url = `${API_URL}/invoices/${selected.id}/pdf`;
      const fileUri = `${(FileSystem as any).documentDirectory ?? ''}invoice-${selected.invoiceNumber}.pdf`;
      const dlRes = await FileSystem.downloadAsync(url, fileUri, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (Platform.OS === 'ios')
        await Sharing.shareAsync(dlRes.uri, { UTI: 'com.adobe.pdf', mimeType: 'application/pdf' });
      else await Sharing.shareAsync(dlRes.uri);
      haptics.success();
    } catch {
      haptics.error();
    } finally {
      setDownloading(false);
    }
  };

  const visible = filter === 'ALL' ? invoices : invoices.filter((i) => i.status === filter);
  const totalOwed = invoices
    .filter((i) => i.status === 'ISSUED' || i.status === 'OVERDUE')
    .reduce((s, i) => s + i.total, 0);

  if (loading)
    return (
      <View className="p-5">
        <SkeletonCard count={4} />
      </View>
    );

  return (
    <>
      <View className="px-5 pt-8 pb-6 border-b border-gray-100">
        <Text className="text-gray-400 font-semibold text-xs uppercase tracking-wider mb-1">
          Kopā apmaksājams
        </Text>
        <Text
          className="text-gray-900 font-black tracking-tighter leading-none mb-3"
          style={{ fontSize: 48 }}
        >
          {fmtEur(totalOwed)}
        </Text>
      </View>

      <View className="mb-2 mt-4">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
        >
          {INV_FILTERS.map((f) => (
            <TouchableOpacity
              key={f.key}
              className={`px-4 py-2.5 rounded-full flex-row items-center ${filter === f.key ? 'bg-[#166534]' : 'bg-gray-100'}`}
              onPress={() => {
                haptics.light();
                setFilter(f.key);
              }}
            >
              <Text
                className={`font-semibold text-sm ${filter === f.key ? 'text-white' : 'text-gray-900'}`}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={visible.length === 0 ? { flex: 1 } : { paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load(true);
            }}
          />
        }
      >
        {visible.map((inv) => (
          <InvoiceRow
            key={inv.id}
            invoice={inv}
            onPress={() => {
              haptics.light();
              setSelected(inv);
            }}
          />
        ))}
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

const WASTE_TYPE_LABELS: Record<WasteType, string> = {
  CONCRETE: 'Betons',
  BRICK: 'Ķieģeļi',
  WOOD: 'Koks',
  METAL: 'Metāls',
  PLASTIC: 'Plastmasa',
  SOIL: 'Zeme',
  MIXED: 'Jaukti',
  HAZARDOUS: 'Bīstami',
};

function RecordCard({ item }: { item: ApiWasteRecord }) {
  const hasCertificate = !!item.certificateUrl;
  return (
    <View className="flex-row py-5 px-5 border-b border-gray-100 bg-white">
      <View className="w-12 h-12 rounded-full items-center justify-center bg-gray-100 mr-4">
        <Recycle size={20} color="#111827" />
      </View>
      <View className="flex-1">
        <View className="flex-row justify-between mb-1">
          <Text className="text-gray-900 font-semibold text-base tracking-tight">
            {WASTE_TYPE_LABELS[item.wasteType] ?? item.wasteType}
          </Text>
          <Text className="text-gray-900 font-black text-base">{item.weight.toFixed(1)}t</Text>
        </View>
        <Text className="text-gray-500 font-medium text-sm mb-2">
          {item.recyclingCenter.name}, {item.recyclingCenter.city}
        </Text>
        <View className="flex-row items-center">
          {hasCertificate ? (
            <StatusPill label="Sertificēts" bg="#dcfce7" color="#166534" size="sm" />
          ) : (
            <StatusPill label="Gaida sertifikātu" bg="#fef9c3" color="#92400e" size="sm" />
          )}
          <Text className="text-gray-300 mx-2">•</Text>
          <Text className="text-gray-400 " style={{ fontSize: 13 }}>
            {new Date(item.createdAt).toLocaleDateString('lv-LV')}
          </Text>
        </View>
        {hasCertificate && (
          <TouchableOpacity
            className="mt-4 bg-gray-100 rounded-full py-2.5 px-4 flex-row items-center justify-center self-start"
            onPress={() => Linking.openURL(item.certificateUrl!)}
          >
            <FileDown size={16} color="#111827" className="mr-2" />
            <Text className="text-gray-900 font-semibold " style={{ fontSize: 13 }}>
              Skatīt sertifikātu
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function CertsTab() {
  const { token, user } = useAuth();
  const [records, setRecords] = useState<ApiWasteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await api.recyclingCenters.myDisposalRecords(token);
      setRecords(res);
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  if (!user?.canSkipHire)
    return (
      <EmptyState
        icon={<ShieldCheck size={42} color="#9ca3af" />}
        title="Nav pieejams"
        subtitle="Atkritumu sertifikāti ir pieejami tikai apstiprinātu konteineru operatoriem."
      />
    );
  if (loading)
    return (
      <View className="p-5">
        <SkeletonCard count={4} />
      </View>
    );

  const certified = records.filter((r) => !!r.certificateUrl);
  return (
    <>
      <View className="flex-row px-5 py-6 bg-white border-b border-gray-100 items-center justify-between">
        <View className="items-center">
          <Text className="text-gray-900 font-black text-2xl">{certified.length}</Text>
          <Text className="text-gray-500 font-semibold text-xs uppercase">Sertificēti</Text>
        </View>
        <View className="h-8 w-[1px] bg-gray-200" />
        <View className="items-center">
          <Text className="text-gray-900 font-black text-2xl">
            {records.length - certified.length}
          </Text>
          <Text className="text-gray-500 font-semibold text-xs uppercase">Gaida</Text>
        </View>
        <View className="h-8 w-[1px] bg-gray-200" />
        <View className="items-center">
          <Text className="text-gray-900 font-black text-2xl">
            {records.reduce((a, r) => a + r.weight, 0).toFixed(1)}t
          </Text>
          <Text className="text-gray-500 font-semibold text-xs uppercase">Kopā</Text>
        </View>
      </View>
      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }
      >
        {records.map((r) => (
          <RecordCard key={r.id} item={r} />
        ))}
      </ScrollView>
    </>
  );
}

export default function DocumentsScreen() {
  const { user } = useAuth();
  const [topTab, setTopTab] = useState<TopTab>('docs');

  // B2C users only see delivery documents; invoices and waste certs are B2B-only
  const visibleTabs = TOP_TABS.filter((tb) => tb.key === 'docs' || user?.isCompany);

  return (
    <ScreenContainer bg="#ffffff" topBg="#ffffff">
      <View className="px-5 pt-6 pb-2">
        <Text
          className=" font-semibold tracking-tight text-gray-900 leading-tight"
          style={{ fontSize: 32 }}
        >
          Dokumenti
        </Text>
      </View>

      {visibleTabs.length > 1 && (
        <View className="px-5 pb-2 mt-2">
          <View className="flex-row bg-gray-100 p-1 rounded-2xl">
            {visibleTabs.map((tb) => {
              const active = topTab === tb.key;
              return (
                <TouchableOpacity
                  key={tb.key}
                  className={`flex-1 items-center justify-center py-2 rounded-xl ${active ? 'bg-white shadow-sm' : ''}`}
                  onPress={() => {
                    haptics.light();
                    setTopTab(tb.key);
                  }}
                >
                  <Text
                    className={`font-semibold text-sm ${active ? 'text-gray-900' : 'text-gray-500'}`}
                  >
                    {tb.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {topTab === 'docs' && <DocsTab />}
      {topTab === 'invoices' && user?.isCompany && <InvoicesTab />}
      {topTab === 'certs' && user?.isCompany && <CertsTab />}
    </ScreenContainer>
  );
}

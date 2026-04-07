/**
 * documents.tsx — Buyer: unified documents hub
 * Shows all non-invoice documents: weighing slips, delivery proofs,
 * waste certificates, CMR / delivery notes, and contracts.
 */
import React, { useState, useCallback, useEffect } from 'react';
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
} from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { StatusPill } from '@/components/ui/StatusPill';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import type { ApiDocument, DocumentType } from '@/lib/api';
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
} from 'lucide-react-native';
import { haptics } from '@/lib/haptics';

// ── Config ────────────────────────────────────────────────────

// Invoice type is excluded — invoices have their own dedicated screen.
type DocTab = 'ALL' | Exclude<DocumentType, 'INVOICE'>;

const TABS: { key: DocTab; label: string }[] = [
  { key: 'ALL', label: 'Visi' },
  { key: 'WEIGHING_SLIP', label: 'Svēršanas' },
  { key: 'DELIVERY_PROOF', label: 'Piegādes' },
  { key: 'WASTE_CERTIFICATE', label: 'Atkritumi' },
  { key: 'DELIVERY_NOTE', label: 'CMR' },
  { key: 'CONTRACT', label: 'Līgumi' },
];

const TYPE_META: Record<
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

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Melnraksts',
  ISSUED: 'Izdots',
  SIGNED: 'Parakstīts',
  ARCHIVED: 'Arhivēts',
  EXPIRED: 'Beidzies',
};

const STATUS_COLOR: Record<string, string> = {
  DRAFT: '#9ca3af',
  ISSUED: '#2563eb',
  SIGNED: '#16a34a',
  ARCHIVED: '#d97706',
  EXPIRED: '#ef4444',
};

const STATUS_BG: Record<string, string> = {
  DRAFT: '#f3f4f6',
  ISSUED: '#eff6ff',
  SIGNED: '#f0fdf4',
  ARCHIVED: '#fffbeb',
  EXPIRED: '#fef2f2',
};

// ── Helpers ───────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('lv-LV', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// ── Document row ──────────────────────────────────────────────

function DocRow({ doc }: { doc: ApiDocument }) {
  const toast = useToast();
  const meta = TYPE_META[doc.type] ?? TYPE_META.CONTRACT;
  const Icon = meta.icon;
  const statusLabel = STATUS_LABEL[doc.status] ?? doc.status;
  const statusColor = STATUS_COLOR[doc.status] ?? '#6b7280';
  const statusBg = STATUS_BG[doc.status] ?? '#f3f4f6';

  const handleOpen = () => {
    if (!doc.fileUrl) {
      toast.info('Fails vēl nav augšupielādēts.');
      return;
    }
    haptics.light();
    Linking.openURL(doc.fileUrl).catch(() => toast.error('Neizdevās atvērt dokumentu.'));
  };

  return (
    <TouchableOpacity style={s.row} onPress={handleOpen} activeOpacity={0.7}>
      <View style={[s.iconWrap, { backgroundColor: meta.iconBg }]}>
        <Icon size={20} color={meta.iconColor} />
      </View>

      <View style={s.rowBody}>
        <Text style={s.rowTitle} numberOfLines={1}>
          {doc.title}
        </Text>
        <View style={s.rowMeta}>
          <StatusPill label={statusLabel} bg={statusBg} color={statusColor} size="sm" />
          <Text style={s.rowSep}>·</Text>
          <Text style={s.rowDate}>{fmtDate(doc.createdAt)}</Text>
        </View>
        {doc.notes ? (
          <Text style={s.rowNotes} numberOfLines={1}>
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

// ── Main screen ───────────────────────────────────────────────

export default function DocumentsScreen() {
  const { token } = useAuth();
  const [docs, setDocs] = useState<ApiDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<DocTab>('ALL');

  const load = useCallback(
    async (silent = false) => {
      if (!token) return;
      if (!silent) setLoading(true);
      try {
        const res = await api.documents.getAll(token);
        // Filter out invoices — they live on the separate Invoices screen
        const nonInvoice = res.filter((d: ApiDocument) => d.type !== 'INVOICE');
        setDocs(nonInvoice);
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

  const onRefresh = () => {
    setRefreshing(true);
    load(true);
  };

  const visible =
    tab === 'ALL'
      ? docs
      : docs.filter((d) => d.type === tab || (tab === 'DELIVERY_NOTE' && d.type === 'CMR_NOTE'));

  const counts: Record<string, number> = { ALL: docs.length };
  for (const d of docs) {
    const key = d.type === 'CMR_NOTE' ? 'DELIVERY_NOTE' : d.type;
    counts[key] = (counts[key] ?? 0) + 1;
  }

  if (loading) {
    return (
      <ScreenContainer bg="#f9fafb">
        <ScreenHeader title="Dokumenti" />
        <View style={{ padding: 20 }}>
          <SkeletonCard count={5} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer bg="#f9fafb">
      <ScreenHeader title="Dokumenti" />

      {/* Tab filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.tabScroll}
        contentContainerStyle={s.tabContent}
      >
        {TABS.map((t) => {
          const count = counts[t.key] ?? 0;
          const active = tab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={[s.tab, active && s.tabActive]}
              onPress={() => {
                haptics.light();
                setTab(t.key);
              }}
              activeOpacity={0.75}
            >
              <Text style={[s.tabText, active && s.tabTextActive]}>{t.label}</Text>
              {count > 0 && (
                <View style={[s.tabBadge, active && s.tabBadgeActive]}>
                  <Text style={[s.tabBadgeText, active && s.tabBadgeTextActive]}>{count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* List */}
      <ScrollView
        style={s.list}
        contentContainerStyle={visible.length === 0 ? s.listEmpty : s.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#111827" />
        }
      >
        {visible.length === 0 ? (
          <EmptyState
            icon={<FolderOpen size={36} color="#9ca3af" />}
            title="Nav dokumentu"
            subtitle={
              tab === 'ALL'
                ? 'Dokumenti parādīsies pēc pasūtījumu izpildes.'
                : 'Nav dokumentu šajā kategorijā.'
            }
          />
        ) : (
          <View style={s.card}>
            {visible.map((doc, idx) => (
              <View key={doc.id}>
                <DocRow doc={doc} />
                {idx < visible.length - 1 && <View style={s.divider} />}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

// ── Styles ────────────────────────────────────────────────────

const s = StyleSheet.create({
  tabScroll: { flexGrow: 0 },
  tabContent: { paddingHorizontal: 16, paddingVertical: 12, gap: 8, flexDirection: 'row' },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  tabActive: { backgroundColor: '#111827', borderColor: '#111827' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  tabTextActive: { color: '#fff' },
  tabBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabBadgeActive: { backgroundColor: '#374151' },
  tabBadgeText: { fontSize: 11, fontWeight: '700', color: '#6b7280' },
  tabBadgeTextActive: { color: '#e5e7eb' },

  list: { flex: 1 },
  listContent: { padding: 16, gap: 0 },
  listEmpty: { flex: 1, paddingHorizontal: 16 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  divider: { height: 1, backgroundColor: '#f3f4f6', marginLeft: 68 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
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
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  rowStatus: { fontSize: 12, fontWeight: '600' },
  rowSep: { fontSize: 11, color: '#d1d5db' },
  rowDate: { fontSize: 12, color: '#9ca3af' },
  rowNotes: { fontSize: 12, color: '#6b7280' },
});

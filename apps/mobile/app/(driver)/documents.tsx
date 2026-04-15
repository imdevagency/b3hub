/**
 * documents.tsx — Driver: document hub
 * Shows all documents owned by the driver: CMR/delivery notes, weighing slips,
 * and any manually uploaded compliance files.
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Linking,
  RefreshControl,
} from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { StatusPill } from '@/components/ui/StatusPill';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import type { ApiDocument, DocumentType } from '@/lib/api';
import {
  Truck,
  Weight,
  ScrollText,
  FileText,
  FolderOpen,
  ExternalLink,
  Download,
} from 'lucide-react-native';
import { haptics } from '@/lib/haptics';

// ── Config ────────────────────────────────────────────────────

type DocFilter = 'ALL' | 'DELIVERY_NOTE' | 'WEIGHING_SLIP' | 'CONTRACT' | 'OTHER';

const TABS: { key: DocFilter; label: string }[] = [
  { key: 'ALL', label: 'Visi' },
  { key: 'DELIVERY_NOTE', label: 'CMR' },
  { key: 'WEIGHING_SLIP', label: 'Svēršana' },
  { key: 'CONTRACT', label: 'Līgumi' },
  { key: 'OTHER', label: 'Citi' },
];

const TYPE_META: Partial<
  Record<
    DocumentType | 'OTHER',
    { label: string; icon: React.ElementType; iconColor: string; iconBg: string }
  >
> = {
  DELIVERY_NOTE: { label: 'Pavadzīme / CMR', icon: Truck, iconColor: '#7c3aed', iconBg: '#f5f3ff' },
  WEIGHING_SLIP: { label: 'Svēršanas lapa', icon: Weight, iconColor: '#d97706', iconBg: '#fffbeb' },
  DELIVERY_PROOF: {
    label: 'Piegādes apstiprinājums',
    icon: FileText,
    iconColor: '#16a34a',
    iconBg: '#f0fdf4',
  },
  CONTRACT: { label: 'Līgums', icon: ScrollText, iconColor: '#374151', iconBg: '#f3f4f6' },
  OTHER: { label: 'Cits dokuments', icon: FileText, iconColor: '#6b7280', iconBg: '#f9fafb' },
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

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('lv-LV', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// ── Document Row ──────────────────────────────────────────────

function DocRow({ doc }: { doc: ApiDocument }) {
  const meta = TYPE_META[doc.type] ?? TYPE_META.OTHER!;
  const Icon = meta.icon;

  const handleOpen = async () => {
    if (!doc.fileUrl) {
      Alert.alert('Nav faila', 'Šim dokumentam nav pievienots fails.');
      return;
    }
    haptics.light();
    const can = await Linking.canOpenURL(doc.fileUrl);
    if (can) {
      await Linking.openURL(doc.fileUrl);
    } else {
      Alert.alert('Kļūda', 'Neizdevās atvērt dokumentu.');
    }
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
          <StatusPill
            label={STATUS_LABEL[doc.status] ?? doc.status}
            bg={STATUS_BG[doc.status] ?? '#f3f4f6'}
            color={STATUS_COLOR[doc.status] ?? '#6b7280'}
            size="sm"
          />
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

export default function DriverDocumentsScreen() {
  const { token } = useAuth();
  const [docs, setDocs] = useState<ApiDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<DocFilter>('ALL');

  const load = useCallback(
    async (silent = false) => {
      if (!token) return;
      if (!silent) setLoading(true);
      try {
        // Exclude INVOICE — drivers don't have invoices in their own name
        const all = await api.documents.getAll(token);
        setDocs(all.filter((d) => d.type !== 'INVOICE'));
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

  const filtered =
    tab === 'ALL'
      ? docs
      : tab === 'OTHER'
        ? docs.filter(
            (d) =>
              ![
                'DELIVERY_NOTE',
                'WEIGHING_SLIP',
                'CONTRACT',
                'DELIVERY_PROOF',
                'WASTE_CERTIFICATE',
                'INVOICE',
              ].includes(d.type),
          )
        : docs.filter((d) => d.type === tab);

  const cmrCount = docs.filter((d) => d.type === 'DELIVERY_NOTE').length;
  const slipCount = docs.filter((d) => d.type === 'WEIGHING_SLIP').length;

  if (loading) {
    return (
      <ScreenContainer bg="#f9fafb">
        <ScreenHeader title="Mani dokumenti" />
        <View style={{ padding: 20 }}>
          <SkeletonCard count={5} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer bg="#f9fafb">
      <ScreenHeader title="Mani dokumenti" />

      {/* Summary strip */}
      {docs.length > 0 && (
        <View style={s.summary}>
          <View style={s.summaryItem}>
            <Text style={s.summaryValue}>{docs.length}</Text>
            <Text style={s.summaryLabel}>Kopā</Text>
          </View>
          <View style={s.summaryDivider} />
          <View style={s.summaryItem}>
            <Text style={s.summaryValue}>{cmrCount}</Text>
            <Text style={s.summaryLabel}>CMR</Text>
          </View>
          <View style={s.summaryDivider} />
          <View style={s.summaryItem}>
            <Text style={s.summaryValue}>{slipCount}</Text>
            <Text style={s.summaryLabel}>Svēršanas</Text>
          </View>
        </View>
      )}

      {/* Tab bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.tabBar}
      >
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[s.tabBtn, tab === t.key && s.tabBtnActive]}
            onPress={() => setTab(t.key)}
            activeOpacity={0.7}
          >
            <Text style={[s.tabLabel, tab === t.key && s.tabLabelActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={filtered.length === 0 ? s.listEmpty : s.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00A878" />
        }
      >
        {filtered.length === 0 ? (
          <EmptyState
            icon={<FolderOpen size={36} color="#9ca3af" />}
            title="Nav dokumentu"
            subtitle={
              tab === 'ALL'
                ? 'Pabeidziet piegādi, lai automātiski saņemtu CMR un svēršanas lapu.'
                : 'Šajā kategorijā dokumentu nav.'
            }
          />
        ) : (
          <View style={s.card}>
            {filtered.map((doc, idx) => (
              <View key={doc.id}>
                <DocRow doc={doc} />
                {idx < filtered.length - 1 && <View style={s.divider} />}
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
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingVertical: 14,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: 20, fontWeight: '700', color: '#111827' },
  summaryLabel: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  summaryDivider: { width: 1, height: 32, backgroundColor: '#f3f4f6' },

  tabBar: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  tabBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
  },
  tabBtnActive: { backgroundColor: '#111827' },
  tabLabel: { fontSize: 13, fontWeight: '500', color: '#6b7280' },
  tabLabelActive: { color: '#fff' },

  listContent: { padding: 16 },
  listEmpty: { flex: 1, paddingHorizontal: 16 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  divider: { height: 1, backgroundColor: '#f3f4f6', marginLeft: 16 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1, gap: 4 },
  rowTitle: { fontSize: 14, fontWeight: '600', color: '#111827' },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  rowSep: { fontSize: 11, color: '#d1d5db' },
  rowDate: { fontSize: 12, color: '#6b7280' },
  rowNotes: { fontSize: 12, color: '#9ca3af' },
});

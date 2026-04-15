/**
 * documents.tsx — Seller: documents hub
 * Shows all documents associated with this seller's account:
 * contracts, delivery notes, weighing slips, and delivery proofs.
 */
import React, { useState, useCallback } from 'react';
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
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import type { ApiDocument, DocumentType } from '@/lib/api';
import { useFocusEffect } from 'expo-router';
import {
  FileText,
  Weight,
  ClipboardCheck,
  ScrollText,
  ExternalLink,
  FolderOpen,
  Handshake,
} from 'lucide-react-native';
import { haptics } from '@/lib/haptics';

// ── Config ────────────────────────────────────────────────────

type DocTab = 'ALL' | Exclude<DocumentType, 'INVOICE' | 'WASTE_CERTIFICATE'>;

const TABS: { key: DocTab; label: string }[] = [
  { key: 'ALL', label: 'Visi' },
  { key: 'WEIGHING_SLIP', label: 'Svēršanas' },
  { key: 'DELIVERY_PROOF', label: 'Piegādes' },
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
    icon: FileText,
    iconColor: '#059669',
    iconBg: '#ecfdf5',
  },
  DELIVERY_NOTE: {
    label: 'Piegādes pavadzīme',
    icon: ScrollText,
    iconColor: '#6b7280',
    iconBg: '#f9fafb',
  },
  CMR_NOTE: { label: 'CMR', icon: ScrollText, iconColor: '#6b7280', iconBg: '#f9fafb' },
  CONTRACT: { label: 'Līgums', icon: Handshake, iconColor: '#7c3aed', iconBg: '#f5f3ff' },
};

const FALLBACK_META = { label: 'Cits', icon: FileText, iconColor: '#6b7280', iconBg: '#f3f4f6' };

// ── Document Row ──────────────────────────────────────────────

function DocRow({ doc }: { doc: ApiDocument }) {
  const meta = TYPE_META[doc.type] ?? FALLBACK_META;
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
    <TouchableOpacity style={s.docRow} onPress={handleOpen} activeOpacity={0.7}>
      <View style={[s.docIcon, { backgroundColor: meta.iconBg }]}>
        <Icon size={18} color={meta.iconColor} />
      </View>
      <View style={s.docBody}>
        <Text style={s.docTitle} numberOfLines={1}>
          {doc.title}
        </Text>
        <Text style={s.docMeta}>
          {meta.label} ·{' '}
          {new Date(doc.createdAt).toLocaleDateString('lv-LV', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })}
        </Text>
      </View>
      {doc.fileUrl ? (
        <ExternalLink size={16} color="#9ca3af" />
      ) : (
        <View style={s.noFile}>
          <Text style={s.noFileText}>Nav faila</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ── Screen ────────────────────────────────────────────────────

export default function SellerDocuments() {
  const { token } = useAuth();
  const [docs, setDocs] = useState<ApiDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<DocTab>('ALL');

  const load = useCallback(
    async (refresh = false) => {
      if (!token) return;
      try {
        refresh ? setRefreshing(true) : setLoading(true);
        const data = await api.documents.getAll(token);
        // Exclude invoices — those belong on a dedicated invoices screen
        setDocs(data.filter((d) => d.type !== 'INVOICE'));
      } catch {
        // silently fail — empty state handles it
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token],
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

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
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor="#00A878"
          />
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
  tabScroll: { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  tabContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#f3f4f6',
  },
  tabActive: { backgroundColor: '#111827' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  tabTextActive: { color: '#ffffff' },
  tabBadge: {
    backgroundColor: '#e5e7eb',
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 18,
    alignItems: 'center',
  },
  tabBadgeActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  tabBadgeText: { fontSize: 11, fontWeight: '700', color: '#374151' },
  tabBadgeTextActive: { color: '#ffffff' },

  list: { flex: 1 },
  listContent: { padding: 16 },
  listEmpty: { flexGrow: 1 },

  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    overflow: 'hidden',
  },
  divider: { height: 1, backgroundColor: '#f3f4f6', marginLeft: 68 },

  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  docIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docBody: { flex: 1 },
  docTitle: { fontSize: 15, fontWeight: '600', color: '#111827' },
  docMeta: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  noFile: {
    backgroundColor: '#f3f4f6',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  noFileText: { fontSize: 11, fontWeight: '600', color: '#9ca3af' },
});

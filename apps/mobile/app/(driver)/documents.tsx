/**
 * documents.tsx — Driver: document hub
 * A minimal, Uber-like document screen. No unnecessary colors or boxes.
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Linking,
  RefreshControl,
} from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import type { ApiDocument, DocumentType } from '@/lib/api';
import type { ApiTransportJob } from '@/lib/api/transport';
import {
  Truck,
  Weight,
  ScrollText,
  FileText,
  FolderOpen,
  ArrowDownToLine,
} from 'lucide-react-native';
import { haptics } from '@/lib/haptics';
import { colors } from '@/lib/theme';
import { getDocumentStatusLabel } from '@/lib/status';

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
  Record<DocumentType | 'OTHER', { label: string; icon: React.ElementType }>
> = {
  DELIVERY_NOTE: { label: 'Pavadzīme / CMR', icon: Truck },
  WEIGHING_SLIP: { label: 'Svēršanas lapa', icon: Weight },
  DELIVERY_PROOF: { label: 'Piegādes apstiprinājums', icon: FileText },
  CONTRACT: { label: 'Līgums', icon: ScrollText },
  OTHER: { label: 'Cits dokuments', icon: FileText },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('lv-LV', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// ── Document Row ──────────────────────────────────────────────

function DocRow({ doc, job }: { doc: ApiDocument; job: ApiTransportJob | null }) {
  const meta = TYPE_META[doc.type] ?? TYPE_META.OTHER!;
  const Icon = meta.icon;

  const handleOpen = async () => {
    if (!doc.fileUrl) return;
    haptics.light();
    try {
      const can = await Linking.canOpenURL(doc.fileUrl);
      if (can) await Linking.openURL(doc.fileUrl);
    } catch {
      // silently ignore — URL is already validated server-side
    }
  };

  const hasFile = Boolean(doc.fileUrl);

  return (
    <TouchableOpacity
      style={[s.row, !hasFile && s.rowDisabled]}
      onPress={hasFile ? handleOpen : undefined}
      activeOpacity={hasFile ? 0.7 : 1}
    >
      <View style={s.iconWrap}>
        <Icon size={22} color={hasFile ? '#111827' : '#d1d5db'} strokeWidth={1.5} />
      </View>
      <View style={s.rowBody}>
        <Text style={[s.rowTitle, !hasFile && s.rowTitleDisabled]} numberOfLines={1}>
          {doc.title || meta.label}
        </Text>
        {job && (
          <Text style={s.rowRoute} numberOfLines={1}>
            {job.pickupCity} → {job.deliveryCity}
            {job.actualWeightKg != null
              ? ` · ${(job.actualWeightKg / 1000).toFixed(2)} t`
              : job.cargoWeight != null
                ? ` · ${job.cargoWeight} t`
                : ''}
            {job.distanceKm != null ? ` · ${Math.round(job.distanceKm)} km` : ''}
          </Text>
        )}
        <Text style={s.rowDate}>
          {fmtDate(doc.createdAt)} • {getDocumentStatusLabel(doc.status)}
          {!hasFile ? ' · Fails nav pieejams' : ''}
        </Text>
        {doc.notes ? (
          <Text style={s.rowNotes} numberOfLines={1}>
            {doc.notes}
          </Text>
        ) : null}
      </View>
      <View style={s.rowRight}>
        {hasFile ? (
          <ArrowDownToLine size={18} color="#111827" strokeWidth={1.5} />
        ) : (
          <View style={s.pendingDot} />
        )}
      </View>
    </TouchableOpacity>
  );
}

// ── Main screen ───────────────────────────────────────────────

export default function DriverDocumentsScreen() {
  const { token } = useAuth();
  const [docs, setDocs] = useState<ApiDocument[]>([]);
  const [jobsMap, setJobsMap] = useState<Map<string, ApiTransportJob>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<DocFilter>('ALL');

  const load = useCallback(
    async (silent = false) => {
      if (!token) return;
      if (!silent) setLoading(true);
      try {
        const [all, myJobs] = await Promise.all([
          api.documents.getAll(token),
          api.transportJobs.myJobs(token).catch(() => [] as ApiTransportJob[]),
        ]);
        setDocs(all.filter((d) => d.type !== 'INVOICE'));
        const map = new Map<string, ApiTransportJob>();
        for (const j of myJobs) map.set(j.id, j);
        setJobsMap(map);
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

  if (loading) {
    return (
      <ScreenContainer bg="#ffffff">
        <ScreenHeader title="Dokumenti" />
        <View style={{ padding: 20 }}>
          <SkeletonCard count={5} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer bg="#ffffff">
      <ScreenHeader title="Dokumenti" />

      {/* Tab bar */}
      <View style={s.tabScrollWrap}>
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
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={filtered.length === 0 ? s.listEmpty : s.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#111827" />
        }
      >
        {filtered.length === 0 ? (
          <EmptyState
            icon={<FolderOpen size={36} color="#d1d5db" strokeWidth={1} />}
            title="Nav dokumentu"
            subtitle={
              tab === 'ALL'
                ? 'Kad pabeigsiet piegādi, CMR un svēršanas lapas tiks saglabātas šeit.'
                : 'Kategorijā nav dokumentu.'
            }
          />
        ) : (
          <View style={s.listContainer}>
            {filtered.map((doc, idx) => (
              <View key={doc.id}>
                <DocRow
                  doc={doc}
                  job={doc.transportJobId ? (jobsMap.get(doc.transportJobId) ?? null) : null}
                />
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
  tabScrollWrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f3f4f6',
  },
  tabBar: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
  },
  tabBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  tabBtnActive: {
    backgroundColor: colors.primary,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textMuted,
  },
  tabLabelActive: {
    color: colors.white,
    fontWeight: '600',
  },

  listContent: {
    paddingBottom: 40,
  },
  listEmpty: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
    paddingBottom: 60, // visual balance
  },
  listContainer: {
    paddingTop: 8,
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.bgMuted,
    marginLeft: 68,
    marginRight: 20,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.bgCard,
  },
  iconWrap: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
    marginLeft: 12,
    gap: 2,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  rowRoute: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
    marginTop: 1,
  },
  rowDate: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  rowNotes: {
    fontSize: 13,
    color: colors.textDisabled,
    marginTop: 2,
  },
  rowRight: {
    marginLeft: 16,
    justifyContent: 'center',
  },
  rowDisabled: {
    opacity: 0.45,
  },
  rowTitleDisabled: {
    color: colors.textMuted,
  },
  pendingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#d1d5db',
  },
});

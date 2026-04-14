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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#111827" />
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
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import type { ApiTransportJob } from '@/lib/api';
import {
  MapPin,
  Weight,
  ClipboardCheck,
  ChevronRight,
  FolderOpen,
  Image as ImageIcon,
} from 'lucide-react-native';
import { haptics } from '@/lib/haptics';

// ── Helpers ───────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('lv-LV', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// ── Artifact badge ────────────────────────────────────────────

function ArtifactBadge({
  icon: Icon,
  label,
  present,
}: {
  icon: React.ElementType;
  label: string;
  present: boolean;
}) {
  return (
    <View style={[s.badge, present ? s.badgePresent : s.badgeMissing]}>
      <Icon size={11} color={present ? '#16a34a' : '#9ca3af'} />
      <Text style={[s.badgeText, present ? s.badgeTextPresent : s.badgeTextMissing]}>{label}</Text>
    </View>
  );
}

// ── Job row ───────────────────────────────────────────────────

function JobRow({ job, onPress }: { job: ApiTransportJob; onPress: () => void }) {
  const hasWeighingPhoto = !!job.pickupPhotoUrl;
  // A DELIVERED job always implies delivery proof was submitted
  const hasDeliveryProof = job.status === 'DELIVERED';

  return (
    <TouchableOpacity style={s.row} onPress={onPress} activeOpacity={0.7}>
      <View style={s.rowLeft}>
        {/* Route */}
        <View style={s.routeRow}>
          <MapPin size={12} color="#6b7280" />
          <Text style={s.routeText} numberOfLines={1}>
            {job.pickupCity} → {job.deliveryCity}
          </Text>
        </View>

        {/* Date + cargo */}
        <View style={s.metaRow}>
          <Text style={s.metaDate}>{fmtDate(job.deliveryDate)}</Text>
          {job.actualWeightKg != null && (
            <>
              <Text style={s.metaSep}>·</Text>
              <Text style={s.metaWeight}>{(job.actualWeightKg / 1000).toFixed(1)} t</Text>
            </>
          )}
          {job.rate > 0 && (
            <>
              <Text style={s.metaSep}>·</Text>
              <Text style={s.metaRate}>€{job.rate.toFixed(0)}</Text>
            </>
          )}
        </View>

        {/* Artifact badges */}
        <View style={s.badges}>
          <ArtifactBadge icon={Weight} label="Svēršana" present={hasWeighingPhoto} />
          <ArtifactBadge icon={ClipboardCheck} label="Piegāde" present={hasDeliveryProof} />
        </View>
      </View>

      <ChevronRight size={16} color="#d1d5db" />
    </TouchableOpacity>
  );
}

// ── Main screen ───────────────────────────────────────────────

export default function DriverDocumentsScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [jobs, setJobs] = useState<ApiTransportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (silent = false) => {
      if (!token) return;
      if (!silent) setLoading(true);
      try {
        const all = await api.transportJobs.myJobs(token);
        // Only keep completed deliveries
        const delivered = all.filter((j) => j.status === 'DELIVERED');
        // Sort newest first by deliveryDate
        delivered.sort(
          (a, b) => new Date(b.deliveryDate).getTime() - new Date(a.deliveryDate).getTime(),
        );
        setJobs(delivered);
      } catch {
        setJobs([]);
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

  const handleOpenWeighingPhoto = (url: string) => {
    haptics.light();
    Linking.openURL(url).catch(() => Alert.alert('Kļūda', 'Neizdevās atvērt attēlu.'));
  };

  const withPhotoCount = jobs.filter((j) => j.pickupPhotoUrl).length;
  const totalWeight = jobs.reduce((sum, j) => sum + (j.actualWeightKg ?? 0), 0);

  if (loading) {
    return (
      <ScreenContainer bg="#f9fafb">
        <ScreenHeader title="Mans darba vēsture" />
        <View style={{ padding: 20 }}>
          <SkeletonCard count={5} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer bg="#f9fafb">
      <ScreenHeader title="Mans darba vēsture" />

      {/* Summary strip */}
      {jobs.length > 0 && (
        <View style={s.summary}>
          <View style={s.summaryItem}>
            <Text style={s.summaryValue}>{jobs.length}</Text>
            <Text style={s.summaryLabel}>Piegādes</Text>
          </View>
          <View style={s.summaryDivider} />
          <View style={s.summaryItem}>
            <Text style={s.summaryValue}>{(totalWeight / 1000).toFixed(1)} t</Text>
            <Text style={s.summaryLabel}>Kopā pārvests</Text>
          </View>
          <View style={s.summaryDivider} />
          <View style={s.summaryItem}>
            <Text style={s.summaryValue}>{withPhotoCount}</Text>
            <Text style={s.summaryLabel}>Svēršanas foto</Text>
          </View>
        </View>
      )}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={jobs.length === 0 ? s.listEmpty : s.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#111827" />
        }
      >
        {jobs.length === 0 ? (
          <EmptyState
            icon={<FolderOpen size={36} color="#9ca3af" />}
            title="Nav izpildītu piegāžu"
            subtitle="Pabeidziet piegādi, un tā parādīsies šeit."
          />
        ) : (
          <View style={s.card}>
            {jobs.map((job, idx) => (
              <View key={job.id}>
                <JobRow
                  job={job}
                  onPress={() => {
                    haptics.light();
                    if (job.pickupPhotoUrl) {
                      // Offer: view weighing photo or go to job
                      Alert.alert(`Darbs #${job.jobNumber}`, 'Ko vēlaties darīt?', [
                        {
                          text: 'Skatīt svēršanas foto',
                          onPress: () => handleOpenWeighingPhoto(job.pickupPhotoUrl!),
                        },
                        {
                          text: 'Darba detaļas',
                          onPress: () =>
                            router.push({
                              pathname: '/(driver)/active',
                              params: { jobId: job.id },
                            }),
                        },
                        { text: 'Atcelt', style: 'cancel' },
                      ]);
                    } else {
                      router.push({
                        pathname: '/(driver)/active',
                        params: { jobId: job.id },
                      });
                    }
                  }}
                />
                {idx < jobs.length - 1 && <View style={s.divider} />}
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
  rowLeft: { flex: 1, gap: 5 },

  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  routeText: { fontSize: 14, fontWeight: '600', color: '#111827', flex: 1 },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaDate: { fontSize: 12, color: '#6b7280' },
  metaSep: { fontSize: 11, color: '#d1d5db' },
  metaWeight: { fontSize: 12, color: '#374151', fontWeight: '500' },
  metaRate: { fontSize: 12, color: '#374151', fontWeight: '600' },

  badges: { flexDirection: 'row', gap: 6, marginTop: 2 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
  },
  badgePresent: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  badgeMissing: { backgroundColor: '#f9fafb', borderColor: '#e5e7eb' },
  badgeText: { fontSize: 11, fontWeight: '600' },
  badgeTextPresent: { color: '#16a34a' },
  badgeTextMissing: { color: '#9ca3af' },
});

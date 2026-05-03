import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { getRecyclerWasteRecords } from '@/lib/api';
import type { WasteRecord } from '@/lib/api';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useHeaderConfig } from '@/lib/header-context';
import { haptics } from '@/lib/haptics';
import { colors } from '@/lib/theme';
import { FileText, Download, Scale } from 'lucide-react-native';

function RecordCard({ record }: { record: WasteRecord }) {
  const date = new Date(record.createdAt).toLocaleDateString('lv-LV', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const hasCertificate = !!record.certificateUrl;

  return (
    <View style={ls.card}>
      <View style={ls.cardTop}>
        <View style={ls.cardLeft}>
          <Text style={ls.recordId}>#{record.id.slice(-6).toUpperCase()}</Text>
          <Text style={ls.date}>{date}</Text>
        </View>
        {hasCertificate && (
          <View style={[ls.badge, { backgroundColor: '#dcfce7' }]}>
            <Text style={[ls.badgeText, { color: '#166534' }]}>Sertificēts</Text>
          </View>
        )}
      </View>

      <View style={ls.row}>
        <Text style={ls.typeLabel}>{record.wasteType}</Text>
      </View>

      {record.weightKg != null && (
        <View style={ls.metaRow}>
          <Scale size={13} color={colors.textMuted} />
          <Text style={ls.metaText}>
            {record.weightKg >= 1000
              ? `${(record.weightKg / 1000).toFixed(2)} t`
              : `${record.weightKg} kg`}
            {record.recyclableWeight != null && record.recyclingRate != null
              ? ` · ${record.recyclingRate.toFixed(0)}% reciklēts`
              : ''}
          </Text>
        </View>
      )}

      {record.certificateUrl && (
        <TouchableOpacity
          style={ls.downloadBtn}
          activeOpacity={0.8}
          onPress={() => {
            haptics.light();
            if (record.certificateUrl) Linking.openURL(record.certificateUrl);
          }}
        >
          <Download size={14} color={colors.primary} />
          <Text style={ls.downloadText}>Lejupielādēt sertifikātu</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function RecyclerRecordsScreen() {
  const { token } = useAuth();
  const { setConfig } = useHeaderConfig();
  const [records, setRecords] = useState<WasteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await getRecyclerWasteRecords(token);
      setRecords(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      setConfig({ title: 'Atkritumu ieraksti' });
      load();
      return () => setConfig(null);
    }, [load, setConfig]),
  );

  if (loading) {
    return (
      <ScreenContainer>
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </ScreenContainer>
    );
  }

  if (records.length === 0) {
    return (
      <ScreenContainer>
        <EmptyState
          icon="file-text"
          title="Nav ierakstu"
          description="Atkritumu pieņemšanas ieraksti parādīsies šeit"
        />
      </ScreenContainer>
    );
  }

  const certified = records.filter((r) => r.certificateUrl).length;
  const totalWeight = records.reduce((s, r) => s + (r.weightKg ?? 0), 0);

  return (
    <ScreenContainer>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }
        contentContainerStyle={ls.scroll}
      >
        {/* summary strip */}
        <View style={ls.summaryRow}>
          <View style={ls.summaryItem}>
            <Text style={ls.summaryValue}>{records.length}</Text>
            <Text style={ls.summaryLabel}>Kopā</Text>
          </View>
          <View style={ls.divider} />
          <View style={ls.summaryItem}>
            <Text style={ls.summaryValue}>{certified}</Text>
            <Text style={ls.summaryLabel}>Sertificēti</Text>
          </View>
          <View style={ls.divider} />
          <View style={ls.summaryItem}>
            <Text style={ls.summaryValue}>
              {totalWeight >= 1000
                ? `${(totalWeight / 1000).toFixed(1)}t`
                : `${totalWeight.toFixed(0)}kg`}
            </Text>
            <Text style={ls.summaryLabel}>Kopā svars</Text>
          </View>
        </View>

        {records.map((r) => (
          <RecordCard key={r.id} record={r} />
        ))}
      </ScrollView>
    </ScreenContainer>
  );
}

const ls = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 40 },
  summaryRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  summaryLabel: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  divider: { width: 1, height: 32, backgroundColor: '#E5E7EB' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 6,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardLeft: { gap: 2 },
  recordId: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  date: { fontSize: 12, color: colors.textMuted },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center' },
  typeLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 12, color: colors.textMuted },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingTop: 4,
  },
  downloadText: { fontSize: 13, color: colors.primary, fontWeight: '500' },
});

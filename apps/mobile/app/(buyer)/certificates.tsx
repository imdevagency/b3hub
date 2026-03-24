import React, { useState, useEffect, useCallback } from 'react';
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
import { ShieldCheck, FileDown, Recycle, Clock, ExternalLink } from 'lucide-react-native';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import type { ApiWasteRecord, WasteType } from '@/lib/api';

// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────

function RecordCard({ item }: { item: ApiWasteRecord }) {
  const typeColor = WASTE_TYPE_COLORS[item.wasteType] ?? '#6b7280';
  const typeLabel = WASTE_TYPE_LABELS[item.wasteType] ?? item.wasteType;
  const hasCertificate = !!item.certificateUrl;

  const handleOpenCertificate = () => {
    if (!item.certificateUrl) return;
    Linking.openURL(item.certificateUrl).catch(() =>
      Alert.alert('Kļūda', 'Neizdevās atvērt sertifikātu.'),
    );
  };

  return (
    <View style={s.card}>
      {/* Top row */}
      <View style={s.cardTopRow}>
        <View style={[s.typePill, { backgroundColor: typeColor + '18' }]}>
          <Text style={[s.typePillText, { color: typeColor }]}>{typeLabel}</Text>
        </View>
        {hasCertificate ? (
          <View style={s.certBadge}>
            <ShieldCheck size={12} color="#15803d" />
            <Text style={s.certBadgeText}>Sertificēts</Text>
          </View>
        ) : (
          <View style={s.pendingBadge}>
            <Clock size={12} color="#d97706" />
            <Text style={s.pendingBadgeText}>Gaida sertifikātu</Text>
          </View>
        )}
      </View>

      {/* Center detail */}
      <Text style={s.centerName}>{item.recyclingCenter.name}</Text>
      <Text style={s.centerCity}>{item.recyclingCenter.city}</Text>

      {/* Metrics row */}
      <View style={s.metricsRow}>
        <View style={s.metric}>
          <Text style={s.metricValue}>{item.weight.toFixed(2)}t</Text>
          <Text style={s.metricLabel}>Svars</Text>
        </View>
        {item.recyclableWeight != null && (
          <View style={s.metric}>
            <Text style={[s.metricValue, { color: '#16a34a' }]}>
              {item.recyclableWeight.toFixed(2)}t
            </Text>
            <Text style={s.metricLabel}>Pārstrādāts</Text>
          </View>
        )}
        {item.recyclingRate != null && (
          <View style={s.metric}>
            <View style={s.rateRow}>
              <Recycle size={13} color="#16a34a" />
              <Text style={[s.metricValue, { color: '#16a34a' }]}>
                {item.recyclingRate.toFixed(0)}%
              </Text>
            </View>
            <Text style={s.metricLabel}>Pārstrādes līmenis</Text>
          </View>
        )}
        {item.processedDate && (
          <View style={s.metric}>
            <Text style={s.metricValue}>
              {new Date(item.processedDate).toLocaleDateString('lv-LV', {
                day: 'numeric',
                month: 'short',
              })}
            </Text>
            <Text style={s.metricLabel}>Apstrādāts</Text>
          </View>
        )}
      </View>

      {/* Certificate download */}
      {hasCertificate && (
        <TouchableOpacity style={s.certBtn} onPress={handleOpenCertificate} activeOpacity={0.8}>
          <FileDown size={16} color="#15803d" />
          <Text style={s.certBtnText}>Atvērt sertifikātu</Text>
          <ExternalLink size={14} color="#15803d" />
        </TouchableOpacity>
      )}

      <Text style={s.cardDate}>
        {new Date(item.createdAt).toLocaleDateString('lv-LV', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function CertificatesScreen() {
  const { token } = useAuth();
  const [records, setRecords] = useState<ApiWasteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await api.recyclingCenters.myDisposalRecords(token);
      setRecords(res);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const certified = records.filter((r) => !!r.certificateUrl);
  const pending = records.filter((r) => !r.certificateUrl);

  return (
    <ScreenContainer bg="#f2f2f7" standalone>
      <ScreenHeader title="Sertifikāti" />

      {loading ? (
        <ActivityIndicator color="#16a34a" style={{ marginTop: 40 }} />
      ) : records.length === 0 ? (
        <View style={s.empty}>
          <ShieldCheck size={52} color="#d1d5db" />
          <Text style={s.emptyTitle}>Nav sertifikātu</Text>
          <Text style={s.emptyDesc}>
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
          {/* Summary bar */}
          <View style={s.summaryBar}>
            <View style={s.summaryItem}>
              <Text style={s.summaryNum}>{certified.length}</Text>
              <Text style={s.summaryLabel}>Sertificēti</Text>
            </View>
            <View style={s.summaryDivider} />
            <View style={s.summaryItem}>
              <Text style={[s.summaryNum, { color: '#d97706' }]}>{pending.length}</Text>
              <Text style={s.summaryLabel}>Gaida</Text>
            </View>
            <View style={s.summaryDivider} />
            <View style={s.summaryItem}>
              <Text style={s.summaryNum}>
                {records.reduce((acc, r) => acc + r.weight, 0).toFixed(1)}t
              </Text>
              <Text style={s.summaryLabel}>Kopā</Text>
            </View>
          </View>

          {records.map((r) => (
            <RecordCard key={r.id} item={r} />
          ))}
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#111827' },
  headerSub: { fontSize: 14, color: '#6b7280', marginTop: 2 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#374151' },
  emptyDesc: { fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 22 },

  summaryBar: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryItem: { alignItems: 'center', gap: 2 },
  summaryNum: { fontSize: 22, fontWeight: '700', color: '#111827' },
  summaryLabel: { fontSize: 12, color: '#9ca3af' },
  summaryDivider: { width: StyleSheet.hairlineWidth, height: 32, backgroundColor: '#e5e7eb' },

  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    gap: 8,
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  typePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  typePillText: { fontSize: 12, fontWeight: '700' },
  certBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  certBadgeText: { fontSize: 11, fontWeight: '600', color: '#374151' },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  pendingBadgeText: { fontSize: 11, fontWeight: '600', color: '#6b7280' },

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

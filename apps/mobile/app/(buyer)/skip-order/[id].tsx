import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SIZE_LABEL } from '@/lib/materials';
import {
  ArrowLeft,
  MapPin,
  CalendarDays,
  Trash2,
  Package,
  Phone,
  Mail,
  User,
  Star,
  FileText,
  XCircle,
} from 'lucide-react-native';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { haptics } from '@/lib/haptics';
import { SkeletonDetail } from '@/components/ui/Skeleton';
import type { SkipHireOrder } from '@/lib/api';
import { t } from '@/lib/translations';
import { RatingModal } from '@/components/ui/RatingModal';
import { StatusPill } from '@/components/ui/StatusPill';
import { formatDate } from '@/lib/format';
import { SectionLabel } from '@/components/ui/SectionLabel';

// ── Constants ──────────────────────────────────────────────────

const SKIP_STEPS: { key: string; label: string; hint: string }[] = [
  { key: 'PENDING', label: 'Saņemts', hint: 'Gaida apstiprinājumu' },
  { key: 'CONFIRMED', label: 'Apstiprināts', hint: 'Pārvadātājs piešķirts' },
  { key: 'DELIVERED', label: 'Piegādāts', hint: 'Konteiners piegādāts' },
  { key: 'COLLECTED', label: 'Savākts', hint: 'Konteiners savākts' },
  { key: 'COMPLETED', label: 'Pabeigts', hint: 'Pasūtījums pabeigts' },
];

const STEP_ORDER = ['PENDING', 'CONFIRMED', 'DELIVERED', 'COLLECTED', 'COMPLETED'];

// SIZE_LABEL imported from @/lib/materials

const WASTE_LABEL: Record<string, string> = {
  MIXED: 'Jaukts',
  GREEN_GARDEN: 'Zaļie atkritumi',
  CONCRETE_RUBBLE: 'Gruži',
  WOOD: 'Koks',
  METAL_SCRAP: 'Metāls',
  ELECTRONICS_WEEE: 'Elektronika',
};

// ── Detail Row ─────────────────────────────────────────────────

function Row({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | null | undefined;
  icon?: any;
}) {
  if (!value) return null;
  return (
    <View style={s.row}>
      {Icon && <Icon size={15} color="#6b7280" style={{ marginTop: 1 }} />}
      <View style={{ flex: 1 }}>
        <Text style={s.rowLabel}>{label}</Text>
        <Text style={s.rowValue}>{value}</Text>
      </View>
    </View>
  );
}

// ── Status Timeline ────────────────────────────────────────────

function StatusTimeline({ status }: { status: string }) {
  const currentIdx = STEP_ORDER.indexOf(status);
  if (status === 'CANCELLED') {
    return (
      <View style={[s.timelineRow, { backgroundColor: '#fee2e2', borderRadius: 12, padding: 14 }]}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#b91c1c' }}>
          Pasūtījums atcelts
        </Text>
      </View>
    );
  }
  return (
    <View style={s.timeline}>
      {SKIP_STEPS.map((step, idx) => {
        const done = idx < currentIdx;
        const active = idx === currentIdx;
        return (
          <View key={step.key} style={s.timelineItem}>
            <View style={s.timelineLeft}>
              <View
                style={[s.timelineDot, done && s.timelineDotDone, active && s.timelineDotActive]}
              >
                {done && <View style={s.timelineDotInner} />}
                {active && <View style={s.timelineDotActiveInner} />}
              </View>
              {idx < SKIP_STEPS.length - 1 && (
                <View style={[s.timelineLine, done && s.timelineLineDone]} />
              )}
            </View>
            <View style={s.timelineContent}>
              <Text style={[s.timelineLabel, (done || active) && s.timelineLabelActive]}>
                {step.label}
              </Text>
              {active && <Text style={s.timelineHint}>{step.hint}</Text>}
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ── Screen ─────────────────────────────────────────────────────

export default function SkipOrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const router = useRouter();
  const [order, setOrder] = useState<SkipHireOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRating, setShowRating] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!id || !token) return;
    api.skipHire
      .getById(id, token)
      .then(setOrder)
      .catch(() => {
        Alert.alert('Kļūda', 'Neizdevās ielādēt pasūtījumu.');
        router.back();
      })
      .finally(() => setLoading(false));
  }, [id, token]);

  if (loading) {
    return (
      <ScreenContainer bg="#f2f2f7">
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <ArrowLeft size={20} color="#111827" />
          </TouchableOpacity>
        </View>
        <SkeletonDetail />
      </ScreenContainer>
    );
  }

  if (!order) return null;

  const status = t.skipHire.status[order.status] ?? t.skipHire.status.PENDING;
  const canRate = order.status === 'COLLECTED' || order.status === 'COMPLETED';
  const canCancel = order.status === 'PENDING' || order.status === 'CONFIRMED';

  const handleCancel = () => {
    haptics.heavy();
    Alert.alert('Atcelt pasūtījumu?', 'Šo darbību nevar atsaukt.', [
      { text: 'Nē', style: 'cancel' },
      {
        text: 'Atcelt',
        style: 'destructive',
        onPress: async () => {
          if (!token) return;
          setCancelling(true);
          try {
            const updated = await api.skipHire.cancel(order.id, token);
            setOrder(updated);
            haptics.success();
          } catch (err: any) {
            haptics.error();
            Alert.alert('Kļūda', err?.message ?? 'Neizdevās atcelt pasūtījumu');
          } finally {
            setCancelling(false);
          }
        },
      },
    ]);
  };

  return (
    <ScreenContainer bg="#f2f2f7">
      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <ArrowLeft size={20} color="#111827" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle} numberOfLines={1}>
            #{order.orderNumber}
          </Text>
          <Text style={s.headerSub}>Konteinera pasūtījums</Text>
        </View>
        <StatusPill label={status.label} bg={status.bg} color={status.color} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {/* ── Status timeline ── */}
        <View style={s.section}>
          <SectionLabel label="Statuss" style={{ marginBottom: 8, marginTop: 0 }} />
          <StatusTimeline status={order.status} />
        </View>

        {/* ── Order details ── */}
        <View style={s.section}>
          <SectionLabel label="Pasūtījuma informācija" style={{ marginBottom: 8, marginTop: 0 }} />
          <View style={s.card}>
            <Row label="Piegādes vieta" value={order.location} icon={MapPin} />
            <Row
              label="Piegādes datums"
              value={formatDate(order.deliveryDate)}
              icon={CalendarDays}
            />
            <Row
              label="Konteinera izmērs"
              value={SIZE_LABEL[order.skipSize] ?? order.skipSize}
              icon={Package}
            />
            <Row
              label="Atkritumu veids"
              value={WASTE_LABEL[order.wasteCategory] ?? order.wasteCategory}
              icon={Trash2}
            />
            {order.notes ? <Row label="Piezīmes" value={order.notes} icon={FileText} /> : null}
          </View>
        </View>

        {/* ── Price ── */}
        <View style={s.section}>
          <View style={s.priceCard}>
            <Text style={s.priceLabel}>Kopā</Text>
            <Text style={s.priceValue}>
              €{order.price.toFixed(2)} {order.currency}
            </Text>
          </View>
        </View>

        {/* ── Contact ── */}
        {(order.contactName || order.contactEmail || order.contactPhone) && (
          <View style={s.section}>
            <SectionLabel label="Kontaktpersona" style={{ marginBottom: 8, marginTop: 0 }} />
            <View style={s.card}>
              <Row label="Vārds" value={order.contactName} icon={User} />
              <Row label="E-pasts" value={order.contactEmail} icon={Mail} />
              {order.contactPhone ? (
                <TouchableOpacity
                  style={s.row}
                  onPress={() =>
                    Linking.openURL(`tel:${order.contactPhone}`).catch(() =>
                      Alert.alert('Kļūda', 'Neizdevās iniciēt zvanu'),
                    )
                  }
                  activeOpacity={0.7}
                >
                  <Phone size={15} color="#6b7280" style={{ marginTop: 1 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowLabel}>Telefons</Text>
                    <Text style={[s.rowValue, { color: '#2563eb' }]}>{order.contactPhone}</Text>
                  </View>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        )}

        {/* ── Rate button ── */}
        {canRate && (
          <TouchableOpacity
            style={s.rateBtn}
            onPress={() => {
              haptics.medium();
              setShowRating(true);
            }}
            activeOpacity={0.85}
          >
            <Star size={16} color="#fff" fill="#fff" />
            <Text style={s.rateBtnText}>Novērtēt pakalpojumu</Text>
          </TouchableOpacity>
        )}

        {/* ── Cancel button (PENDING / CONFIRMED only) ── */}
        {canCancel && (
          <TouchableOpacity
            style={s.cancelBtn}
            onPress={handleCancel}
            disabled={cancelling}
            activeOpacity={0.85}
          >
            <XCircle size={16} color="#b91c1c" />
            <Text style={s.cancelBtnText}>{cancelling ? 'Atceļ...' : 'Atcelt pasūtījumu'}</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {showRating && token && (
        <RatingModal
          visible={showRating}
          onClose={() => setShowRating(false)}
          onSuccess={() => {
            setShowRating(false);
            // Refresh order state
            api.skipHire
              .getById(id, token)
              .then(setOrder)
              .catch(() => {});
          }}
          token={token}
          skipOrderId={order.id}
        />
      )}
    </ScreenContainer>
  );
}

// ── Styles ─────────────────────────────────────────────────────

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    backgroundColor: '#f2f2f7',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  headerSub: { fontSize: 12, color: '#9ca3af', marginTop: 1 },

  scroll: { paddingHorizontal: 16, gap: 0 },

  section: { marginBottom: 16 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f3f4f6',
  },
  rowLabel: { fontSize: 12, color: '#9ca3af', marginBottom: 2 },
  rowValue: { fontSize: 14, fontWeight: '600', color: '#111827' },

  priceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  priceLabel: { fontSize: 15, fontWeight: '600', color: '#374151' },
  priceValue: { fontSize: 22, fontWeight: '800', color: '#111827' },

  rateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#111827',
    borderRadius: 100,
    paddingVertical: 16,
    marginTop: 4,
  },
  rateBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#fca5a5',
    borderRadius: 100,
    paddingVertical: 14,
    marginTop: 8,
    backgroundColor: '#fff7f7',
  },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: '#b91c1c' },

  // ── Timeline ──
  timeline: { paddingLeft: 4, paddingVertical: 4 },
  timelineItem: { flexDirection: 'row', gap: 12, minHeight: 48 },
  timelineLeft: { alignItems: 'center', width: 20 },
  timelineDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineDotDone: { borderColor: '#111827', backgroundColor: '#111827' },
  timelineDotActive: { borderColor: '#111827', backgroundColor: '#fff' },
  timelineDotInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  timelineDotActiveInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#111827' },
  timelineLine: { flex: 1, width: 2, backgroundColor: '#e5e7eb', marginVertical: 2 },
  timelineLineDone: { backgroundColor: '#111827' },
  timelineContent: { flex: 1, paddingBottom: 16, paddingTop: 1 },
  timelineLabel: { fontSize: 14, fontWeight: '600', color: '#9ca3af' },
  timelineLabelActive: { color: '#111827' },
  timelineHint: { fontSize: 12, color: '#6b7280', marginTop: 2 },

  timelineRow: {},
});

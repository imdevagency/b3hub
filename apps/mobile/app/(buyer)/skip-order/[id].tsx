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
  RefreshControl,
} from 'react-native';
// Guard: expo-clipboard requires a native build (not available in Expo Go)
let Clipboard: { setStringAsync: (text: string) => Promise<void> } | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
  Clipboard = require('expo-clipboard');
} catch {
  /* Expo Go fallback */
}
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SIZE_LABEL } from '@/lib/materials';
import {
  MapPin,
  CalendarDays,
  Clock,
  Trash2,
  Package,
  Phone,
  Mail,
  User,
  Star,
  FileText,
  XCircle,
  RotateCcw,
  Copy,
} from 'lucide-react-native';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { haptics } from '@/lib/haptics';
import { SkeletonDetail } from '@/components/ui/Skeleton';
import { useSkipOrder } from '@/lib/use-skip-order';
import { t } from '@/lib/translations';
import { RatingModal } from '@/components/ui/RatingModal';
import { StatusPill } from '@/components/ui/StatusPill';
import { formatDate } from '@/lib/format';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { useToast } from '@/components/ui/Toast';
import { colors } from '@/lib/theme';

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
  icon?: React.ComponentType<{
    size?: number;
    color?: string;
    strokeWidth?: number;
    style?: object;
  }>;
}) {
  if (!value) return null;
  return (
    <View style={s.row}>
      {Icon && <Icon size={18} color="#9ca3af" style={{ marginTop: 1 }} />}
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
      <View style={[s.timelineRow, { backgroundColor: colors.dangerBg, borderRadius: 12, padding: 14 }]}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.dangerText }}>
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
  const toast = useToast();
  const router = useRouter();
  const { order, setOrder, loading, error, reload } = useSkipOrder(id);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = () => {
    setRefreshing(true);
    reload();
    // reload sets loading, but doesn't resolve a promise — give it a moment
    setTimeout(() => setRefreshing(false), 1000);
  };
  const [showRating, setShowRating] = useState(false);
  const [alreadyRated, setAlreadyRated] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (order && token && (order.status === 'COLLECTED' || order.status === 'COMPLETED')) {
      api.reviews
        .status({ skipOrderId: order.id }, token)
        .then(({ reviewed }) => setAlreadyRated(reviewed))
        .catch(() => {});
    }
  }, [order?.id, order?.status, token]);

  useEffect(() => {
    if (error) {
      toast.error('Neizdevās ielādēt pasūtījumu.')
      router.canGoBack() ? router.back() : router.replace('/(buyer)/orders' as any);
    }
  }, [error, router]);

  if (loading) {
    return (
      <ScreenContainer bg="#ffffff">
        <ScreenHeader title="Skip noma" />
        <SkeletonDetail />
      </ScreenContainer>
    );
  }

  if (!order) return null;

  const status = t.skipHire.status[order.status] ?? t.skipHire.status.PENDING;
  const canRate = (order.status === 'COLLECTED' || order.status === 'COMPLETED') && !alreadyRated;
  const canCancel = order.status === 'PENDING' || order.status === 'CONFIRMED';

  const handleCancel = () => {
    haptics.heavy();
    const cancelMsg =
      order.status === 'CONFIRMED'
        ? 'Konteiners jau ir piešķirts pārvadātājam. Atcelšana pēc apstiprināšanas var radīt papildu izmaksas. Sazinies ar mums, lai noskaidrotu atmaksas nosacījumus.'
        : 'Pasūtījums vēl nav apstiprināts. Atcelšana ir bezmaksas.';
    Alert.alert('Atcelt pasūtījumu?', cancelMsg, [
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
          } catch (err: unknown) {
            haptics.error();
            Alert.alert(
              'Kļūda',
              err instanceof Error ? err.message : 'Neizdevās atcelt pasūtījumu',
            );
          } finally {
            setCancelling(false);
          }
        },
      },
    ]);
  };

  return (
    <ScreenContainer bg="#ffffff">
      {/* ── Header ── */}
      <ScreenHeader
        title={`#${order.orderNumber}`}
        rightAction={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              onPress={async () => {
                await Clipboard?.setStringAsync(order.orderNumber);
                haptics.success();
              }}
              hitSlop={8}
              activeOpacity={0.6}
            >
              <Copy size={16} color="#6b7280" />
            </TouchableOpacity>
            <StatusPill label={status.label} bg={status.bg} color={status.color} />
          </View>
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* ── Status timeline ── */}
        <View style={s.section}>
          <Text style={[s.sectionTitle, { marginBottom: 12 }]}>Statuss</Text>
          <StatusTimeline status={order.status} />
        </View>

        {/* ── Order details ── */}
        <View style={s.section}>
          <Text style={[s.sectionTitle, { marginBottom: 12 }]}>Pasūtījuma informācija</Text>
          <View style={s.card}>
            <Row label="Piegādes vieta" value={order.location} icon={MapPin} />
            <Row
              label="Piegādes datums"
              value={formatDate(order.deliveryDate)}
              icon={CalendarDays}
            />
            {order.deliveryWindow && order.deliveryWindow !== 'ANY' && (
              <Row
                label="Piegādes laiks"
                value={order.deliveryWindow === 'AM' ? 'Rīts (8–12)' : 'Diena (12–17)'}
                icon={Clock}
              />
            )}
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
            <Text style={[s.sectionTitle, { marginBottom: 12 }]}>Kontaktpersona</Text>
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
                  <Phone size={18} color="#9ca3af" style={{ marginTop: 1 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowLabel}>Telefons</Text>
                    <Text style={[s.rowValue, { color: '#2563eb' }]}>{order.contactPhone}</Text>
                  </View>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        )}

        {/* ── Support contact (fallback when no operator contact set) ── */}
        {!order.contactName && !order.contactEmail && !order.contactPhone && (
          <View style={s.section}>
            <Text style={[s.sectionTitle, { marginBottom: 12 }]}>Palīdzība</Text>
            <View style={s.card}>
              <TouchableOpacity
                style={s.row}
                onPress={() =>
                  Linking.openURL('mailto:info@b3hub.lv').catch(() =>
                    Alert.alert('Kļūda', 'Neizdevās atvērt e-pasta lietotni'),
                  )
                }
                activeOpacity={0.7}
              >
                <Mail size={18} color="#9ca3af" style={{ marginTop: 1 }} />
                <View style={{ flex: 1 }}>
                  <Text style={s.rowLabel}>Sazinies ar mums</Text>
                  <Text style={[s.rowValue, { color: '#2563eb' }]}>info@b3hub.lv</Text>
                </View>
              </TouchableOpacity>
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

        {(order.status === 'COLLECTED' ||
          order.status === 'COMPLETED' ||
          order.status === 'CANCELLED') && (
          <TouchableOpacity
            style={s.reorderBtn}
            onPress={() => {
              haptics.medium();
              router.push('/order');
            }}
            activeOpacity={0.85}
          >
            <RotateCcw size={16} color="#fff" />
            <Text style={s.reorderBtnText}>Pasūtīt vēlreiz</Text>
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
            setAlreadyRated(true);
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    fontFamily: 'Inter_800ExtraBold',
    color: colors.textPrimary,
    letterSpacing: -0.4,
    marginTop: 24,
    paddingHorizontal: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  headerSub: { fontSize: 12, color: colors.textDisabled, marginTop: 1 },

  scroll: { paddingHorizontal: 16, gap: 0 },

  section: { marginBottom: 16 },

  card: {
    backgroundColor: '#F4F4F5',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 12,
  },
  rowLabel: { fontSize: 13, color: colors.textDisabled, marginBottom: 4 },
  rowValue: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },

  priceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primary,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 18,
    marginTop: 8,
  },
  priceLabel: { fontSize: 15, fontWeight: '600', color: colors.textDisabled },
  priceValue: { fontSize: 22, fontWeight: '800', color: colors.white },

  rateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
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
    paddingVertical: 12,
    marginTop: 8,
    backgroundColor: '#fff7f7',
  },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: colors.dangerText },
  reorderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 100,
    paddingVertical: 16,
    marginTop: 8,
  },
  reorderBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  // ── Timeline ──
  timeline: { paddingLeft: 4, paddingVertical: 4 },
  timelineItem: { flexDirection: 'row', gap: 12, minHeight: 48 },
  timelineLeft: { alignItems: 'center', width: 20 },
  timelineDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineDotDone: { borderColor: colors.textPrimary, backgroundColor: colors.primary },
  timelineDotActive: { borderColor: colors.textPrimary, backgroundColor: '#fff' },
  timelineDotInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  timelineDotActiveInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  timelineLine: { flex: 1, width: 2, backgroundColor: '#e5e7eb', marginVertical: 2 },
  timelineLineDone: { backgroundColor: colors.primary },
  timelineContent: { flex: 1, paddingBottom: 16, paddingTop: 1 },
  timelineLabel: { fontSize: 14, fontWeight: '600', color: colors.textDisabled },
  timelineLabelActive: { color: colors.textPrimary },
  timelineHint: { fontSize: 12, color: colors.textMuted, marginTop: 2 },

  timelineRow: {},
});

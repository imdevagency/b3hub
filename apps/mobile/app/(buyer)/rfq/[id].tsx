/**
 * (buyer)/rfq/[id].tsx
 *
 * Quote-request detail — shows the buyer's open RFQ and any supplier
 * responses so they can accept a quote and create an order.
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import type { QuoteRequest, QuoteResponse } from '@/lib/api';
import { CATEGORY_LABELS, UNIT_SHORT } from '@/lib/materials';
import { formatDateShort } from '@/lib/format';
import { MapPin, Package, Clock, CheckCircle, Star, XCircle } from 'lucide-react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { StatusPill } from '@/components/ui/StatusPill';
import { haptics } from '@/lib/haptics';
import { SkeletonDetail } from '@/components/ui/Skeleton';
import { ActionResultSheet } from '@/components/ui/ActionResultSheet';
import { useToast } from '@/components/ui/Toast';
import { colors } from '@/lib/theme';

// ── Status helpers ─────────────────────────────────────────────

const RFQ_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  PENDING: { label: 'Gaida piedāvājumus', bg: '#f3f4f6', color: colors.textMuted },
  QUOTED: { label: 'Ir piedāvājumi', bg: '#e5e7eb', color: colors.textPrimary },
  ACCEPTED: { label: 'Pieņemts', bg: '#f3f4f6', color: colors.textSecondary },
  CANCELLED: { label: 'Atcelts', bg: '#f9fafb', color: colors.textDisabled },
  EXPIRED: { label: 'Beidzies', bg: '#f9fafb', color: colors.textDisabled },
};

const RFQ_STATUS_HEADER_LABEL: Record<string, string> = {
  PENDING: 'Gaida',
  QUOTED: 'Piedāvājumi',
  ACCEPTED: 'Pieņemts',
  CANCELLED: 'Atcelts',
  EXPIRED: 'Beidzies',
};

// ── Component ──────────────────────────────────────────────────

export default function RfqDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const toast = useToast();

  const [rfq, setRfq] = useState<QuoteRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelResultVisible, setCancelResultVisible] = useState(false);
  const [acceptResultVisible, setAcceptResultVisible] = useState(false);
  const [acceptedOrderId, setAcceptedOrderId] = useState<string | null>(null);

  const load = useCallback(
    async (skeleton = true) => {
      if (!token || !id) return;
      if (skeleton) setLoading(true);
      try {
        const data = await api.quoteRequests.get(String(id), token);
        setRfq(data);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Neizdevās ielādēt pieprasījumu');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, id],
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleCancel = () => {
    if (!token || !rfq) return;
    Alert.alert(
      'Atcelt pieprasījumu?',
      'Visi saņemtie piedāvājumi tiks dzēsti un piegādātāji tiks informēti.',
      [
        { text: 'Nē', style: 'cancel' },
        {
          text: 'Atcelt pieprasījumu',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              await api.quoteRequests.cancel(rfq.id, token);
              haptics.success();
              setCancelResultVisible(true);
            } catch (e) {
              toast.error(e instanceof Error ? e.message : 'Neizdevās atcelt pieprasījumu');
            } finally {
              setCancelling(false);
            }
          },
        },
      ],
    );
  };

  const handleAccept = (response: QuoteResponse) => {
    if (!token || !rfq) return;
    Alert.alert(
      'Apstiprināt pasūtījumu?',
      `${response.supplier.name} · €${response.totalPrice.toFixed(2)} · ${response.etaDays} d.`,
      [
        { text: 'Atcelt', style: 'cancel' },
        {
          text: 'Pieņemt',
          onPress: async () => {
            setAccepting(response.id);
            try {
              const result = await api.quoteRequests.accept(rfq.id, response.id, token);
              haptics.success();
              setAcceptedOrderId(result.id);
              setAcceptResultVisible(true);
            } catch (e) {
              toast.error(e instanceof Error ? e.message : 'Neizdevās pieņemt piedāvājumu');
            } finally {
              setAccepting(null);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <ScreenContainer bg="#ffffff">
        <SkeletonDetail />
      </ScreenContainer>
    );
  }

  if (!rfq) {
    return (
      <ScreenContainer bg="#ffffff">
        <View style={ss.center}>
          <Text style={ss.emptyText}>Pieprasījums nav atrasts</Text>
          <TouchableOpacity
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace('/(buyer)/orders' as any)
            }
            style={{
              marginTop: 16,
              paddingVertical: 10,
              paddingHorizontal: 20,
              backgroundColor: colors.bgMuted,
              borderRadius: 10,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary }}>Atpakaļ</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  const st = RFQ_STATUS[rfq.status] ?? RFQ_STATUS.PENDING;
  const categoryLabel =
    CATEGORY_LABELS[rfq.materialCategory as keyof typeof CATEGORY_LABELS] ?? rfq.materialCategory;
  // Sort cheapest-first so the "Best" badge always lands on the lowest-price offer
  const sortedResponses = [...rfq.responses].sort((a, b) => a.totalPrice - b.totalPrice);

  return (
    <ScreenContainer bg="#ffffff">
      <ScreenHeader
        title={`Pieprasījums #${rfq.requestNumber}`}
        rightAction={
          <StatusPill
            label={RFQ_STATUS_HEADER_LABEL[rfq.status] ?? st.label}
            bg={st.bg}
            color={st.color}
            size="sm"
          />
        }
      />

      <ScrollView
        contentContainerStyle={[ss.scroll, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load(false);
            }}
            tintColor="#00A878"
          />
        }
      >
        {/* Request summary card */}
        <View style={ss.summaryCard}>
          <View style={ss.summaryRow}>
            <Package size={14} color="#6b7280" />
            <Text style={ss.summaryLabel}>Materiāls</Text>
            <Text style={ss.summaryValue} numberOfLines={1}>
              {categoryLabel} · {rfq.materialName}
            </Text>
          </View>
          <View style={ss.summaryDivider} />
          <View style={ss.summaryRow}>
            <Text style={ss.summaryLabel}>Daudzums</Text>
            <Text style={ss.summaryValue}>
              {rfq.quantity} {UNIT_SHORT[rfq.unit] ?? rfq.unit}
            </Text>
          </View>
          <View style={ss.summaryDivider} />
          <View style={ss.summaryRow}>
            <MapPin size={14} color="#6b7280" />
            <Text style={ss.summaryLabel}>Piegāde</Text>
            <Text style={ss.summaryValue} numberOfLines={1}>
              {rfq.deliveryCity || rfq.deliveryAddress}
            </Text>
          </View>
          <View style={ss.summaryDivider} />
          <View style={ss.summaryRow}>
            <Clock size={14} color="#6b7280" />
            <Text style={ss.summaryLabel}>Pieprasīts</Text>
            <Text style={ss.summaryValue}>{formatDateShort(rfq.createdAt)}</Text>
          </View>
        </View>

        {/* Responses */}
        {(rfq.status !== 'CANCELLED' && rfq.status !== 'EXPIRED') || sortedResponses.length > 0 ? (
          <Text style={ss.sectionTitle}>
            {sortedResponses.length === 0
              ? 'Vēl nav piedāvājumu'
              : `${sortedResponses.length} piedāvājum${sortedResponses.length === 1 ? 's' : 'i'}`}
          </Text>
        ) : null}

        {sortedResponses.length === 0 && rfq.status === 'PENDING' && (
          <View style={ss.emptyResponses}>
            <Clock size={32} color="#d1d5db" />
            <Text style={ss.emptyResponsesTitle}>Gaidām piegādātāju atbildes</Text>
            <Text style={ss.emptyResponsesDesc}>
              Saņemsi paziņojumu, kad piegādātāji nosūtīs savus piedāvājumus.
            </Text>
          </View>
        )}

        {sortedResponses.length === 0 && rfq.status === 'CANCELLED' && (
          <View style={[ss.emptyResponses, ss.emptyResponsesCancelled]}>
            <XCircle size={32} color="#fca5a5" />
            <Text style={[ss.emptyResponsesTitle, { color: colors.dangerText }]}>Pieprasījums atcelts</Text>
            <Text style={ss.emptyResponsesDesc}>
              Šis pieprasījums ir atcelts. Varat iesniegt jaunu pieprasījumu jebkurā laikā.
            </Text>
          </View>
        )}

        {sortedResponses.length === 0 && rfq.status === 'EXPIRED' && (
          <View style={[ss.emptyResponses, ss.emptyResponsesExpired]}>
            <Clock size={32} color="#d1d5db" />
            <Text style={[ss.emptyResponsesTitle, { color: colors.textMuted }]}>
              Piedāvājumu laiks beidzies
            </Text>
            <Text style={ss.emptyResponsesDesc}>
              Neviens piegādātājs neatbildēja laikā. Varat iesniegt jaunu pieprasījumu.
            </Text>
          </View>
        )}

        {/* Cancel button — only while request is still open */}
        {(rfq.status === 'PENDING' || rfq.status === 'QUOTED') && (
          <TouchableOpacity
            style={ss.cancelBtn}
            onPress={() => {
              haptics.medium();
              handleCancel();
            }}
            disabled={cancelling}
            activeOpacity={0.8}
          >
            {cancelling ? (
              <ActivityIndicator color="#ef4444" size="small" />
            ) : (
              <>
                <XCircle size={15} color="#ef4444" />
                <Text style={ss.cancelBtnText}>Atcelt pieprasījumu</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {sortedResponses.map((resp, idx) => (
          <View key={resp.id} style={ss.responseCard}>
            {idx === 0 && rfq.responses.length > 1 && (
              <View style={ss.bestBadge}>
                <Star size={10} color="#fff" fill="#fff" />
                <Text style={ss.bestBadgeText}>Labākais</Text>
              </View>
            )}
            <View style={ss.responseTop}>
              <Text style={ss.supplierName}>{resp.supplier.name}</Text>
              {resp.supplier.city && <Text style={ss.supplierCity}>{resp.supplier.city}</Text>}
            </View>
            <View style={ss.priceRow}>
              <View>
                <Text style={ss.priceMain}>€{resp.totalPrice.toFixed(2)}</Text>
                <Text style={ss.priceSub}>
                  €{resp.pricePerUnit.toFixed(2)} / {UNIT_SHORT[resp.unit] ?? resp.unit}
                </Text>
              </View>
              <View style={ss.etaChip}>
                <Text
                  style={{
                    fontSize: 10,
                    color: colors.textDisabled,
                    fontWeight: '500' as const,
                    lineHeight: 13,
                  }}
                >
                  Piegāde
                </Text>
                <Text style={ss.etaText}>{resp.etaDays} d.</Text>
              </View>
            </View>
            {resp.notes && (
              <Text style={ss.respNotes} numberOfLines={3}>
                {resp.notes}
              </Text>
            )}
            {resp.validUntil && (
              <Text style={ss.validUntil}>Derīgs līdz {formatDateShort(resp.validUntil)}</Text>
            )}
            {rfq.status !== 'ACCEPTED' &&
              rfq.status !== 'CANCELLED' &&
              rfq.status !== 'EXPIRED' && (
                <TouchableOpacity
                  style={[ss.acceptBtn, accepting === resp.id && { opacity: 0.6 }]}
                  onPress={() => {
                    haptics.medium();
                    handleAccept(resp);
                  }}
                  disabled={accepting !== null}
                  activeOpacity={0.85}
                >
                  {accepting === resp.id ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <CheckCircle size={15} color="#fff" />
                      <Text style={ss.acceptBtnText}>Pieņemt piedāvājumu</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
          </View>
        ))}
      </ScrollView>

      <ActionResultSheet
        visible={cancelResultVisible}
        onClose={() => setCancelResultVisible(false)}
        variant="cancelled"
        title="Pieprasījums atcelts"
        subtitle="Piegādātāji tika informēti. Varat iesniegt jaunu pieprasījumu jebkurā laikā."
        primaryLabel="Jauns pieprasījums"
        onPrimary={() => {
          setCancelResultVisible(false);
          router.replace('/order-request-new');
        }}
        secondaryLabel="Uz maniem pieprasījumiem"
        onSecondary={() => {
          setCancelResultVisible(false);
          router.replace('/(buyer)/orders');
        }}
      />

      <ActionResultSheet
        visible={acceptResultVisible}
        onClose={() => {
          setAcceptResultVisible(false);
          router.replace('/(buyer)/orders');
        }}
        variant="success"
        title="Pasūtījums izveidots"
        subtitle="Apmaksājiet pasūtījumu, lai pārdevējs to apstiprinātu."
        primaryLabel="Apmaksāt tagad"
        onPrimary={() => {
          setAcceptResultVisible(false);
          if (acceptedOrderId) router.replace(`/(buyer)/order/${acceptedOrderId}` as any);
        }}
        secondaryLabel="Vēlāk"
        onSecondary={() => {
          setAcceptResultVisible(false);
          router.replace('/(buyer)/orders');
        }}
      />
    </ScreenContainer>
  );
}

const ss = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgCard },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgCard },
  emptyText: { fontSize: 15, color: colors.textMuted },
  link: { fontSize: 15, color: colors.textPrimary, fontWeight: '600' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.bgCard,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f3f4f6',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bgMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyResponsesCancelled: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  emptyResponsesExpired: {
    backgroundColor: colors.bgSubtle,
    borderColor: colors.border,
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  statusPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 4,
  },
  statusPillText: { fontSize: 11, fontWeight: '600' },

  // Scroll
  scroll: { padding: 16, gap: 16 }, // increased gap slightly

  // Summary card
  summaryCard: {
    backgroundColor: colors.bgSubtle,
    borderRadius: 20,
    padding: 18, // slightly more padding
    borderWidth: 0,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  summaryLabel: { fontSize: 14, color: colors.textMuted, width: 90 }, // slightly larger label
  summaryValue: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  summaryDivider: { height: 1, backgroundColor: '#e5e7eb', marginVertical: 4 }, // light divider

  // Section title
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginTop: 8 },

  // Empty responses
  emptyResponses: {
    backgroundColor: colors.bgCard,
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  emptyResponsesTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' },
  emptyResponsesDesc: { fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },

  // Response card
  responseCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    gap: 10,
  },
  bestBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary, // Keep black for contrast
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 4,
  },
  bestBadgeText: { color: colors.white, fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },
  responseTop: { gap: 2 },
  supplierName: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  supplierCity: { fontSize: 13, color: colors.textMuted },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  priceMain: { fontSize: 24, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5 },
  priceSub: { fontSize: 13, color: colors.textMuted, marginTop: 1 },
  etaChip: {
    backgroundColor: colors.bgMuted,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  etaText: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  respNotes: { fontSize: 13, color: colors.textMuted, lineHeight: 20, marginTop: 4 },
  validUntil: { fontSize: 12, color: colors.textDisabled, marginTop: 2 },
  acceptBtn: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  acceptBtnText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  cancelBtn: {
    borderWidth: 1.5,
    borderColor: '#fecaca',
    backgroundColor: '#fff5f5',
    borderRadius: 16,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  cancelBtnText: { color: '#ef4444', fontSize: 15, fontWeight: '700' },
});

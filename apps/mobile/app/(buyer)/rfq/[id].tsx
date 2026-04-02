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
import { MapPin, Package, Clock, CheckCircle, Star } from 'lucide-react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { StatusPill } from '@/components/ui/StatusPill';
import { haptics } from '@/lib/haptics';
import { SkeletonDetail } from '@/components/ui/Skeleton';

// ── Status helpers ─────────────────────────────────────────────

const RFQ_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  PENDING: { label: 'Gaida piedāvājumus', bg: '#f3f4f6', color: '#6b7280' },
  QUOTED: { label: 'Ir piedāvājumi', bg: '#e5e7eb', color: '#111827' },
  ACCEPTED: { label: 'Pieņemts', bg: '#f3f4f6', color: '#374151' },
  CANCELLED: { label: 'Atcelts', bg: '#f9fafb', color: '#9ca3af' },
  EXPIRED: { label: 'Beidzies', bg: '#f9fafb', color: '#9ca3af' },
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

  const [rfq, setRfq] = useState<QuoteRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [accepting, setAccepting] = useState<string | null>(null);

  const load = useCallback(
    async (skeleton = true) => {
      if (!token || !id) return;
      if (skeleton) setLoading(true);
      try {
        const data = await api.quoteRequests.get(String(id), token);
        setRfq(data);
      } catch (e) {
        Alert.alert('Kļūda', e instanceof Error ? e.message : 'Neizdevās ielādēt pieprasījumu');
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
              await api.quoteRequests.accept(rfq.id, response.id, token);
              haptics.success();
              Alert.alert('✓ Pasūtījums izveidots', 'Skatīt pasūtījumu sarakstā.', [
                {
                  text: 'Labi',
                  onPress: () => router.replace('/(buyer)/orders'),
                },
              ]);
            } catch (e) {
              Alert.alert(
                'Kļūda',
                e instanceof Error ? e.message : 'Neizdevās pieņemt piedāvājumu',
              );
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
      <ScreenContainer standalone bg="#ffffff">
        <SkeletonDetail />
      </ScreenContainer>
    );
  }

  if (!rfq) {
    return (
      <ScreenContainer standalone bg="#ffffff">
        <View style={ss.center}>
          <Text style={ss.emptyText}>Pieprasījums nav atrasts</Text>
          <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
            <Text style={ss.link}>← Atpakaļ</Text>
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
    <ScreenContainer standalone bg="#ffffff">
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
            tintColor="#111827"
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
        <Text style={ss.sectionTitle}>
          {sortedResponses.length === 0
            ? 'Vēl nav piedāvājumu'
            : `${sortedResponses.length} piedāvājum${sortedResponses.length === 1 ? 's' : 'i'}`}
        </Text>

        {sortedResponses.length === 0 && (
          <View style={ss.emptyResponses}>
            <Clock size={32} color="#d1d5db" />
            <Text style={ss.emptyResponsesTitle}>Gaidām piegādātāju atbildes</Text>
            <Text style={ss.emptyResponsesDesc}>
              Saņemsi paziņojumu, kad piegādātāji nosūtīs savus piedāvājumus.
            </Text>
          </View>
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
                    color: '#9ca3af',
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
    </ScreenContainer>
  );
}

const ss = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#ffffff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' },
  emptyText: { fontSize: 15, color: '#6b7280' },
  link: { fontSize: 15, color: '#111827', fontWeight: '600' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f3f4f6',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
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
    backgroundColor: '#f9fafb',
    borderRadius: 20,
    padding: 18, // slightly more padding
    borderWidth: 0,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  summaryLabel: { fontSize: 14, color: '#6b7280', width: 90 }, // slightly larger label
  summaryValue: { flex: 1, fontSize: 14, fontWeight: '700', color: '#111827' },
  summaryDivider: { height: 1, backgroundColor: '#e5e7eb', marginVertical: 4 }, // light divider

  // Section title
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginTop: 8 },

  // Empty responses
  emptyResponses: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  emptyResponsesTitle: { fontSize: 15, fontWeight: '700', color: '#111827', textAlign: 'center' },
  emptyResponsesDesc: { fontSize: 13, color: '#6b7280', textAlign: 'center', lineHeight: 20 },

  // Response card
  responseCard: {
    backgroundColor: '#ffffff',
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
    backgroundColor: '#111827', // Keep black for contrast
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 4,
  },
  bestBadgeText: { color: '#ffffff', fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },
  responseTop: { gap: 2 },
  supplierName: { fontSize: 16, fontWeight: '700', color: '#111827' },
  supplierCity: { fontSize: 13, color: '#6b7280' },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  priceMain: { fontSize: 24, fontWeight: '800', color: '#111827', letterSpacing: -0.5 },
  priceSub: { fontSize: 13, color: '#6b7280', marginTop: 1 },
  etaChip: {
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  etaText: { fontSize: 14, fontWeight: '700', color: '#111827' },
  respNotes: { fontSize: 13, color: '#6b7280', lineHeight: 20, marginTop: 4 },
  validUntil: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  acceptBtn: {
    backgroundColor: '#111827',
    borderRadius: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  acceptBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
});

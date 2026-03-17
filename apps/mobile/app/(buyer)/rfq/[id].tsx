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
import { ChevronLeft, MapPin, Package, Clock, CheckCircle, Star } from 'lucide-react-native';
import { haptics } from '@/lib/haptics';

// ── Status helpers ─────────────────────────────────────────────

const RFQ_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  PENDING:   { label: 'Gaida piedāvājumus', bg: '#fef3c7',  color: '#d97706' },
  QUOTED:    { label: 'Ir piedāvājumi',      bg: '#d1fae5',  color: '#059669' },
  ACCEPTED:  { label: 'Pieņemts',            bg: '#dcfce7',  color: '#15803d' },
  CANCELLED: { label: 'Atcelts',             bg: '#f3f4f6',  color: '#6b7280' },
  EXPIRED:   { label: 'Beidzies',            bg: '#f3f4f6',  color: '#9ca3af' },
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
              Alert.alert('Kļūda', e instanceof Error ? e.message : 'Neizdevās pieņemt piedāvājumu');
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
      <View style={[ss.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color="#111827" />
      </View>
    );
  }

  if (!rfq) {
    return (
      <View style={[ss.center, { paddingTop: insets.top }]}>
        <Text style={ss.emptyText}>Pieprasījums nav atrasts</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={ss.link}>← Atpakaļ</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const st = RFQ_STATUS[rfq.status] ?? RFQ_STATUS.PENDING;
  const categoryLabel = CATEGORY_LABELS[rfq.materialCategory] ?? rfq.materialCategory;

  return (
    <View style={[ss.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={ss.header}>
        <TouchableOpacity
          style={ss.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <ChevronLeft size={22} color="#111827" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={ss.headerTitle} numberOfLines={1}>
            Pieprasījums #{rfq.requestNumber}
          </Text>
          <View style={[ss.statusPill, { backgroundColor: st.bg }]}>
            <Text style={[ss.statusPillText, { color: st.color }]}>{st.label}</Text>
          </View>
        </View>
      </View>

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
          {rfq.responses.length === 0
            ? 'Vēl nav piedāvājumu'
            : `${rfq.responses.length} piedāvājum${rfq.responses.length === 1 ? 's' : 'i'}`}
        </Text>

        {rfq.responses.length === 0 && (
          <View style={ss.emptyResponses}>
            <Clock size={32} color="#d1d5db" />
            <Text style={ss.emptyResponsesTitle}>Gaidām piegādātāju atbildes</Text>
            <Text style={ss.emptyResponsesDesc}>
              Saņemsi paziņojumu, kad piegādātāji nosūtīs savus piedāvājumus.
            </Text>
          </View>
        )}

        {rfq.responses.map((resp, idx) => (
          <View key={resp.id} style={ss.responseCard}>
            {idx === 0 && rfq.responses.length > 1 && (
              <View style={ss.bestBadge}>
                <Star size={10} color="#fff" fill="#fff" />
                <Text style={ss.bestBadgeText}>Labākais</Text>
              </View>
            )}
            <View style={ss.responseTop}>
              <Text style={ss.supplierName}>{resp.supplier.name}</Text>
              {resp.supplier.city && (
                <Text style={ss.supplierCity}>{resp.supplier.city}</Text>
              )}
            </View>
            <View style={ss.priceRow}>
              <View>
                <Text style={ss.priceMain}>€{resp.totalPrice.toFixed(2)}</Text>
                <Text style={ss.priceSub}>
                  €{resp.pricePerUnit.toFixed(2)} / {UNIT_SHORT[resp.unit] ?? resp.unit}
                </Text>
              </View>
              <View style={ss.etaChip}>
                <Text style={ss.etaText}>{resp.etaDays} d.</Text>
              </View>
            </View>
            {resp.notes && (
              <Text style={ss.respNotes} numberOfLines={3}>
                {resp.notes}
              </Text>
            )}
            {resp.validUntil && (
              <Text style={ss.validUntil}>
                Derīgs līdz {formatDateShort(resp.validUntil)}
              </Text>
            )}
            {rfq.status !== 'ACCEPTED' && rfq.status !== 'CANCELLED' && rfq.status !== 'EXPIRED' && (
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
    </View>
  );
}

const ss = StyleSheet.create({
  root:     { flex: 1, backgroundColor: '#f2f2f7' },
  center:   { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f2f2f7' },
  emptyText: { fontSize: 15, color: '#6b7280' },
  link:     { fontSize: 15, color: '#111827', fontWeight: '600' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
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
  scroll: { padding: 16, gap: 12 },

  // Summary card
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  summaryLabel: { fontSize: 13, color: '#6b7280', width: 80 },
  summaryValue: { flex: 1, fontSize: 13, fontWeight: '600', color: '#111827' },
  summaryDivider: { height: StyleSheet.hairlineWidth, backgroundColor: '#f3f4f6' },

  // Section title
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginTop: 4 },

  // Empty responses
  emptyResponses: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
  },
  emptyResponsesTitle: { fontSize: 15, fontWeight: '600', color: '#374151', textAlign: 'center' },
  emptyResponsesDesc: { fontSize: 13, color: '#9ca3af', textAlign: 'center', lineHeight: 20 },

  // Response card
  responseCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
    gap: 10,
  },
  bestBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#111827',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  bestBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700', letterSpacing: 0.2 },
  responseTop: { gap: 2 },
  supplierName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  supplierCity:  { fontSize: 12, color: '#6b7280' },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  priceMain: { fontSize: 22, fontWeight: '800', color: '#111827' },
  priceSub:  { fontSize: 12, color: '#6b7280', marginTop: 1 },
  etaChip: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  etaText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  respNotes: { fontSize: 13, color: '#6b7280', lineHeight: 19 },
  validUntil: { fontSize: 11, color: '#9ca3af' },
  acceptBtn: {
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 4,
  },
  acceptBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});

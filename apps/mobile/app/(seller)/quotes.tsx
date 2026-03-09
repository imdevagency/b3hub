/**
 * quotes.tsx — Seller: browse open buyer quote requests and submit price proposals
 *
 * Flow:
 *   List of open requests → tap card to expand details → "Submit Proposal" → Modal form → Success
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  FileText,
  ChevronDown,
  ChevronUp,
  MapPin,
  Package,
  Clock,
  User,
  CheckCircle2,
  Send,
  SlidersHorizontal,
  RefreshCw,
  X,
  Minus,
  Plus,
} from 'lucide-react-native';
import { useAuth } from '@/lib/auth-context';
import { api, type OpenQuoteRequest, type MaterialUnit } from '@/lib/api';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { t } from '@/lib/translations';

// ── Constants ──────────────────────────────────────────────────────────────────

const ACCENT = '#16a34a';
const ACCENT_LIGHT = '#dcfce7';
const ACCENT_DIM = '#14532d';
const WARN_BG = '#fef3c7';
const WARN_COLOR = '#d97706';
const BLUE_BG = '#dbeafe';
const BLUE_COLOR = '#2563eb';

const CATEGORY_EMOJI: Record<string, string> = {
  SAND: '🏜️',
  GRAVEL: '🪨',
  STONE: '🗿',
  CONCRETE: '🧱',
  SOIL: '🌱',
  RECYCLED_CONCRETE: '♻️',
  RECYCLED_SOIL: '🌿',
  ASPHALT: '🛣️',
  CLAY: '🟤',
  OTHER: '📦',
};

const sq = t.sellerQuotes;

// ── Helpers ────────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Tikko';
  if (mins < 60) return `${mins} min. atpakaļ`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} st. atpakaļ`;
  const days = Math.floor(hrs / 24);
  return `${days} d. atpakaļ`;
}

// ── Proposal Modal ─────────────────────────────────────────────────────────────

interface ProposalModalProps {
  request: OpenQuoteRequest;
  visible: boolean;
  onClose: () => void;
  onSuccess: (requestId: string) => void;
  token: string;
}

function ProposalModal({ request, visible, onClose, onSuccess, token }: ProposalModalProps) {
  const [priceText, setPriceText] = useState('');
  const [etaDays, setEtaDays] = useState(2);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const scaleAnim = React.useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    if (visible) {
      setPriceText('');
      setEtaDays(2);
      setNotes('');
      setDone(false);
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 120,
        friction: 8,
      }).start();
    }
  }, [visible]);

  const handleSubmit = async () => {
    const price = parseFloat(priceText.replace(',', '.'));
    if (isNaN(price) || price <= 0) {
      Alert.alert(sq.errorTitle, sq.errorInvalidPrice);
      return;
    }
    setSubmitting(true);
    try {
      await api.quoteRequests.respond(
        request.id,
        {
          pricePerUnit: price,
          unit: request.unit,
          etaDays,
          notes: notes.trim() || undefined,
        },
        token,
      );
      setDone(true);
      setTimeout(() => {
        onSuccess(request.id);
        onClose();
      }, 1600);
    } catch (err: any) {
      Alert.alert(sq.errorTitle, err?.message ?? 'Neizdevās iesniegt piedāvājumu.');
    } finally {
      setSubmitting(false);
    }
  };

  const unitLabel = sq.units[request.unit] ?? request.unit;
  const categoryLabel = sq.categories[request.materialCategory] ?? request.materialCategory;
  const emoji = CATEGORY_EMOJI[request.materialCategory] ?? '📦';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <Animated.View style={[styles.modalCard, { transform: [{ scale: scaleAnim }] }]}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>{sq.modalTitle}</Text>
              <Text style={styles.modalSubtitle}>
                {emoji} {categoryLabel} · {request.quantity} {unitLabel} · {request.deliveryCity}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.modalClose} hitSlop={12}>
              <X size={20} color="#6b7280" />
            </TouchableOpacity>
          </View>

          {done ? (
            /* Success state */
            <View style={styles.successBox}>
              <CheckCircle2 size={48} color={ACCENT} />
              <Text style={styles.successTitle}>{sq.successTitle}</Text>
              <Text style={styles.successMsg}>{sq.successMsg}</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Price */}
              <Text style={styles.fieldLabel}>{sq.priceLabel}</Text>
              <View style={styles.priceRow}>
                <TextInput
                  style={styles.priceInput}
                  placeholder={sq.pricePlaceholder}
                  placeholderTextColor="#9ca3af"
                  keyboardType="decimal-pad"
                  value={priceText}
                  onChangeText={setPriceText}
                />
                <View style={styles.priceUnit}>
                  <Text style={styles.priceUnitText}>EUR / {unitLabel}</Text>
                </View>
              </View>

              {/* ETA days */}
              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>{sq.etaLabel}</Text>
              <View style={styles.stepper}>
                <TouchableOpacity
                  style={styles.stepBtn}
                  onPress={() => setEtaDays((d) => Math.max(1, d - 1))}
                  hitSlop={8}
                >
                  <Minus size={18} color={ACCENT} />
                </TouchableOpacity>
                <Text style={styles.stepValue}>{etaDays}</Text>
                <TouchableOpacity
                  style={styles.stepBtn}
                  onPress={() => setEtaDays((d) => Math.min(30, d + 1))}
                  hitSlop={8}
                >
                  <Plus size={18} color={ACCENT} />
                </TouchableOpacity>
              </View>

              {/* Notes */}
              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>{sq.notesLabel}</Text>
              <TextInput
                style={styles.notesInput}
                placeholder={sq.notesPlaceholder}
                placeholderTextColor="#9ca3af"
                multiline
                numberOfLines={3}
                value={notes}
                onChangeText={setNotes}
              />

              {/* Total preview */}
              {priceText.length > 0 && !isNaN(parseFloat(priceText)) && (
                <View style={styles.totalPreview}>
                  <Text style={styles.totalPreviewLabel}>Kopējā cena (aprēķins)</Text>
                  <Text style={styles.totalPreviewValue}>
                    {(parseFloat(priceText.replace(',', '.')) * request.quantity).toFixed(2)} EUR
                  </Text>
                </View>
              )}

              {/* Submit */}
              <TouchableOpacity
                style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
                onPress={handleSubmit}
                disabled={submitting}
                activeOpacity={0.8}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Send size={18} color="#fff" />
                    <Text style={styles.submitBtnText}>{sq.submit}</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Request Card ───────────────────────────────────────────────────────────────

interface RequestCardProps {
  request: OpenQuoteRequest;
  myCompanyId: string | undefined;
  onRespond: (req: OpenQuoteRequest) => void;
}

function RequestCard({ request, myCompanyId, onRespond }: RequestCardProps) {
  const [expanded, setExpanded] = useState(false);

  const alreadyResponded =
    !!myCompanyId && request.responses.some((r) => r.supplierId === myCompanyId);
  const responseCount = request.responses.length;
  const emoji = CATEGORY_EMOJI[request.materialCategory] ?? '📦';
  const categoryLabel = sq.categories[request.materialCategory] ?? request.materialCategory;
  const unitLabel = sq.units[request.unit] ?? request.unit;

  return (
    <View style={[styles.card, alreadyResponded && styles.cardResponded]}>
      {/* Main row */}
      <TouchableOpacity
        style={styles.cardHeader}
        onPress={() => setExpanded((e) => !e)}
        activeOpacity={0.7}
      >
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryEmoji}>{emoji}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {request.materialName || categoryLabel}
            </Text>
            {/* Status badge */}
            {request.status === 'QUOTED' ? (
              <View style={[styles.badge, { backgroundColor: BLUE_BG }]}>
                <Text style={[styles.badgeText, { color: BLUE_COLOR }]}>{sq.quotedBadge}</Text>
              </View>
            ) : (
              <View style={[styles.badge, { backgroundColor: WARN_BG }]}>
                <Text style={[styles.badgeText, { color: WARN_COLOR }]}>{sq.openBadge}</Text>
              </View>
            )}
          </View>
          <View style={styles.cardMeta}>
            <Package size={13} color="#9ca3af" />
            <Text style={styles.cardMetaText}>
              {request.quantity} {unitLabel}
            </Text>
            <MapPin size={13} color="#9ca3af" style={{ marginLeft: 8 }} />
            <Text style={styles.cardMetaText}>{request.deliveryCity}</Text>
          </View>
          <View style={styles.cardFooterRow}>
            <Clock size={11} color="#9ca3af" />
            <Text style={styles.timeText}>{timeAgo(request.createdAt)}</Text>
            <Text style={[styles.responseCountText, responseCount > 0 && { color: ACCENT }]}>
              {responseCount > 0 ? sq.responseCount(responseCount) : sq.noResponses}
            </Text>
          </View>
        </View>
        {expanded ? (
          <ChevronUp size={18} color="#9ca3af" />
        ) : (
          <ChevronDown size={18} color="#9ca3af" />
        )}
      </TouchableOpacity>

      {/* Expanded details */}
      {expanded && (
        <View style={styles.expandedBody}>
          <View style={styles.divider} />

          {/* Buyer */}
          <View style={styles.detailRow}>
            <User size={14} color="#6b7280" />
            <Text style={styles.detailLabel}>{sq.postedBy}:</Text>
            <Text style={styles.detailValue}>
              {request.buyer.firstName} {request.buyer.lastName.charAt(0)}.
            </Text>
          </View>

          {/* Quantity + unit */}
          <View style={styles.detailRow}>
            <Package size={14} color="#6b7280" />
            <Text style={styles.detailLabel}>{sq.quantity}:</Text>
            <Text style={styles.detailValue}>
              {request.quantity} {unitLabel} · {categoryLabel}
            </Text>
          </View>

          {/* Delivery city */}
          <View style={styles.detailRow}>
            <MapPin size={14} color="#6b7280" />
            <Text style={styles.detailLabel}>{sq.deliverTo}:</Text>
            <Text style={styles.detailValue}>{request.deliveryCity}</Text>
          </View>

          {/* Notes */}
          {request.notes ? (
            <View style={[styles.detailRow, { alignItems: 'flex-start' }]}>
              <FileText size={14} color="#6b7280" style={{ marginTop: 2 }} />
              <Text style={styles.detailLabel}>{sq.notes}:</Text>
              <Text style={[styles.detailValue, { flex: 1 }]}>{request.notes}</Text>
            </View>
          ) : null}

          {/* Request number */}
          <Text style={styles.requestNumber}>#{request.requestNumber}</Text>

          {/* Action */}
          {alreadyResponded ? (
            <View style={styles.alreadyRespondedBox}>
              <CheckCircle2 size={16} color={ACCENT} />
              <Text style={styles.alreadyRespondedText}>{sq.alreadyResponded}</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.respondBtn}
              onPress={() => onRespond(request)}
              activeOpacity={0.8}
            >
              <Send size={16} color="#fff" />
              <Text style={styles.respondBtnText}>{sq.submitBtn}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────────

export default function SellerQuotesScreen() {
  const { user, token } = useAuth();
  const [requests, setRequests] = useState<OpenQuoteRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalRequest, setModalRequest] = useState<OpenQuoteRequest | null>(null);
  // Track which request IDs we've responded to this session (for instant UI feedback)
  const [respondedIds, setRespondedIds] = useState<Set<string>>(new Set());

  const myCompanyId = user?.company?.id;

  const load = useCallback(
    async (silent = false) => {
      if (!token) return;
      if (!silent) setLoading(true);
      try {
        const data = await api.quoteRequests.openRequests(token);
        setRequests(data);
      } catch {
        // silent fail on background refresh
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

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(true);
  }, [load]);

  const handleRespond = useCallback((req: OpenQuoteRequest) => {
    setModalRequest(req);
  }, []);

  const handleSuccess = useCallback(
    (requestId: string) => {
      setRespondedIds((prev) => new Set([...prev, requestId]));
      // Patch the local state so the "already responded" badge shows instantly
      setRequests((prev) =>
        prev.map((r) =>
          r.id === requestId && myCompanyId
            ? { ...r, responses: [...r.responses, { supplierId: myCompanyId }] }
            : r,
        ),
      );
    },
    [myCompanyId],
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>{sq.title}</Text>
          <Text style={styles.headerSubtitle}>{sq.subtitle}</Text>
        </View>
        <TouchableOpacity
          onPress={() => load()}
          style={styles.refreshIconBtn}
          hitSlop={8}
          disabled={loading}
        >
          <RefreshCw size={20} color={loading ? '#d1d5db' : ACCENT} />
        </TouchableOpacity>
      </View>

      {/* Count chip */}
      {!loading && requests.length > 0 && (
        <View style={styles.countChip}>
          <SlidersHorizontal size={14} color={ACCENT_DIM} />
          <Text style={styles.countChipText}>
            {requests.length} atkl{requests.length === 1 ? 'āts' : 'āti'} pieprasījum
            {requests.length === 1 ? 's' : 'i'}
          </Text>
        </View>
      )}

      {/* Content */}
      {loading ? (
        <SkeletonCard count={4} />
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={requests.length === 0 ? styles.emptyContainer : styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />
          }
          keyboardShouldPersistTaps="handled"
        >
          {requests.length === 0 ? (
            <View style={styles.emptyBox}>
              <FileText size={52} color="#d1d5db" />
              <Text style={styles.emptyTitle}>{sq.empty}</Text>
              <Text style={styles.emptyDesc}>{sq.emptyDesc}</Text>
              <TouchableOpacity style={styles.refreshBtn} onPress={() => load()}>
                <RefreshCw size={15} color={ACCENT} />
                <Text style={styles.refreshBtnText}>{sq.refresh}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            requests.map((req) => (
              <RequestCard
                key={req.id}
                request={req}
                myCompanyId={myCompanyId}
                onRespond={handleRespond}
              />
            ))
          )}
        </ScrollView>
      )}

      {/* Proposal Modal */}
      {modalRequest && token && (
        <ProposalModal
          request={modalRequest}
          visible={!!modalRequest}
          onClose={() => setModalRequest(null)}
          onSuccess={handleSuccess}
          token={token}
        />
      )}
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  refreshIconBtn: {
    padding: 8,
  },
  countChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
    backgroundColor: ACCENT_LIGHT,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    alignSelf: 'flex-start',
  },
  countChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: ACCENT_DIM,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyBox: {
    alignItems: 'center',
    gap: 8,
    paddingBottom: 40,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#374151',
    marginTop: 8,
  },
  emptyDesc: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 20,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: ACCENT,
  },
  refreshBtnText: {
    color: ACCENT,
    fontWeight: '600',
    fontSize: 14,
  },

  // ── Card ──────────────────────────────────────────────────────
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardResponded: {
    borderLeftWidth: 3,
    borderLeftColor: ACCENT,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  categoryBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryEmoji: {
    fontSize: 22,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginBottom: 4,
  },
  cardMetaText: {
    fontSize: 13,
    color: '#6b7280',
  },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 11,
    color: '#9ca3af',
    flex: 1,
  },
  responseCountText: {
    fontSize: 11,
    color: '#9ca3af',
    fontWeight: '600',
  },

  // ── Expanded ──────────────────────────────────────────────────
  expandedBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  divider: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  detailLabel: {
    fontSize: 13,
    color: '#6b7280',
    minWidth: 72,
  },
  detailValue: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '500',
    flexShrink: 1,
  },
  requestNumber: {
    fontSize: 11,
    color: '#d1d5db',
    marginTop: 4,
    marginBottom: 10,
  },
  alreadyRespondedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: ACCENT_LIGHT,
    borderRadius: 10,
    padding: 10,
  },
  alreadyRespondedText: {
    fontSize: 13,
    fontWeight: '600',
    color: ACCENT_DIM,
  },
  respondBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingVertical: 12,
  },
  respondBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },

  // ── Modal ─────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 36,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
  },
  modalClose: {
    padding: 4,
    marginLeft: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    overflow: 'hidden',
  },
  priceInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  priceUnit: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#f9fafb',
    borderLeftWidth: 1,
    borderLeftColor: '#e5e7eb',
  },
  priceUnitText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  stepBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: '#f9fafb',
  },
  stepValue: {
    paddingHorizontal: 24,
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    minWidth: 48,
    textAlign: 'center',
  },
  notesInput: {
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    height: 80,
    textAlignVertical: 'top',
  },
  totalPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: ACCENT_LIGHT,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 14,
  },
  totalPreviewLabel: {
    fontSize: 13,
    color: ACCENT_DIM,
  },
  totalPreviewValue: {
    fontSize: 16,
    fontWeight: '700',
    color: ACCENT_DIM,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 15,
    marginTop: 20,
  },
  submitBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  successBox: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 10,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  successMsg: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
});

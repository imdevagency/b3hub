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
  TextInput,
  Alert,
} from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { useFocusEffect } from 'expo-router';
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
  Minus,
  Plus,
  Leaf,
  Box,
  Zap,
  Droplets,
  Trash2,
  Truck,
} from 'lucide-react-native';
import { useAuth } from '@/lib/auth-context';
import { api, type OpenQuoteRequest, type MaterialUnit } from '@/lib/api';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { t } from '@/lib/translations';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { EmptyState } from '@/components/ui/EmptyState';

// ── Constants ──────────────────────────────────────────────────────────────────

const ACCENT = '#111827';
const ACCENT_LIGHT = '#dcfce7';
const ACCENT_DIM = '#374151';
const WARN_BG = '#f3f4f6';
const WARN_COLOR = '#6b7280';
const BLUE_BG = '#f3f4f6';
const BLUE_COLOR = '#111827';

// Material category → icon + color
interface MaterialIcon {
  Icon: React.ComponentType<any>;
}

const CATEGORY_ICONS: Record<string, MaterialIcon> = {
  SAND: { Icon: Truck },
  GRAVEL: { Icon: Box },
  STONE: { Icon: Box },
  CONCRETE: { Icon: Zap },
  SOIL: { Icon: Leaf },
  RECYCLED_CONCRETE: { Icon: Zap },
  RECYCLED_SOIL: { Icon: Leaf },
  ASPHALT: { Icon: Truck },
  CLAY: { Icon: Droplets },
  OTHER: { Icon: Package },
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

  useEffect(() => {
    if (visible) {
      setPriceText('');
      setEtaDays(2);
      setNotes('');
      setDone(false);
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
    } catch (err: unknown) {
      Alert.alert(
        sq.errorTitle,
        err instanceof Error ? err.message : 'Neizdevās iesniegt piedāvājumu.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const unitLabel = sq.units[request.unit] ?? request.unit;
  const categoryLabel = sq.categories[request.materialCategory] ?? request.materialCategory;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={sq.modalTitle}
      subtitle={`${categoryLabel} · ${request.quantity} ${unitLabel} · ${request.deliveryCity}`}
      scrollable
    >
      {done ? (
        /* Success state */
        <View style={styles.successBox}>
          <CheckCircle2 size={48} color={ACCENT} />
          <Text style={styles.successTitle}>{sq.successTitle}</Text>
          <Text style={styles.successMsg}>{sq.successMsg}</Text>
        </View>
      ) : (
        <>
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
        </>
      )}
    </BottomSheet>
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
  const iconConfig = CATEGORY_ICONS[request.materialCategory] ?? CATEGORY_ICONS.OTHER;
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
        {/* Icon badge */}
        <View style={styles.iconBadge}>
          <iconConfig.Icon size={20} color="#111827" />
        </View>

        {/* Main content */}
        <View style={styles.cardContent}>
          {/* Title + quantity on one line */}
          <View style={styles.titleRow}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {request.materialName || categoryLabel}
            </Text>
            <Text style={styles.cardQuantity}>
              {request.quantity} {unitLabel}
            </Text>
          </View>

          {/* Location + time on second line */}
          <View style={styles.metaRow}>
            <MapPin size={12} color="#9ca3af" />
            <Text style={styles.metaText} numberOfLines={1}>
              {request.deliveryCity}
            </Text>
            <Clock size={12} color="#9ca3af" style={{ marginLeft: 8 }} />
            <Text style={styles.metaText}>{timeAgo(request.createdAt)}</Text>
          </View>

          <View style={styles.innerDivider} />

          {/* Status badge + response count */}
          <View style={styles.statusRow}>
            {request.status === 'QUOTED' ? (
              <View style={styles.statusBadge}>
                <Text style={styles.statusBadgeText}>{sq.quotedBadge}</Text>
              </View>
            ) : (
              <View style={styles.statusBadge}>
                <Text style={styles.statusBadgeText}>{sq.openBadge}</Text>
              </View>
            )}
            {responseCount > 0 && (
              <View style={styles.responseMeta}>
                <Text style={styles.responseMetaText}>{responseCount} piedāvājumi</Text>
              </View>
            )}
          </View>
        </View>

        {/* Chevron */}
        {expanded ? (
          <ChevronUp size={20} color="#9ca3af" />
        ) : (
          <ChevronDown size={20} color="#9ca3af" />
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

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

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
    <ScreenContainer bg="#ffffff">
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
            <EmptyState
              icon={<FileText size={32} color="#9ca3af" />}
              title={sq.empty}
              subtitle={sq.emptyDesc}
              action={
                <TouchableOpacity style={styles.refreshBtn} onPress={() => load()}>
                  <RefreshCw size={15} color={ACCENT} />
                  <Text style={styles.refreshBtnText}>{sq.refresh}</Text>
                </TouchableOpacity>
              }
            />
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
    </ScreenContainer>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: '#ffffff',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  refreshIconBtn: {
    padding: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
  },
  countChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 4,
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  countChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: '#f3f4f6',
  },
  refreshBtnText: {
    color: '#111827',
    fontWeight: '600',
    fontSize: 15,
  },

  // ── Card ──────────────────────────────────────────────────────
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowOpacity: 0,
    elevation: 0,
  },
  cardResponded: {
    borderColor: '#d1d5db',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardContent: {
    flex: 1,
    gap: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
  },
  cardQuantity: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    flexShrink: 0,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 13,
    color: '#6b7280',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 1,
  },
  innerDivider: {
    height: 1,
    backgroundColor: '#f3f4f6',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#f9fafb',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  responseMeta: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  responseMetaText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
  },

  // ── Expanded ──────────────────────────────────────────────────
  expandedBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 0,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  detailLabel: {
    fontSize: 14,
    color: '#6b7280',
    minWidth: 80,
  },
  detailValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
    flexShrink: 1,
  },
  requestNumber: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 10,
    marginBottom: 12,
  },
  alreadyRespondedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
  },
  alreadyRespondedText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0369a1',
  },
  respondBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#111827',
    borderRadius: 16,
    paddingVertical: 14,
  },
  respondBtnText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 16,
  },

  // ── Modal ─────────────────────────────────────────────────────
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 16,
    overflow: 'hidden',
  },
  priceInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  priceUnit: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#e5e7eb',
  },
  priceUnitText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4b5563',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 16,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  stepBtn: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  stepValue: {
    paddingHorizontal: 24,
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    minWidth: 48,
    textAlign: 'center',
  },
  notesInput: {
    backgroundColor: '#f3f4f6',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 15,
    color: '#111827',
    height: 100,
    textAlignVertical: 'top',
  },
  totalPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginTop: 16,
  },
  totalPreviewLabel: {
    fontSize: 14,
    color: '#4b5563',
  },
  totalPreviewValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#111827',
    borderRadius: 16,
    paddingVertical: 16,
    marginTop: 24,
  },
  submitBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
  successBox: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  successMsg: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
  },
});

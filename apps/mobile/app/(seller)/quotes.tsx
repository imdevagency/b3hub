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
import { ScreenHeader } from '@/components/ui/ScreenHeader';
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
import { haptics } from '@/lib/haptics';

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
      haptics.success();
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
              onPress={() => { haptics.light(); setEtaDays((d) => Math.max(1, d - 1)); }}
              hitSlop={8}
            >
              <Minus size={18} color={ACCENT} />
            </TouchableOpacity>
            <Text style={styles.stepValue}>{etaDays}</Text>
            <TouchableOpacity
              style={styles.stepBtn}
              onPress={() => { haptics.light(); setEtaDays((d) => Math.min(30, d + 1)); }}
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
  const categoryLabel = sq.categories[request.materialCategory] ?? request.materialCategory;
  const unitLabel = sq.units[request.unit] ?? request.unit;

  const statusText =
    request.status === 'QUOTED'
      ? { text: sq.quotedBadge, color: '#2563eb' }
      : { text: sq.openBadge, color: '#d97706' };

  return (
    <View style={[styles.card, alreadyResponded && styles.cardResponded]}>
      <TouchableOpacity
        style={styles.cardHeader}
        onPress={() => setExpanded((e) => !e)}
        activeOpacity={0.7}
      >
        <View style={styles.cardTopLeft}>
          <Text style={styles.materialText} numberOfLines={1}>
            {request.materialName || categoryLabel} • {request.quantity}
            {unitLabel}
          </Text>
          <Text style={styles.buyerText}>
            {request.deliveryCity} ({timeAgo(request.createdAt)})
          </Text>
        </View>

        <View style={styles.cardTopRight}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={[styles.statusDot, { backgroundColor: statusText.color }]} />
            <Text style={[styles.statusText, { color: statusText.color }]}>{statusText.text}</Text>
          </View>
          {responseCount > 0 && (
            <Text style={styles.responseCountText}>{responseCount} piedāv.</Text>
          )}
          <View style={{ marginTop: 4 }}>
            {expanded ? (
              <ChevronUp size={16} color="#9ca3af" />
            ) : (
              <ChevronDown size={16} color="#9ca3af" />
            )}
          </View>
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.expandedBody}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{sq.postedBy}:</Text>
            <Text style={styles.detailValue}>
              {request.buyer.firstName} {request.buyer.lastName.charAt(0)}.
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{sq.quantity}:</Text>
            <Text style={styles.detailValue}>
              {request.quantity} {unitLabel} • {categoryLabel}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{sq.deliverTo}:</Text>
            <Text style={styles.detailValue}>{request.deliveryCity}</Text>
          </View>

          {request.notes ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{sq.notes}:</Text>
              <Text style={styles.detailValue}>{request.notes}</Text>
            </View>
          ) : null}

          <Text style={styles.requestNumber}>#{request.requestNumber}</Text>

          {alreadyResponded ? (
            <View style={styles.alreadyRespondedBox}>
              <CheckCircle2 size={16} color={'#111827'} />
              <Text style={styles.alreadyRespondedText}>{sq.alreadyResponded}</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.respondBtn}
              onPress={() => onRespond(request)}
              activeOpacity={0.8}
            >
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
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
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

  // Categories that actually appear in the current request list
  const activeCategories = Array.from(new Set(requests.map((r) => r.materialCategory)));
  const filteredRequests = categoryFilter
    ? requests.filter((r) => r.materialCategory === categoryFilter)
    : requests;

  return (
    <ScreenContainer standalone bg="white">
      <ScreenHeader title={sq.title} />

      {/* Category filter chips */}
      {!loading && activeCategories.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterBar}
          contentContainerStyle={styles.filterBarContent}
        >
          <TouchableOpacity
            style={[styles.filterChip, categoryFilter === null && styles.filterChipActive]}
            onPress={() => setCategoryFilter(null)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.filterChipText,
                categoryFilter === null && styles.filterChipTextActive,
              ]}
            >
              Visi ({requests.length})
            </Text>
          </TouchableOpacity>
          {activeCategories.map((cat) => {
            const count = requests.filter((r) => r.materialCategory === cat).length;
            const label = sq.categories[cat] ?? cat;
            const isActive = categoryFilter === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                onPress={() => setCategoryFilter((prev) => (prev === cat ? null : cat))}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                  {label} · {count}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {!loading && filteredRequests.length > 0 && (
        <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
          <View style={styles.countChip}>
            <Text style={styles.countChipText}>
              {filteredRequests.length} aktīv{filteredRequests.length === 1 ? 's' : 'i'}
              {categoryFilter ? ` · ${sq.categories[categoryFilter] ?? categoryFilter}` : ''}
            </Text>
          </View>
        </View>
      )}

      {loading ? (
        <View style={{ padding: 24, gap: 16 }}>
          <SkeletonCard count={4} />
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={[
            styles.listContent,
            requests.length === 0 && { flexGrow: 1, justifyContent: 'center' },
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#111827" />
          }
          keyboardShouldPersistTaps="handled"
        >
          {requests.length === 0 ? (
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIconWrap}>
                <FileText size={32} color="#9ca3af" />
              </View>
              <Text style={styles.emptyTitle}>Nav pieprasījumu</Text>
              <Text style={styles.emptyDesc}>Šobrīd nav neviena aktīva cenas pieprasījuma.</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={onRefresh} activeOpacity={0.8}>
                <Text style={styles.emptyBtnText}>Atjaunot sarakstu</Text>
              </TouchableOpacity>
            </View>
          ) : filteredRequests.length === 0 ? (
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIconWrap}>
                <FileText size={32} color="#9ca3af" />
              </View>
              <Text style={styles.emptyTitle}>Nav rezultātu</Text>
              <Text style={styles.emptyDesc}>Šajā kategorijā pašlaik nav aktīvu pieprasījumu.</Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => setCategoryFilter(null)}
                activeOpacity={0.8}
              >
                <Text style={styles.emptyBtnText}>Rādīt visus</Text>
              </TouchableOpacity>
            </View>
          ) : (
            filteredRequests.map((req) => (
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
  root: { flex: 1, backgroundColor: '#ffffff' },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
    backgroundColor: '#ffffff',
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  countChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  countChipText: { fontSize: 13, fontWeight: '700', color: '#6b7280' },

  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingBottom: 40 },

  filterBar: { flexGrow: 0, marginBottom: 4 },
  filterBarContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    flexDirection: 'row',
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  filterChipActive: { backgroundColor: '#111827', borderColor: '#111827' },
  filterChipText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  filterChipTextActive: { color: '#ffffff' },

  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
    flex: 1,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyDesc: { fontSize: 16, color: '#6b7280', textAlign: 'center', lineHeight: 24 },

  card: {
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    backgroundColor: '#ffffff',
  },
  cardResponded: { opacity: 0.7 },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardTopLeft: { gap: 4, flex: 1, paddingRight: 10 },
  materialText: { fontSize: 18, fontWeight: '700', color: '#111827' },
  buyerText: { fontSize: 14, color: '#6b7280', fontWeight: '500' },

  cardTopRight: { alignItems: 'flex-end', gap: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 13, fontWeight: '600' },
  responseCountText: { fontSize: 12, fontWeight: '600', color: '#9ca3af', marginTop: 2 },

  expandedBody: {
    paddingTop: 16,
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  detailLabel: { fontSize: 14, color: '#6b7280', minWidth: 80 },
  detailValue: { fontSize: 14, color: '#111827', fontWeight: '500', flex: 1, lineHeight: 20 },

  requestNumber: { fontSize: 12, color: '#9ca3af', marginTop: 12, marginBottom: 8 },

  alreadyRespondedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  alreadyRespondedText: { fontSize: 15, fontWeight: '600', color: '#111827' },

  respondBtn: {
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  respondBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 15 },

  // Modal styles (unchanged)
  fieldLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
  },
  priceInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  priceUnit: { paddingHorizontal: 16, paddingVertical: 16 },
  priceUnitText: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  stepBtn: { paddingHorizontal: 20, paddingVertical: 14 },
  stepValue: {
    paddingHorizontal: 24,
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    minWidth: 48,
    textAlign: 'center',
  },
  notesInput: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: '#111827',
    height: 100,
    textAlignVertical: 'top',
  },
  totalPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  totalPreviewLabel: { fontSize: 14, color: '#6b7280', fontWeight: '500' },
  totalPreviewValue: { fontSize: 18, fontWeight: '700', color: '#111827' },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 24,
  },
  submitBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 16 },
  successBox: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  successTitle: { fontSize: 24, fontWeight: '700', color: '#111827' },
  successMsg: { fontSize: 15, color: '#6b7280', textAlign: 'center' },

  emptyBtn: {
    marginTop: 24,
    backgroundColor: '#111827',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});

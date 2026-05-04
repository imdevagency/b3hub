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
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  FileText,
  ChevronDown,
  ChevronUp,
  Package,
  CheckCircle2,
  Send,
  Minus,
  Plus,
  ClipboardList,
} from 'lucide-react-native';
import { useAuth } from '@/lib/auth-context';
import { api, type OpenQuoteRequest, type MyQuoteResponse, type MaterialUnit } from '@/lib/api';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { t } from '@/lib/translations';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusPill } from '@/components/ui/StatusPill';
import { haptics } from '@/lib/haptics';
import { colors } from '@/lib/theme';
import { getQuoteResponseStatus } from '@/lib/status';

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
          <CheckCircle2 size={48} color="#111827" />
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
              onPress={() => {
                haptics.light();
                setEtaDays((d) => Math.max(1, d - 1));
              }}
              hitSlop={8}
            >
              <Minus size={18} color="#111827" />
            </TouchableOpacity>
            <Text style={styles.stepValue}>{etaDays}</Text>
            <TouchableOpacity
              style={styles.stepBtn}
              onPress={() => {
                haptics.light();
                setEtaDays((d) => Math.min(30, d + 1));
              }}
              hitSlop={8}
            >
              <Plus size={18} color="#111827" />
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
  autoExpand?: boolean;
}

function RequestCard({ request, myCompanyId, onRespond, autoExpand = false }: RequestCardProps) {
  const [expanded, setExpanded] = useState(autoExpand);

  const alreadyResponded =
    !!myCompanyId && request.responses.some((r) => r.supplierId === myCompanyId);
  const responseCount = request.responses.length;
  const categoryLabel = sq.categories[request.materialCategory] ?? request.materialCategory;
  const unitLabel = sq.units[request.unit] ?? request.unit;

  const statusText =
    request.status === 'QUOTED'
      ? { text: sq.quotedBadge, color: '#2563eb', bg: '#eff6ff' }
      : { text: sq.openBadge, color: '#d97706', bg: '#fff7ed' };

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
          <StatusPill
            label={statusText.text}
            bg={statusText.bg}
            color={statusText.color}
            size="sm"
          />
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
              {request.buyer
                ? `${request.buyer.firstName ?? ''} ${request.buyer.lastName ? request.buyer.lastName.charAt(0) + '.' : ''}`.trim()
                : '—'}
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

// ── My Response Row ───────────────────────────────────────────────────────────

function MyResponseRow({ item }: { item: MyQuoteResponse }) {
  const st = getQuoteResponseStatus(item.status);
  const unitLabel = sq.units[item.request.unit] ?? item.request.unit;
  const catLabel = sq.categories[item.request.materialCategory] ?? item.request.materialCategory;
  return (
    <View style={styles.myrRow}>
      <View style={styles.myrTop}>
        <View style={styles.myrTitleRow}>
          <Text style={styles.myrTitle} numberOfLines={1}>
            #{item.request.requestNumber} · {catLabel}
          </Text>
          <View style={[styles.myrBadge, { backgroundColor: st.bg }]}>
            <Text style={[styles.myrBadgeText, { color: st.color }]}>{st.label}</Text>
          </View>
        </View>
        <Text style={styles.myrSub}>
          {item.request.materialName} · {item.request.quantity} {unitLabel} ·{' '}
          {item.request.deliveryCity}
        </Text>
      </View>
      <View style={styles.myrPriceRow}>
        <View>
          <Text style={styles.myrPrice}>€{item.totalPrice.toFixed(2)}</Text>
          <Text style={styles.myrPriceSub}>
            €{item.pricePerUnit.toFixed(2)} / {unitLabel}
          </Text>
        </View>
        <Text style={styles.myrEta}>{item.etaDays} d.</Text>
      </View>
      {item.notes ? (
        <Text style={styles.myrNotes} numberOfLines={2}>
          {item.notes}
        </Text>
      ) : null}
      <Text style={styles.myrDate}>
        Iesniegts{' '}
        {new Date(item.createdAt).toLocaleDateString('lv-LV', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })}
      </Text>
    </View>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────────

export default function SellerQuotesScreen() {
  const { user, token } = useAuth();
  const { highlight } = useLocalSearchParams<{ highlight?: string }>();
  const [requests, setRequests] = useState<OpenQuoteRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalRequest, setModalRequest] = useState<OpenQuoteRequest | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  // Track which request IDs we've responded to this session (for instant UI feedback)
  const [respondedIds, setRespondedIds] = useState<Set<string>>(new Set());

  // ── My responses tab ──────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'open' | 'mine'>('open');
  const [myResponses, setMyResponses] = useState<MyQuoteResponse[]>([]);
  const [myLoading, setMyLoading] = useState(false);
  const [myRefreshing, setMyRefreshing] = useState(false);

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

  const loadMine = useCallback(
    async (silent = false) => {
      if (!token) return;
      if (!silent) setMyLoading(true);
      try {
        const data = await api.quoteRequests.myResponses(token);
        setMyResponses(data);
      } catch {
        // silent
      } finally {
        setMyLoading(false);
        setMyRefreshing(false);
      }
    },
    [token],
  );

  useFocusEffect(
    useCallback(() => {
      load();
      loadMine();
    }, [load, loadMine]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(true);
    setMyRefreshing(true);
    loadMine(true);
  }, [load, loadMine]);

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
    <ScreenContainer bg="#ffffff">
      <ScreenHeader title={sq.title} />

      {/* Tab switcher */}
      <View className="px-4 pt-3 pb-3">
        <View className="flex-row bg-gray-100 p-1 rounded-2xl">
          {(
            [
              {
                key: 'open' as const,
                label: `Pieprasījumi${requests.length > 0 ? ` · ${requests.length}` : ''}`,
              },
              {
                key: 'mine' as const,
                label: `Mani piedāvājumi${myResponses.length > 0 ? ` · ${myResponses.length}` : ''}`,
              },
            ] as const
          ).map((tab) => {
            const active = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                className={`flex-1 items-center justify-center py-2.5 rounded-xl ${active ? 'bg-white' : ''}`}
                style={
                  active
                    ? {
                        shadowColor: '#000',
                        shadowOpacity: 0.06,
                        shadowRadius: 4,
                        elevation: 1,
                        shadowOffset: { width: 0, height: 1 },
                      }
                    : {}
                }
                onPress={() => {
                  haptics.light();
                  setActiveTab(tab.key);
                }}
                activeOpacity={0.8}
              >
                <Text
                  style={{ fontSize: 14, fontWeight: '600', color: active ? '#111827' : '#6b7280' }}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {activeTab === 'mine' ? (
        myLoading ? (
          <View style={{ padding: 24, gap: 16 }}>
            <SkeletonCard count={4} />
          </View>
        ) : (
          <ScrollView
            style={styles.list}
            contentContainerStyle={[
              styles.listContent,
              myResponses.length === 0 && { flexGrow: 1, justifyContent: 'center' },
            ]}
            refreshControl={
              <RefreshControl refreshing={myRefreshing} onRefresh={onRefresh} tintColor="#166534" />
            }
          >
            {myResponses.length === 0 ? (
              <View style={styles.emptyWrap}>
                <View style={styles.emptyIconWrap}>
                  <ClipboardList size={32} color="#9ca3af" />
                </View>
                <Text style={styles.emptyTitle}>Nav iesniegtu piedāvājumu</Text>
                <Text style={styles.emptyDesc}>
                  Piedāvājumi par atvērtiem pieprasījumiem rādīsās šeit.
                </Text>
              </View>
            ) : (
              myResponses.map((item) => <MyResponseRow key={item.id} item={item} />)
            )}
          </ScrollView>
        )
      ) : (
        <>
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
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#166534" />
              }
              keyboardShouldPersistTaps="handled"
            >
              {requests.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <View style={styles.emptyIconWrap}>
                    <FileText size={32} color="#9ca3af" />
                  </View>
                  <Text style={styles.emptyTitle}>Nav pieprasījumu</Text>
                  <Text style={styles.emptyDesc}>
                    Šobrīd nav neviena aktīva cenas pieprasījuma.
                  </Text>
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
                  <Text style={styles.emptyDesc}>
                    Šajā kategorijā pašlaik nav aktīvu pieprasījumu.
                  </Text>
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
                    autoExpand={req.id === highlight}
                  />
                ))
              )}
            </ScrollView>
          )}
        </>
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
  // My response row
  myrRow: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    padding: 16,
    marginBottom: 12,
    gap: 8,
  },
  myrTop: { gap: 4 },
  myrTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  myrTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, flex: 1 },
  myrBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  myrBadgeText: { fontSize: 11, fontWeight: '600' },
  myrSub: { fontSize: 13, color: colors.textMuted },
  myrPriceRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  myrPrice: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  myrPriceSub: { fontSize: 12, color: colors.textDisabled },
  myrEta: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  myrNotes: { fontSize: 13, color: colors.textSecondary },
  myrDate: { fontSize: 11, color: colors.textDisabled },
  countChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.bgMuted,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  countChipText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },

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
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.textPrimary },
  filterChipText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  filterChipTextActive: { color: colors.white },

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
    backgroundColor: colors.bgMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyDesc: { fontSize: 16, color: colors.textMuted, textAlign: 'center', lineHeight: 24 },

  card: {
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    backgroundColor: colors.bgCard,
  },
  cardResponded: { opacity: 0.7 },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardTopLeft: { gap: 4, flex: 1, paddingRight: 10 },
  materialText: { fontSize: 18, fontWeight: '600', color: colors.textPrimary },
  buyerText: { fontSize: 14, color: colors.textMuted, fontWeight: '500' },

  cardTopRight: { alignItems: 'flex-end', gap: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 13, fontWeight: '600' },
  responseCountText: { fontSize: 12, fontWeight: '600', color: colors.textDisabled, marginTop: 2 },

  expandedBody: {
    paddingTop: 16,
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  detailLabel: { fontSize: 14, color: colors.textMuted, minWidth: 80 },
  detailValue: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '500',
    flex: 1,
    lineHeight: 20,
  },

  requestNumber: { fontSize: 12, color: colors.textDisabled, marginTop: 12, marginBottom: 8 },

  alreadyRespondedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.bgMuted,
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  alreadyRespondedText: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },

  respondBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  respondBtnText: { color: colors.white, fontWeight: '600', fontSize: 15 },

  // Modal styles (unchanged)
  fieldLabel: { fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgSubtle,
    borderRadius: 12,
  },
  priceInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 20,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  priceUnit: { paddingHorizontal: 16, paddingVertical: 16 },
  priceUnitText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgSubtle,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  stepBtn: { paddingHorizontal: 20, paddingVertical: 14 },
  stepValue: {
    paddingHorizontal: 24,
    fontSize: 20,
    fontWeight: '600',
    color: colors.textPrimary,
    minWidth: 48,
    textAlign: 'center',
  },
  notesInput: {
    backgroundColor: colors.bgSubtle,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: colors.textPrimary,
    height: 100,
    textAlignVertical: 'top',
  },
  totalPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.bgSubtle,
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  totalPreviewLabel: { fontSize: 14, color: colors.textMuted, fontWeight: '500' },
  totalPreviewValue: { fontSize: 18, fontWeight: '600', color: colors.textPrimary },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 24,
  },
  submitBtnText: { color: colors.white, fontWeight: '600', fontSize: 16 },
  successBox: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  successTitle: { fontSize: 24, fontWeight: '600', color: colors.textPrimary },
  successMsg: { fontSize: 15, color: colors.textMuted, textAlign: 'center' },

  emptyBtn: {
    marginTop: 24,
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBtnText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});

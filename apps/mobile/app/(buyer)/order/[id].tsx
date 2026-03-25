import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
  Image,
} from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeft,
  MapPin,
  CalendarDays,
  Phone,
  Package,
  Truck,
  FileText,
  CheckCircle,
  XCircle,
  Star,
  FileDown,
  MessageCircle,
  User,
  Camera,
} from 'lucide-react-native';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { haptics } from '@/lib/haptics';
import { SkeletonDetail } from '@/components/ui/Skeleton';
import { useOrderDetail } from '@/lib/use-order-detail';
import { t } from '@/lib/translations';
import { RatingModal } from '@/components/ui/RatingModal';
import { EmptyState } from '@/components/ui/EmptyState';
import { InfoSection } from '@/components/ui/InfoSection';
import { StatusPill } from '@/components/ui/StatusPill';
import { DetailRow } from '@/components/ui/DetailRow';
import { UNIT_SHORT, MAT_STATUS } from '@/lib/materials';
import { formatDate } from '@/lib/format';

// ── Constants ──────────────────────────────────────────────────

const ORDER_STEPS = [
  { key: 'PENDING', label: 'Pasūtīts', hint: 'Gaida apstiprināšanu' },
  { key: 'CONFIRMED', label: 'Apstiprināts', hint: 'Pasūtījums apstiprināts' },
  { key: 'PROCESSING', label: 'Sagatavo', hint: 'Kravu sagatavo' },
  { key: 'SHIPPED', label: 'Ceļā', hint: 'Šoferis dodas uz jums' },
  { key: 'DELIVERED', label: 'Piegādāts', hint: 'Piegāde pabeigta' },
];

// ── Main Screen ────────────────────────────────────────────────

export default function OrderDetailScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { order, setOrder, loading, alreadyRated, documents, reload: load } = useOrderDetail(id);
  const [actionLoading, setActionLoading] = useState(false);
  const [showRating, setShowRating] = useState(false);
  // Local flag so the UI updates immediately after rating without a reload
  const [ratedLocally, setRatedLocally] = useState(false);
  const hasRated = alreadyRated || ratedLocally;

  const handleCancel = () => {
    haptics.heavy();
    Alert.alert('Atcelt pasūtījumu?', 'Šo darbību nevar atsaukt.', [
      { text: 'Nē', style: 'cancel' },
      {
        text: 'Atcelt pasūtījumu',
        style: 'destructive',
        onPress: async () => {
          if (!token || !order) return;
          setActionLoading(true);
          try {
            const updated = await api.orders.cancel(order.id, token);
            setOrder(updated);
            haptics.success();
          } catch (err: unknown) {
            haptics.error();
            Alert.alert('Kļūda', err instanceof Error ? err.message : 'Neizdevās atcelt');
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <ScreenContainer bg="#f9fafb">
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={8}>
            <ArrowLeft size={18} color="#111827" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Pasūtījums</Text>
          <View style={{ width: 36 }} />
        </View>
        <SkeletonDetail />
      </ScreenContainer>
    );
  }

  if (!order) {
    return (
      <ScreenContainer bg="#f9fafb">
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={8}>
            <ArrowLeft size={18} color="#111827" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Pasūtījums</Text>
          <View style={{ width: 36 }} />
        </View>
        <EmptyState icon={<Package size={32} color="#9ca3af" />} title="Pasūtījums nav atrasts" />
      </ScreenContainer>
    );
  }

  const st = MAT_STATUS[order.status] ?? MAT_STATUS.PENDING;
  const activeJob = order.transportJobs?.find(
    (j) =>
      j.status === 'ACCEPTED' ||
      j.status === 'EN_ROUTE_PICKUP' ||
      j.status === 'AT_PICKUP' ||
      j.status === 'LOADED' ||
      j.status === 'EN_ROUTE_DELIVERY' ||
      j.status === 'AT_DELIVERY',
  );
  const driver = activeJob?.driver;
  const canCancel = ['PENDING', 'CONFIRMED'].includes(order.status);

  return (
    <ScreenContainer bg="#f9fafb">
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={8}>
          <ArrowLeft size={18} color="#111827" />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>
          {order.orderNumber}
        </Text>
        <StatusPill label={st.label} bg={st.bg} color={st.color} />
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Live driver tracking map — shows planned route even before GPS fix */}
        {/* Driver card — if order is in transit */}
        {driver && (
          <View style={s.driverCard}>
            <View style={s.driverCardRow}>
              <Truck size={16} color="#6b7280" />
              <Text style={s.driverTitle}>Šoferis</Text>
            </View>
            <View style={s.driverInfo}>
              {driver.avatar ? (
                <Image source={{ uri: driver.avatar }} style={s.driverAvatar} />
              ) : (
                <View style={s.driverAvatarFallback}>
                  <Text style={s.driverAvatarInitials}>
                    {driver.firstName?.[0] ?? '?'}
                    {driver.lastName?.[0] ?? ''}
                  </Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={s.driverName}>
                  {driver.firstName} {driver.lastName}
                </Text>
                {driver.phone ? <Text style={s.driverPhone}>{driver.phone}</Text> : null}
              </View>
              {driver.phone ? (
                <TouchableOpacity
                  style={s.callBtn}
                  onPress={() =>
                    Linking.openURL(`tel:${driver.phone}`).catch(() =>
                      Alert.alert('Kļūda', 'Neizdevās iniciēt zvanu'),
                    )
                  }
                >
                  <Phone size={14} color="#fff" />
                  <Text style={s.callBtnText}>Zvanīt</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        )}

        {/* Order status timeline */}
        {order.status !== 'CANCELLED' && (
          <InfoSection icon={<CheckCircle size={14} color="#6b7280" />} title="Izpildes progress">
            {ORDER_STEPS.map((step, i) => {
              const currentIdx = ORDER_STEPS.findIndex((s) => s.key === order.status);
              const isDone = i < currentIdx;
              const isActive = i === currentIdx;
              const isLast = i === ORDER_STEPS.length - 1;
              return (
                <View key={step.key} style={s.tlRow}>
                  <View style={s.tlLeft}>
                    <View style={[s.tlDot, isDone && s.tlDotDone, isActive && s.tlDotActive]}>
                      {isDone && <CheckCircle size={10} color="#fff" />}
                      {isActive && <View style={s.tlDotInner} />}
                    </View>
                    {!isLast && <View style={[s.tlLine, isDone && s.tlLineDone]} />}
                  </View>
                  <View style={s.tlContent}>
                    <Text style={[s.tlLabel, isDone && s.tlLabelDone, isActive && s.tlLabelActive]}>
                      {step.label}
                    </Text>
                    {isActive && <Text style={s.tlHint}>{step.hint}</Text>}
                  </View>
                </View>
              );
            })}
          </InfoSection>
        )}

        {/* Weighing slip photo — shown as soon as driver marks job LOADED */}
        {(() => {
          const jobWithPhoto = order.transportJobs?.find((j) => j.pickupPhotoUrl);
          if (!jobWithPhoto?.pickupPhotoUrl) return null;
          return (
            <InfoSection
              icon={<Camera size={14} color="#6b7280" />}
              title="Svēršanas biļete"
              right={
                jobWithPhoto.actualWeightKg != null ? (
                  <Text style={s.weighingWeight}>
                    ⚖️ {jobWithPhoto.actualWeightKg.toFixed(0)} kg
                  </Text>
                ) : undefined
              }
            >
              <Image
                source={{ uri: jobWithPhoto.pickupPhotoUrl }}
                style={s.weighingSlipPhoto}
                resizeMode="contain"
              />
            </InfoSection>
          );
        })()}

        {/* Order items */}
        <InfoSection icon={<Package size={14} color="#6b7280" />} title="Preces">
          {order.items.map((item, idx) => (
            <View key={idx} style={[s.itemRow, idx < order.items.length - 1 && s.itemBorder]}>
              <View style={{ flex: 1 }}>
                <Text style={s.itemName}>{item.material.name}</Text>
                <Text style={s.itemMeta}>
                  {item.quantity} {UNIT_SHORT[item.unit as keyof typeof UNIT_SHORT] ?? item.unit} ×
                  €{item.unitPrice.toFixed(2)}
                </Text>
              </View>
              <Text style={s.itemTotal}>€{item.total.toFixed(2)}</Text>
            </View>
          ))}
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Kopā</Text>
            <Text style={s.totalValue}>
              €{order.total.toFixed(2)} {order.currency}
            </Text>
          </View>
        </InfoSection>

        {/* Delivery details */}
        <InfoSection icon={<MapPin size={14} color="#6b7280" />} title="Piegādes dati">
          <DetailRow label="Adrese" value={order.deliveryAddress} />
          <DetailRow label="Pilsēta" value={order.deliveryCity} />
          <DetailRow
            label="Datums"
            value={order.deliveryDate ? formatDate(order.deliveryDate) : null}
          />
          <DetailRow label="Kontaktpersona" value={order.siteContactName} />
          <DetailRow label="Tālrunis" value={order.siteContactPhone} />
          {order.siteContactPhone && (
            <TouchableOpacity
              style={s.callSiteBtn}
              onPress={() => Linking.openURL(`tel:${order.siteContactPhone}`).catch(() => null)}
              activeOpacity={0.8}
            >
              <Phone size={13} color="#374151" />
              <Text style={s.callSiteBtnText}>Zvanīt kontaktpersonai</Text>
            </TouchableOpacity>
          )}
        </InfoSection>

        {/* Documents — CMR, weighing slip (shown after delivery) */}
        {order.status === 'DELIVERED' && documents.length > 0 && (
          <InfoSection icon={<FileDown size={14} color="#6b7280" />} title="Dokumenti">
            {documents.map((doc) => {
              const docLabel =
                doc.type === 'WEIGHING_SLIP'
                  ? '⚖️ Svēršanas kvīts'
                  : doc.type === 'DELIVERY_NOTE'
                    ? '📋 Pavadzīme (CMR)'
                    : doc.type === 'INVOICE'
                      ? '🧾 Rēķins'
                      : doc.title;
              return (
                <View key={doc.id} style={s.docRow}>
                  <View style={s.docInfo}>
                    <Text style={s.docTitle}>{docLabel}</Text>
                    <Text style={s.docStatus}>
                      {doc.fileUrl ? 'Pieejams' : 'Tiek sagatavots...'}
                    </Text>
                  </View>
                  {doc.fileUrl ? (
                    <TouchableOpacity
                      style={s.docDownloadBtn}
                      onPress={() => Linking.openURL(doc.fileUrl!).catch(() => null)}
                      activeOpacity={0.8}
                    >
                      <FileDown size={14} color="#fff" />
                      <Text style={s.docDownloadText}>Lejupielādēt</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={s.docPendingBadge}>
                      <Text style={s.docPendingText}>Gaida</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </InfoSection>
        )}

        {/* Delivery proof — photos + notes submitted by driver */}
        {order.status === 'DELIVERED' &&
          (() => {
            const proof = order.transportJobs?.find((j) => j.deliveryProof)?.deliveryProof;
            if (!proof) return null;
            return (
              <InfoSection
                icon={<Camera size={14} color="#6b7280" />}
                title="Piegādes pierādījums"
                right={
                  <Text style={s.proofTime}>
                    {new Date(proof.createdAt).toLocaleDateString('lv-LV', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                }
              >
                {proof.recipientName ? (
                  <DetailRow label="Pieņēma" value={proof.recipientName} />
                ) : null}
                {proof.notes ? <DetailRow label="Piezīmes" value={proof.notes} /> : null}
                {proof.photos.length > 0 && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={s.proofPhotoRow}
                  >
                    {proof.photos.map((uri, i) => (
                      <Image key={i} source={{ uri }} style={s.proofPhoto} resizeMode="cover" />
                    ))}
                  </ScrollView>
                )}
                {proof.photos.length === 0 && (
                  <View style={s.proofNoPhoto}>
                    <CheckCircle size={14} color="#111827" />
                    <Text style={s.proofNoPhotoText}>Piegāde apstiprināta bez fotogrāfijas</Text>
                  </View>
                )}
              </InfoSection>
            );
          })()}

        {/* Buyer info */}
        {order.buyer && (
          <InfoSection icon={<User size={14} color="#6b7280" />} title="Pasūtītājs">
            <DetailRow label="Vārds" value={order.buyer?.name ?? ''} />
            <DetailRow label="Tālrunis" value={order.buyer?.phone} last />
          </InfoSection>
        )}

        {/* Actions */}
        <View style={s.actions}>
          {/* Chat with driver — shown whenever there's an active transport job */}
          {activeJob && (
            <TouchableOpacity
              style={s.chatDriverBtn}
              onPress={() =>
                router.push({
                  pathname: '/chat/[jobId]',
                  params: {
                    jobId: activeJob.id,
                    title: driver ? `${driver.firstName} ${driver.lastName}` : 'Šoferis',
                  },
                })
              }
              activeOpacity={0.8}
            >
              <MessageCircle size={16} color="#111827" />
              <Text style={s.chatDriverBtnText}>
                {driver ? `Rakstīt ${driver.firstName}` : 'Rakstīt šoferim'}
              </Text>
            </TouchableOpacity>
          )}
          {order.status === 'PENDING' && (
            <View style={s.pendingNote}>
              <FileText size={14} color="#6b7280" />
              <Text style={s.pendingText}>Pasūtījums gaida apstiprinājumu</Text>
            </View>
          )}
          {order.status === 'DELIVERED' && (
            <View style={s.deliveredNote}>
              <CheckCircle size={14} color="#111827" />
              <Text style={s.deliveredText}>Pasūtījums piegādāts!</Text>
            </View>
          )}
          {/* Re-order button */}
          {order.status === 'DELIVERED' && (
            <TouchableOpacity
              style={s.reorderBtn}
              onPress={() =>
                router.push({
                  pathname: '/order-request-new',
                  params: {
                    prefillMaterial: order.items[0]?.material?.name ?? '',
                    prefillAddress: order.deliveryAddress ?? '',
                    prefillCity: order.deliveryCity ?? '',
                  },
                })
              }
              activeOpacity={0.85}
            >
              <Text style={s.reorderBtnText}>🔁 Pasūtīt vēlreiz</Text>
            </TouchableOpacity>
          )}

          {order.status === 'DELIVERED' && !hasRated && (
            <TouchableOpacity
              style={s.rateBtn}
              onPress={() => setShowRating(true)}
              activeOpacity={0.85}
            >
              <Star size={16} color="#fff" fill="#fff" />
              <Text style={s.rateBtnText}>{t.rating.rateBtn}</Text>
            </TouchableOpacity>
          )}
          {order.status === 'DELIVERED' && hasRated && (
            <View style={s.alreadyRated}>
              <Star size={14} color="#9ca3af" fill="#9ca3af" />
              <Text style={s.alreadyRatedText}>{t.rating.alreadyRated}</Text>
            </View>
          )}
          {order.status === 'CANCELLED' && (
            <View style={s.cancelledNote}>
              <XCircle size={14} color="#b91c1c" />
              <Text style={s.cancelledText}>Pasūtījums atcelts</Text>
            </View>
          )}
          {canCancel && (
            <TouchableOpacity
              style={[s.cancelOrderBtn, actionLoading && { opacity: 0.5 }]}
              onPress={handleCancel}
              disabled={actionLoading}
              activeOpacity={0.8}
            >
              {actionLoading ? (
                <ActivityIndicator size="small" color="#111827" />
              ) : (
                <Text style={s.cancelOrderBtnText}>Atcelt pasūtījumu</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Rating modal */}
      {id && token && (
        <RatingModal
          visible={showRating}
          onClose={() => setShowRating(false)}
          onSuccess={() => {
            setShowRating(false);
            setRatedLocally(true);
          }}
          token={token}
          orderId={id}
        />
      )}
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f2f7' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#111827', flex: 1, marginHorizontal: 10 },
  content: { padding: 16, gap: 12, paddingBottom: 48 },
  driverCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 14,
    padding: 14,
    gap: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#111827',
  },
  driverCardRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  driverTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flex: 1,
  },
  driverInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  driverAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#e5e7eb' },
  driverAvatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverAvatarInitials: { fontSize: 15, fontWeight: '700', color: '#fff' },
  driverName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  driverPhone: { fontSize: 12, color: '#6b7280', marginTop: 1 },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#111827',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  callBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  itemBorder: { borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  itemName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  itemMeta: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  itemTotal: { fontSize: 15, fontWeight: '700', color: '#374151' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#f9fafb',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  totalLabel: { fontSize: 14, fontWeight: '700', color: '#111827' },
  totalValue: { fontSize: 18, fontWeight: '800', color: '#111827' },
  callSiteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    margin: 12,
    padding: 10,
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
  },
  callSiteBtnText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  actions: { gap: 10 },
  pendingNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#4b5563',
  },
  pendingText: { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  deliveredNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#111827',
  },
  deliveredText: { fontSize: 13, fontWeight: '600', color: '#111827' },
  cancelledNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fee2e2',
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#111827',
  },
  cancelledText: { fontSize: 13, fontWeight: '600', color: '#b91c1c' },
  cancelOrderBtn: {
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#111827',
  },
  cancelOrderBtnText: { fontSize: 15, fontWeight: '700', color: '#111827' },
  rateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#111827',
    borderRadius: 100,
    padding: 14,
    justifyContent: 'center',
  },
  rateBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  // ETA card
  etaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#111827',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  etaLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  etaEmoji: { fontSize: 28 },
  etaLabel: { fontSize: 11, color: '#6b7280', fontWeight: '500' },
  etaValue: { fontSize: 20, fontWeight: '800', color: '#111827', marginTop: 2 },

  // Re-order button
  reorderBtn: {
    backgroundColor: '#111827',
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
  },
  reorderBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  alreadyRated: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 12,
  },
  alreadyRatedText: { fontSize: 13, fontWeight: '600', color: '#6b7280' },

  // Documents section
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    gap: 12,
  },
  docInfo: { flex: 1 },
  docTitle: { fontSize: 14, fontWeight: '600', color: '#111827' },
  docStatus: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  docDownloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#111827',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  docDownloadText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  docPendingBadge: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  docPendingText: { fontSize: 12, fontWeight: '600', color: '#9ca3af' },

  trackingCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
  trackingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#fff7f7',
    borderBottomWidth: 1,
    borderBottomColor: '#fee2e2',
  },
  trackingTitle: { fontSize: 12, fontWeight: '700', color: '#374151', flex: 1 },

  // Order timeline
  tlRow: { flexDirection: 'row', minHeight: 44 },
  tlLeft: { alignItems: 'center', width: 28, marginRight: 12 },
  tlDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  tlDotDone: { backgroundColor: '#111827', borderColor: '#111827' },
  tlDotActive: {
    backgroundColor: '#fff',
    borderColor: '#111827',
    borderWidth: 3,
  },
  tlDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#111827',
  },
  tlLine: { flex: 1, width: 2, backgroundColor: '#e5e7eb', marginVertical: 2 },
  tlLineDone: { backgroundColor: '#111827' },
  tlContent: { flex: 1, paddingTop: 2, paddingBottom: 10 },
  tlLabel: { fontSize: 14, fontWeight: '500', color: '#9ca3af' },
  tlLabelDone: { color: '#374151', fontWeight: '600' },
  tlLabelActive: { color: '#111827', fontWeight: '700' },
  tlHint: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  chatDriverBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  chatDriverBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },

  // Delivery proof section
  proofTime: { fontSize: 11, color: '#9ca3af', marginLeft: 'auto' },
  proofPhotoRow: { paddingHorizontal: 14, paddingBottom: 14, paddingTop: 10, gap: 10 },
  proofPhoto: {
    width: 140,
    height: 140,
    borderRadius: 10,
    backgroundColor: '#e5e7eb',
  },
  proofNoPhoto: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  proofNoPhotoText: { fontSize: 13, color: '#6b7280' },

  // Weighing slip photo
  weighingSlipPhoto: {
    width: '100%',
    height: 220,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    marginTop: 10,
  },
  weighingWeight: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    marginLeft: 'auto',
  },
});

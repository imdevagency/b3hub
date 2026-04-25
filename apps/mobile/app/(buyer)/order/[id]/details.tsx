import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Alert,
  Linking,
  Image,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  MapPin,
  Package,
  Truck,
  FileText,
  CheckCircle,
  CreditCard,
  AlertTriangle,
} from 'lucide-react-native';

import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { InfoSection } from '@/components/ui/InfoSection';
import { DetailRow } from '@/components/ui/DetailRow';
import { PriceRow } from '@/components/ui/PriceRow';
import { OrderStatusBadge } from '@/components/ui/OrderStatusBadge';
import { Button } from '@/components/ui/button';
import { SkeletonDetail } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { RatingModal } from '@/components/ui/RatingModal';
import { ActionResultSheet } from '@/components/ui/ActionResultSheet';
import { useToast } from '@/components/ui/Toast';

import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { haptics } from '@/lib/haptics';
import { useOrderDetail } from '@/lib/use-order-detail';
import { UNIT_SHORT } from '@/lib/materials';
import { colors } from '@/lib/theme';
import { DisputeSheet } from '@/components/order/DisputeSheet';
import { AmendSheet } from '@/components/order/AmendSheet';

let useStripe: (() => { initPaymentSheet: Function; presentPaymentSheet: Function }) | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
  useStripe = require('@stripe/stripe-react-native').useStripe;
} catch {
  /* Expo Go fallback */
}

export default function OrderDetailsScreen() {
  const { token, user } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { order, setOrder, loading, alreadyRated, documents, reload: load } = useOrderDetail(id);
  const [actionLoading, setActionLoading] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [showDispute, setShowDispute] = useState(false);
  const [cancelResultVisible, setCancelResultVisible] = useState(false);
  const [disputeResultVisible, setDisputeResultVisible] = useState(false);
  const [disputeFiled, setDisputeFiled] = useState(false);
  const [showAmend, setShowAmend] = useState(false);
  const [ratedLocally, setRatedLocally] = useState(false);
  const [payLoading, setPayLoading] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [surchargeActionLoading, setSurchargeActionLoading] = useState<string | null>(null);

  const stripe = useStripe ? useStripe() : null;

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  useEffect(() => {
    if (!token || !id || !UUID_RE.test(id) || !order) return;
    api
      .listDisputes(token, id)
      .then((disputes) => {
        if (disputes.length > 0) setDisputeFiled(true);
      })
      .catch(() => null);
  }, [token, id, order?.id]);

  const handleApproveSurcharge = useCallback(
    async (surchargeId: string) => {
      const jobId = order?.transportJobs?.[0]?.id;
      if (!token || !jobId) return;
      setSurchargeActionLoading(surchargeId);
      haptics.light();
      try {
        await api.transportJobs.approveSurcharge(jobId, surchargeId, token);
        haptics.success();
        load();
      } catch (err: unknown) {
        haptics.error();
        toast.error(err instanceof Error ? err.message : 'Neizdevās apstiprināt piemaksu');
      } finally {
        setSurchargeActionLoading(null);
      }
    },
    [load, order?.transportJobs, toast, token],
  );

  const handleRejectSurcharge = useCallback(
    async (surchargeId: string) => {
      const jobId = order?.transportJobs?.[0]?.id;
      if (!token || !jobId) return;
      setSurchargeActionLoading(surchargeId);
      haptics.light();
      try {
        await api.transportJobs.rejectSurcharge(jobId, surchargeId, token);
        haptics.success();
        load();
      } catch (err: unknown) {
        haptics.error();
        toast.error(err instanceof Error ? err.message : 'Neizdevās noraidīt piemaksu');
      } finally {
        setSurchargeActionLoading(null);
      }
    },
    [load, order?.transportJobs, toast, token],
  );

  const handlePay = useCallback(async () => {
    if (!token || !order || !stripe) return;
    setPayLoading(true);
    haptics.light();
    try {
      const { clientSecret } = await api.createIntent(order.id, token);
      const { error: initError } = await stripe.initPaymentSheet({
        paymentIntentClientSecret: clientSecret,
        merchantDisplayName: 'B3Hub',
        returnURL: 'b3hub://order/return',
        defaultBillingDetails: {},
      });
      if (initError) {
        toast.error(initError.message);
        return;
      }
      const { error: presentError } = await stripe.presentPaymentSheet();
      if (presentError) {
        if (presentError.code !== 'Canceled') {
          haptics.error();
          Alert.alert('Maksājums neizdevās', presentError.message);
        }
        return;
      }
      haptics.success();
      Alert.alert('Maksājums veiksmīgs', 'Jūsu pasūtījums tiek apstrādāts.');
      setPaymentProcessing(true);
      load();
    } catch (err: unknown) {
      haptics.error();
      toast.error(err instanceof Error ? err.message : 'Neizdevās apstrādāt maksājumu');
    } finally {
      setPayLoading(false);
    }
  }, [load, order, stripe, toast, token]);

  const handleCancel = useCallback(() => {
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
            setCancelResultVisible(true);
          } catch (err: unknown) {
            haptics.error();
            toast.error(err instanceof Error ? err.message : 'Neizdevās atcelt');
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  }, [order, setOrder, toast, token]);

  const handleConfirmReceipt = useCallback(() => {
    haptics.medium();
    Alert.alert(
      'Apstiprināt saņemšanu?',
      'Apstiprinot saņemšanu, pasūtījums tiks slēgts un maksājums tiks izmaksāts piegādātājam.',
      [
        { text: 'Nē', style: 'cancel' },
        {
          text: 'Apstiprināt',
          onPress: async () => {
            if (!token || !order) return;
            setActionLoading(true);
            try {
              const updated = await api.orders.confirmReceipt(order.id, token);
              setOrder(updated);
              haptics.success();
              router.push({
                pathname: '/review/[orderId]',
                params: { orderId: order.id },
              } as never);
            } catch (err: unknown) {
              haptics.error();
              toast.error(err instanceof Error ? err.message : 'Neizdevās apstiprināt');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ],
    );
  }, [order, setOrder, toast, token]);

  if (loading) {
    return (
      <ScreenContainer bg="#F4F5F7" standalone>
        <ScreenHeader title="Detaļas" />
        <SkeletonDetail />
      </ScreenContainer>
    );
  }

  if (!order) {
    return (
      <ScreenContainer bg="#F4F5F7" standalone>
        <ScreenHeader title="Detaļas" />
        <EmptyState icon={<Package size={32} color="#9CA3AF" />} title="Pasūtījums nav atrasts" />
      </ScreenContainer>
    );
  }

  const activeJob = order.transportJobs?.find(
    (job) =>
      job.status === 'ACCEPTED' ||
      job.status === 'EN_ROUTE_PICKUP' ||
      job.status === 'AT_PICKUP' ||
      job.status === 'LOADED' ||
      job.status === 'EN_ROUTE_DELIVERY' ||
      job.status === 'AT_DELIVERY',
  );
  const driver = activeJob?.driver;
  const canManageOrders = !user?.companyRole || (user?.permManageOrders ?? false);
  const canCancel = ['PENDING', 'CONFIRMED'].includes(order.status) && canManageOrders;
  const canPay =
    !paymentProcessing &&
    order.status === 'PENDING' &&
    (!order.paymentStatus || order.paymentStatus === 'PENDING') &&
    order.paymentMethod !== 'INVOICE' &&
    !!stripe;
  const hasRated = alreadyRated || ratedLocally;
  const canRate = order.status === 'COMPLETED' && !hasRated;

  return (
    <ScreenContainer bg="#F4F5F7" standalone>
      <ScreenHeader title="Detaļas" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* ── Hero ── */}
        <View style={styles.heroSection}>
          <View style={styles.heroTitleRow}>
            <Text style={styles.heroTitle} numberOfLines={2}>
              {order.items && order.items.length > 0
                ? order.items[0].material.name
                : 'Materiālu pasūtījums'}
            </Text>
            <OrderStatusBadge status={order.status} size="md" />
          </View>
          <Text style={styles.heroSubtitle}>
            {new Date(order.createdAt).toLocaleDateString('lv-LV', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}{' '}
            · #{order.orderNumber}
          </Text>
        </View>

        {/* ── Alerts ── */}
        {disputeFiled && order.status === 'DELIVERED' && (
          <View style={styles.alertCard}>
            <AlertTriangle size={20} color="#B45309" />
            <Text style={styles.alertText}>
              Saņemšanas apstiprinājums ir apturēts, kamēr tiek izskatīts strīds.
            </Text>
          </View>
        )}

        {order.surcharges?.some((s) => s.approvalStatus === 'PENDING') && (
          <View style={styles.surchargeAlertCard}>
            <AlertTriangle size={20} color="#B45309" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.alertText, { fontWeight: '700' }]}>
                {order.surcharges!.filter((s) => s.approvalStatus === 'PENDING').length === 1
                  ? 'Šoferis pieprasa piemaksu'
                  : `${order.surcharges!.filter((s) => s.approvalStatus === 'PENDING').length} piemaksas gaida apstiprināšanu`}
              </Text>
              <Text style={[styles.alertText, { fontWeight: '400', marginTop: 4 }]}>
                Skatiet "Piemaksas" sadaļu zemāk, lai apstiprinātu vai noraidītu.
              </Text>
            </View>
          </View>
        )}

        {/* ── Delivery info ── */}
        <InfoSection
          icon={<Package size={16} color={colors.textMuted} />}
          title="Piegādes informācija"
        >
          <DetailRow label="Adrese" value={`${order.deliveryAddress}, ${order.deliveryCity}`} />
          <DetailRow
            label="Piegādes laiks"
            value={`${order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString('lv-LV') : '—'}${order.deliveryWindow ? ` (${order.deliveryWindow})` : ''}`}
          />
          <DetailRow label="Saņēmējs" value={order.siteContactName || user?.firstName || '—'} />
          <DetailRow label="Sazināties" value={order.siteContactPhone || user?.phone || '—'} />
          <DetailRow label="Piezīmes šoferim" value={order.notes || '—'} />
          <DetailRow
            label="Maksājuma veids"
            value={order.paymentMethod === 'INVOICE' ? 'Rēķins' : 'Karte'}
            last
          />
        </InfoSection>

        {/* ── Items ── */}
        {order.items && order.items.length > 0 && (
          <InfoSection
            icon={<Package size={16} color={colors.textMuted} />}
            title="Pasūtījuma pozīcijas"
          >
            {order.items.map((item, index) => (
              <DetailRow
                key={`${item.material.name}-${index}`}
                label={item.material.name}
                value={`${item.quantity} ${UNIT_SHORT[item.unit as keyof typeof UNIT_SHORT] ?? item.unit}`}
                last={index === order.items.length - 1}
              />
            ))}
          </InfoSection>
        )}

        {/* ── Pricing ── */}
        <InfoSection icon={<CreditCard size={16} color={colors.textMuted} />} title="Apmaksa">
          <PriceRow label="Materiāli" amount={order.subtotal} />
          <PriceRow label="PVN" amount={order.tax} />
          <PriceRow label="Piegāde" amount={order.deliveryFee} />
          <PriceRow label="Pavisam kopā" amount={order.total} total />
        </InfoSection>

        {order.surcharges && order.surcharges.length > 0 && (
          <InfoSection
            icon={<AlertTriangle size={16} color={colors.textMuted} />}
            title="Piemaksas"
          >
            <View style={styles.surchargeList}>
              {order.surcharges.map((surcharge) => (
                <View key={surcharge.id} style={styles.surchargeCard}>
                  <View style={styles.surchargeHeader}>
                    <Text style={styles.surchargeLabel}>{surcharge.label}</Text>
                    <Text style={styles.surchargeAmount}>€{surcharge.amount.toFixed(2)}</Text>
                  </View>
                  <Text style={styles.surchargeStatus}>
                    Statuss:{' '}
                    {surcharge.approvalStatus === 'APPROVED'
                      ? 'Apstiprināta'
                      : surcharge.approvalStatus === 'REJECTED'
                        ? 'Noraidīta'
                        : 'Gaida apstiprinājumu'}
                  </Text>
                  {surcharge.approvalStatus === 'PENDING' && (
                    <View style={styles.rowActions}>
                      <View style={styles.rowActionItem}>
                        <Button
                          size="sm"
                          onPress={() => {
                            void handleApproveSurcharge(surcharge.id);
                          }}
                          disabled={surchargeActionLoading === surcharge.id}
                          isLoading={surchargeActionLoading === surcharge.id}
                        >
                          Apstiprināt
                        </Button>
                      </View>
                      <View style={styles.rowActionItem}>
                        <Button
                          variant="outline"
                          size="sm"
                          onPress={() => {
                            void handleRejectSurcharge(surcharge.id);
                          }}
                          disabled={surchargeActionLoading === surcharge.id}
                        >
                          Noraidīt
                        </Button>
                      </View>
                    </View>
                  )}
                </View>
              ))}
            </View>
          </InfoSection>
        )}

        {documents.length > 0 && (
          <InfoSection icon={<FileText size={16} color={colors.textMuted} />} title="Dokumenti">
            <View style={styles.documentList}>
              {documents.map((document) => (
                <TouchableOpacity
                  key={document.id}
                  style={styles.documentCard}
                  onPress={() => {
                    if (document.fileUrl) {
                      haptics.light();
                      Linking.openURL(document.fileUrl).catch(() => null);
                    }
                  }}
                  disabled={!document.fileUrl}
                  activeOpacity={0.8}
                >
                  <View style={styles.documentMeta}>
                    <Text style={styles.documentTitle}>{document.title}</Text>
                    <Text style={styles.documentStatus}>{document.status}</Text>
                  </View>
                  <Text
                    style={[styles.documentLink, !document.fileUrl && styles.documentLinkDisabled]}
                  >
                    {document.fileUrl ? 'Atvērt' : 'Drīzumā'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </InfoSection>
        )}

        {activeJob?.deliveryProof && (
          <InfoSection
            icon={<CheckCircle size={16} color={colors.textMuted} />}
            title="Piegādes apliecinājums"
          >
            <DetailRow label="Saņēmējs" value={activeJob.deliveryProof.recipientName || '—'} />
            <DetailRow
              label="Piezīmes"
              value={activeJob.deliveryProof.notes || '—'}
              last={activeJob.deliveryProof.photos.length === 0}
            />
            {activeJob.deliveryProof.photos.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.photoRow}
              >
                {activeJob.deliveryProof.photos.map((photo, index) => (
                  <Image
                    key={`${photo}-${index}`}
                    source={{ uri: photo }}
                    style={styles.proofImage}
                  />
                ))}
              </ScrollView>
            )}
          </InfoSection>
        )}

        {order.sitePhotoUrl && (
          <InfoSection icon={<MapPin size={16} color={colors.textMuted} />} title="Objekta foto">
            <Image
              source={{ uri: order.sitePhotoUrl }}
              style={styles.siteImage}
              resizeMode="cover"
            />
          </InfoSection>
        )}

        {order.linkedSkipOrder && (
          <InfoSection
            icon={<Truck size={16} color={colors.textMuted} />}
            title="Saistītais skip pasūtījums"
          >
            <DetailRow label="Numurs" value={`#${order.linkedSkipOrder.orderNumber}`} />
            <DetailRow label="Konteinera ID" value={order.linkedSkipOrder.id} />
            <DetailRow label="Statuss" value={order.linkedSkipOrder.status} />
            <DetailRow label="Izmērs" value={order.linkedSkipOrder.skipSize} />
            <DetailRow label="Atkritumi" value={order.linkedSkipOrder.wasteCategory} last />
          </InfoSection>
        )}

        {/* ── Secondary actions ── */}
        <View style={styles.secondaryActionsBlock}>
          {driver && activeJob && (
            <Button
              variant="outline"
              size="lg"
              onPress={() => {
                haptics.medium();
                router.push({
                  pathname: '/chat/[jobId]',
                  params: {
                    jobId: activeJob.id,
                    title: `${driver.firstName} ${driver.lastName}`,
                  },
                });
              }}
            >
              Rakstīt šoferim
            </Button>
          )}

          {canRate && (
            <Button
              variant="outline"
              size="lg"
              onPress={() => {
                haptics.medium();
                setShowRating(true);
              }}
            >
              Novērtēt pasūtījumu
            </Button>
          )}

          {order.status !== 'COMPLETED' && order.status !== 'CANCELLED' && (
            <Button variant="secondary" size="lg" onPress={() => setShowDispute(true)}>
              Ziņot par problēmu
            </Button>
          )}

          {canCancel && (
            <View style={styles.rowActions}>
              <View style={styles.rowActionItem}>
                <Button
                  variant="destructive"
                  size="lg"
                  onPress={handleCancel}
                  isLoading={actionLoading}
                >
                  Atcelt
                </Button>
              </View>
              <View style={styles.rowActionItem}>
                <Button variant="secondary" size="lg" onPress={() => setShowAmend(true)}>
                  Labot
                </Button>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Sticky primary action footer ── */}
      {(order.status === 'DELIVERED' || canPay) && (
        <View style={styles.stickyFooter}>
          {order.status === 'DELIVERED' && (
            <Button
              size="lg"
              onPress={handleConfirmReceipt}
              disabled={actionLoading || disputeFiled}
              isLoading={actionLoading}
            >
              Apstiprināt saņemšanu
            </Button>
          )}
          {canPay && (
            <Button size="lg" onPress={handlePay} disabled={payLoading} isLoading={payLoading}>
              {`Apmaksāt €${order.total.toFixed(2)}`}
            </Button>
          )}
        </View>
      )}

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

      {order && token && (
        <DisputeSheet
          visible={showDispute}
          onClose={() => setShowDispute(false)}
          order={order}
          token={token}
          onFiled={() => {
            setDisputeFiled(true);
            setDisputeResultVisible(true);
          }}
        />
      )}

      {order && token && (
        <AmendSheet
          visible={showAmend}
          onClose={() => setShowAmend(false)}
          order={order}
          token={token}
          onSuccess={load}
        />
      )}

      <ActionResultSheet
        visible={cancelResultVisible}
        onClose={() => setCancelResultVisible(false)}
        variant="cancelled"
        title="Pasūtījums atcelts"
        subtitle="Jūsu pasūtījums ir atcelts."
        primaryLabel="Pasūtīt no jauna"
        onPrimary={() => {
          setCancelResultVisible(false);
          router.replace({ pathname: '/material-order' });
        }}
        secondaryLabel="Mani pasūtījumi"
        onSecondary={() => {
          setCancelResultVisible(false);
          router.replace('/(buyer)/orders');
        }}
      />

      <ActionResultSheet
        visible={disputeResultVisible}
        onClose={() => setDisputeResultVisible(false)}
        variant="info"
        title="Sūdzība iesniegta"
        subtitle="Mēs izskatīsim jūsu paziņojumu."
        primaryLabel="Labi"
        onPrimary={() => setDisputeResultVisible(false)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  heroSection: {
    marginTop: 8,
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  heroTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
  },
  heroTitle: {
    flex: 1,
    fontSize: 26,
    lineHeight: 32,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
    color: '#111827',
  },
  heroSubtitle: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
    color: '#6B7280',
    marginTop: 8,
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FEF3C7',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  surchargeAlertCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#FFF7ED',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FED7AA',
    padding: 16,
    marginBottom: 16,
  },
  alertText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
    color: '#92400E',
  },
  secondaryActionsBlock: {
    gap: 12,
    marginTop: 12,
  },
  stickyFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 16,
    paddingBottom: 36,
    paddingHorizontal: 16,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 8,
  },
  rowActions: {
    flexDirection: 'row',
    gap: 10,
  },
  rowActionItem: {
    flex: 1,
  },
  surchargeList: {
    gap: 10,
  },
  surchargeCard: {
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    padding: 14,
  },
  surchargeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  surchargeLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    color: '#111827',
  },
  surchargeAmount: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
    color: '#111827',
  },
  surchargeStatus: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
    color: '#6B7280',
    marginTop: 8,
    marginBottom: 10,
  },
  documentList: {
    gap: 10,
  },
  documentCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    padding: 16,
  },
  documentMeta: {
    flex: 1,
    marginRight: 12,
  },
  documentTitle: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    color: '#111827',
  },
  documentStatus: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
    color: '#6B7280',
    marginTop: 2,
  },
  documentLink: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
    color: colors.primary,
  },
  documentLinkDisabled: {
    color: '#9CA3AF',
  },
  photoRow: {
    gap: 10,
    paddingTop: 12,
  },
  proofImage: {
    width: 160,
    height: 120,
    borderRadius: 14,
    backgroundColor: '#E5E7EB',
  },
  siteImage: {
    width: '100%',
    height: 220,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
  },
});

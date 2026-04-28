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
import { ChevronLeft } from 'lucide-react-native';
import {
  MapPin,
  Package,
  Truck,
  FileText,
  CheckCircle,
  CreditCard,
  AlertTriangle,
  QrCode,
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
    if (!token || !order) return;
    setPayLoading(true);
    haptics.light();
    try {
      const { paymentUrl } = await api.createIntent(order.id, token);
      const supported = await Linking.canOpenURL(paymentUrl);
      if (!supported) {
        toast.error('Nevar atvērt maksājuma lapu');
        return;
      }
      await Linking.openURL(paymentUrl);
      // Webhook will update payment status; reload order when user returns
      setPaymentProcessing(true);
      load();
    } catch (err: unknown) {
      haptics.error();
      toast.error(err instanceof Error ? err.message : 'Neizdevās apstrādāt maksājumu');
    } finally {
      setPayLoading(false);
    }
  }, [load, order, toast, token]);

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
      <ScreenContainer bg="#FFFFFF" standalone>
        <ScreenHeader title="Detaļas" />
        <SkeletonDetail />
      </ScreenContainer>
    );
  }

  if (!order) {
    return (
      <ScreenContainer bg="#FFFFFF" standalone>
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
    order.paymentMethod !== 'INVOICE';
  const hasRated = alreadyRated || ratedLocally;
  const canRate = order.status === 'COMPLETED' && !hasRated;

  return (
    <ScreenContainer bg="#FFFFFF" standalone>
      <View style={styles.headerSpacer} />
      <View style={styles.headerSection}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            haptics.light();
            if (router.canGoBack()) router.back();
            else router.replace('/(buyer)/orders');
          }}
          hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
        >
          <ChevronLeft size={24} color="#111827" />
        </TouchableOpacity>

        <View style={styles.titleRow}>
          <View style={styles.titleLeft}>
            <Text style={styles.titleText}>
              {order.items && order.items.length > 0
                ? order.items[0].material.name
                : 'Materiālu piegāde'}
            </Text>
            <Text style={styles.dateText}>
              {new Date(order.createdAt).toLocaleDateString('lv-LV', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}{' '}
              · #{order.orderNumber}
            </Text>
          </View>
          <View style={styles.avatarCircle}>
            <Package size={20} color="#9CA3AF" />
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {((disputeFiled && order.status === 'DELIVERED') ||
          order.surcharges?.some((s) => s.approvalStatus === 'PENDING')) && (
          <View style={styles.cardSection}>
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
                  <Text style={[styles.alertText, { fontWeight: '600' }]}>
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
          </View>
        )}

        {order.fulfillmentType === 'PICKUP' && order.pickupField && (
          <View style={styles.cardSection}>
            <Text style={styles.sectionHeading}>B3 Field caurlaide</Text>
            <View style={styles.pickupPassCard}>
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: '#FFFBEB',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <QrCode size={20} color="#92400E" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pickupPassTitle}>{order.pickupField.name}</Text>
                  <Text style={styles.pickupPassSub}>{order.pickupField.city}</Text>
                </View>
              </View>

              {order.pickupSlot && (
                <View style={styles.pickupPassSlot}>
                  <Text style={styles.pickupPassSlotLabel}>Rezervētais laiks</Text>
                  <Text style={styles.pickupPassSlotTime}>
                    {new Date(order.pickupSlot.slotStart).toLocaleDateString('lv-LV', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                    })}
                    {`\n`}
                    {new Date(order.pickupSlot.slotStart).toLocaleTimeString('lv-LV', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {' – '}
                    {new Date(order.pickupSlot.slotEnd).toLocaleTimeString('lv-LV', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
              )}

              {order.fieldPasses && order.fieldPasses.length > 0 ? (
                <View style={{ gap: 8, marginTop: 8 }}>
                  {order.fieldPasses.map((pass) => (
                    <View key={pass.id} style={styles.passRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.passNumber}>{pass.passNumber}</Text>
                        <Text style={styles.passPlate}>{pass.vehiclePlate}</Text>
                      </View>
                      <View
                        style={{
                          backgroundColor: pass.status === 'ACTIVE' ? '#ECFDF5' : '#F3F4F6',
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderRadius: 100,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            fontFamily: 'Inter_600SemiBold',
                            color: pass.status === 'ACTIVE' ? '#059669' : '#6B7280',
                          }}
                        >
                          {pass.status === 'ACTIVE'
                            ? 'Aktīva'
                            : pass.status === 'EXPIRED'
                              ? 'Beigusies'
                              : pass.status}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.passWaiting}>
                  <Text style={styles.passWaitingText}>
                    Caurlaude tiks izsniegta pēc pasūtījuma apstiprināšanas
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {order.fulfillmentType !== 'PICKUP' && (
          <>
            <View style={styles.divider} />
            <View style={styles.cardSection}>
              <Text style={styles.sectionHeading}>Piegādes informācija</Text>
              <DetailRow label="Adrese" value={`${order.deliveryAddress}, ${order.deliveryCity}`} />
              <DetailRow
                label="Piegādes laiks"
                value={`${order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString('lv-LV') : '—'}${order.deliveryWindow ? ` (${order.deliveryWindow})` : ''}`}
              />
              {order.statusTimestamps?.COMPLETED && (
                <DetailRow
                  label="Pabeigts"
                  value={new Date(order.statusTimestamps.COMPLETED).toLocaleDateString('lv-LV', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                />
              )}
              {order.project && <DetailRow label="Projekts" value={order.project.name} />}
              <DetailRow label="Saņēmējs" value={order.siteContactName || user?.firstName || '—'} />
              <DetailRow label="Sazināties" value={order.siteContactPhone || user?.phone || '—'} />
              <DetailRow label="Piezīmes šoferim" value={order.notes || '—'} />
              <DetailRow
                label="Maksājuma veids"
                value={order.paymentMethod === 'INVOICE' ? 'Rēķins' : 'Karte'}
                last
              />
            </View>
          </>
        )}

        {order.items && order.items.length > 0 && (
          <>
            <View style={styles.divider} />
            <View style={styles.cardSection}>
              <Text style={styles.sectionHeading}>Pasūtījuma pozīcijas</Text>
              {order.items.map((item, index) => (
                <DetailRow
                  key={`${item.material.name}-${index}`}
                  label={item.material.name}
                  value={`${item.quantity} ${UNIT_SHORT[item.unit as keyof typeof UNIT_SHORT] ?? item.unit}`}
                  last={index === order.items.length - 1}
                />
              ))}
            </View>
          </>
        )}

        <>
          <View style={styles.divider} />
          <View style={styles.cardSection}>
            <Text style={styles.sectionHeading}>Apmaksa</Text>
            <View style={styles.payRow}>
              <Text style={styles.payLabel}>Materiāli</Text>
              <Text style={styles.payAmount}>€{order.subtotal.toFixed(2)}</Text>
            </View>
            {order.tax > 0 && (
              <View style={styles.payRow}>
                <Text style={styles.payLabel}>PVN</Text>
                <Text style={styles.payAmount}>€{order.tax.toFixed(2)}</Text>
              </View>
            )}
            {order.deliveryFee > 0 && (
              <View style={styles.payRow}>
                <Text style={styles.payLabel}>Piegāde</Text>
                <Text style={styles.payAmount}>€{order.deliveryFee.toFixed(2)}</Text>
              </View>
            )}
            <View style={styles.payHairline} />
            <View style={styles.payRow}>
              <Text style={styles.payTotalLabel}>Kopā</Text>
              <Text style={styles.payTotalAmount}>€{order.total.toFixed(2)}</Text>
            </View>
            <View style={styles.payMethodRow}>
              <CreditCard size={20} color="#6B7280" />
              <Text style={styles.payMethodText}>
                {order.paymentMethod === 'INVOICE' ? 'Pārskaitījums (Rēķins)' : 'Karte (Paysera)'}
              </Text>
            </View>
          </View>
        </>

        {order.surcharges && order.surcharges.length > 0 && (
          <>
            <View style={styles.divider} />
            <View style={styles.cardSection}>
              <Text style={styles.sectionHeading}>Piemaksas</Text>
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
            </View>
          </>
        )}

        {documents && documents.length > 0 && (
          <>
            <View style={styles.divider} />
            <View style={styles.cardSection}>
              <Text style={styles.sectionHeading}>Dokumenti</Text>
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
                      style={[
                        styles.documentLink,
                        !document.fileUrl && styles.documentLinkDisabled,
                      ]}
                    >
                      {document.fileUrl ? 'Atvērt' : 'Drīzumā'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </>
        )}

        {activeJob?.deliveryProof && (
          <>
            <View style={styles.divider} />
            <View style={styles.cardSection}>
              <Text style={styles.sectionHeading}>Piegādes apliecinājums</Text>
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
            </View>
          </>
        )}

        {order.sitePhotoUrl && (
          <>
            <View style={styles.divider} />
            <View style={styles.cardSection}>
              <Text style={styles.sectionHeading}>Objekta foto</Text>
              <Image
                source={{ uri: order.sitePhotoUrl }}
                style={styles.siteImage}
                resizeMode="cover"
              />
            </View>
          </>
        )}

        {order.linkedSkipOrder && (
          <>
            <View style={styles.divider} />
            <View style={styles.cardSection}>
              <Text style={styles.sectionHeading}>Saistītais skip pasūtījums</Text>
              <DetailRow label="Numurs" value={`#${order.linkedSkipOrder.orderNumber}`} />
              <DetailRow label="Konteinera ID" value={order.linkedSkipOrder.id} />
              <DetailRow label="Statuss" value={order.linkedSkipOrder.status} />
              <DetailRow label="Izmērs" value={order.linkedSkipOrder.skipSize} />
              <DetailRow label="Atkritumi" value={order.linkedSkipOrder.wasteCategory} last />
            </View>
          </>
        )}
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
  headerSpacer: {
    height: 48,
  },
  headerSection: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  backButton: {
    marginBottom: 16,
    width: 40,
    height: 40,
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginLeft: -8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleLeft: {
    flex: 1,
    paddingRight: 16,
  },
  titleText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 22,
    color: '#111827',
    marginBottom: 4,
  },
  dateText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: '#6B7280',
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: '#374151',
  },
  content: {
    paddingBottom: 120,
  },
  cardSection: {
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  sectionHeading: {
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
    color: '#111827',
    marginBottom: 20,
  },
  divider: {
    height: 8,
    backgroundColor: '#F3F4F6',
    width: '100%',
  },
  paymentMethodText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    color: '#374151',
    marginLeft: 8,
  },
  payRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  payLabel: {
    flex: 1,
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    color: '#111827',
  },
  payAmount: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    color: '#111827',
  },
  payHairline: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 4,
  },
  payTotalLabel: {
    flex: 1,
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    color: '#111827',
  },
  payTotalAmount: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    color: '#111827',
  },
  payMethodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 8,
  },
  payMethodText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    color: '#374151',
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FEF3C7',
    borderRadius: 16,
    padding: 16,
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
  },
  alertText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
    color: '#92400E',
  },
  pickupPassCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    padding: 16,
  },
  pickupPassTitle: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    color: '#111827',
  },
  pickupPassSub: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
    color: '#6B7280',
    marginTop: 2,
  },
  pickupPassSlot: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  pickupPassSlotLabel: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
    color: '#6B7280',
  },
  pickupPassSlotTime: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    color: '#111827',
    marginTop: 4,
  },
  passRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
  },
  passNumber: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    color: '#111827',
  },
  passPlate: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
    color: '#6B7280',
    marginTop: 2,
  },
  passWaiting: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    alignItems: 'center',
  },
  passWaitingText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
    color: '#6B7280',
    textAlign: 'center',
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
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
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
  rowActions: {
    flexDirection: 'row',
    gap: 10,
  },
  rowActionItem: {
    flex: 1,
  },
  documentList: {
    gap: 10,
  },
  documentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    borderRadius: 12,
  },
  documentMeta: {
    flex: 1,
  },
  documentTitle: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
    color: '#111827',
  },
  documentStatus: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#6B7280',
    marginTop: 2,
  },
  documentLink: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    color: '#10B981',
    paddingLeft: 12,
  },
  documentLinkDisabled: {
    color: '#9CA3AF',
  },
  photoRow: {
    paddingVertical: 8,
    gap: 12,
  },
  proofImage: {
    width: 140,
    height: 140,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  siteImage: {
    width: '100%',
    height: 220,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
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
});

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
import { Phone, Package, Trash2, Clock3, Truck, CreditCard } from 'lucide-react-native';

import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ChevronLeft } from 'lucide-react-native';
import { PriceRow } from '@/components/ui/PriceRow';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonDetail } from '@/components/ui/Skeleton';
import { RatingModal } from '@/components/ui/RatingModal';
import { InfoSection } from '@/components/ui/InfoSection';
import { DetailRow } from '@/components/ui/DetailRow';
import { OrderStatusBadge } from '@/components/ui/OrderStatusBadge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/Toast';

import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { haptics } from '@/lib/haptics';
import { useSkipOrder } from '@/lib/use-skip-order';
import { SIZE_LABEL } from '@/lib/materials';
import { formatDate } from '@/lib/format';
import { colors } from '@/lib/theme';

const WASTE_LABEL: Record<string, string> = {
  MIXED: 'Jaukti atkritumi',
  GREEN_GARDEN: 'Zaļie atkritumi',
  CONCRETE_RUBBLE: 'Gruži',
  WOOD: 'Koks',
  METAL_SCRAP: 'Metāls',
  ELECTRONICS_WEEE: 'Elektronika',
};

const DELIVERY_WINDOW_LABEL: Record<string, string> = {
  AM: 'Rīts (8-12)',
  PM: 'Diena (12-17)',
  ANY: 'Jebkurā laikā',
};

export default function SkipOrderDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const { order, setOrder, loading, error } = useSkipOrder(id);

  const [showRating, setShowRating] = useState(false);
  const [alreadyRated, setAlreadyRated] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (order && token && (order.status === 'COLLECTED' || order.status === 'COMPLETED')) {
      api.reviews
        .status({ skipOrderId: order.id }, token)
        .then(({ reviewed }) => setAlreadyRated(reviewed))
        .catch(() => null);
    }
  }, [order?.id, order?.status, token]);

  useEffect(() => {
    if (error) {
      toast.error('Neizdevās ielādēt pasūtījumu.');
      if (router.canGoBack()) router.back();
      else router.replace('/(buyer)/orders');
    }
  }, [error, router, toast]);

  const handleCancel = useCallback(() => {
    if (!order || !token) return;
    haptics.heavy();
    const cancelMsg =
      order.status === 'CONFIRMED'
        ? 'Konteiners jau ir piešķirts pārvadātājam. Atcelšana pēc apstiprināšanas var radīt papildu izmaksas.'
        : 'Pasūtījums vēl nav apstiprināts. Atcelšana ir bezmaksas.';
    Alert.alert('Atcelt pasūtījumu?', cancelMsg, [
      { text: 'Nē', style: 'cancel' },
      {
        text: 'Atcelt',
        style: 'destructive',
        onPress: async () => {
          setCancelling(true);
          try {
            const updated = await api.skipHire.cancel(order.id, token);
            setOrder(updated);
            haptics.success();
          } catch (err: unknown) {
            haptics.error();
            toast.error(err instanceof Error ? err.message : 'Neizdevās atcelt pasūtījumu');
          } finally {
            setCancelling(false);
          }
        },
      },
    ]);
  }, [order, setOrder, toast, token]);

  const handleCallCarrier = useCallback(() => {
    if (!order?.carrier?.phone) return;
    haptics.light();
    Linking.openURL(`tel:${order?.carrier?.phone}`).catch(() =>
      toast.error('Neizdevās atvērt telefona klientu'),
    );
  }, [order?.carrier?.phone, toast]);

  const handleRequestPickup = useCallback(() => {
    if (!order || !token) return;
    haptics.medium();
    Alert.alert(
      'Pieprasīt savākšanu',
      'Mēs informēsim pārvadātāju, ka esat gatavs konteineru nodot. Viņi sazināsies ar jums, lai vienotos par laiku.',
      [
        { text: 'Atcelt', style: 'cancel' },
        {
          text: 'Pieprasīt',
          onPress: async () => {
            setActionLoading(true);
            try {
              await api.skipHire.requestPickup(order.id, token);
              haptics.success();
              toast.success('Savākšanas pieprasījums nosūtīts pārvadātājam');
            } catch (err) {
              haptics.error();
              toast.error(err instanceof Error ? err.message : 'Neizdevās nosūtīt pieprasījumu');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ],
    );
  }, [order, token, toast]);

  const handleExtendHire = useCallback(() => {
    if (!order || !token) return;
    haptics.medium();
    Alert.alert('Pagarināt nomu', 'Par cik dienām vēlaties pagarināt nomas periodu?', [
      { text: 'Atcelt', style: 'cancel' },
      {
        text: '7 dienas',
        onPress: async () => {
          setActionLoading(true);
          try {
            const updated = await api.skipHire.extendHire(order.id, 7, token);
            setOrder(updated);
            haptics.success();
            toast.success(`Noma pagarināta par 7 dienām`);
          } catch (err) {
            haptics.error();
            toast.error(err instanceof Error ? err.message : 'Neizdevās pagarināt nomu');
          } finally {
            setActionLoading(false);
          }
        },
      },
      {
        text: '14 dienas',
        onPress: async () => {
          setActionLoading(true);
          try {
            const updated = await api.skipHire.extendHire(order.id, 14, token);
            setOrder(updated);
            haptics.success();
            toast.success(`Noma pagarināta par 14 dienām`);
          } catch (err) {
            haptics.error();
            toast.error(err instanceof Error ? err.message : 'Neizdevās pagarināt nomu');
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  }, [order, setOrder, token, toast]);

  if (loading) {
    return (
      <ScreenContainer bg="#FFFFFF" standalone>
        <SkeletonDetail />
      </ScreenContainer>
    );
  }

  if (!order) {
    return (
      <ScreenContainer bg="#FFFFFF" standalone>
        <EmptyState icon={<Package size={32} color="#9CA3AF" />} title="Pasūtījums nav atrasts" />
      </ScreenContainer>
    );
  }

  const canCancel = order.status === 'PENDING' || order.status === 'CONFIRMED';
  const canRate = (order.status === 'COLLECTED' || order.status === 'COMPLETED') && !alreadyRated;
  const isTerminal =
    order.status === 'COLLECTED' || order.status === 'COMPLETED' || order.status === 'CANCELLED';
  const canAmend = order.status === 'PENDING' || order.status === 'CONFIRMED';
  const canRequestPickup = order.status === 'DELIVERED';
  const canExtend = order.status === 'DELIVERED';
  const canCallCarrier = !!order?.carrier?.phone;

  const orderRows = [
    { label: 'Pasūtījuma numurs', value: `#${order.orderNumber}` },
    { label: 'Piegādes vieta', value: order.location },
    { label: 'Piegādes datums', value: formatDate(order.deliveryDate) },
    {
      label: 'Piegādes laiks',
      value:
        order.deliveryWindow && order.deliveryWindow !== 'ANY'
          ? (DELIVERY_WINDOW_LABEL[order.deliveryWindow] ?? order.deliveryWindow)
          : null,
    },
    { label: 'Konteinera izmērs', value: SIZE_LABEL[order.skipSize] ?? order.skipSize },
    { label: 'Atkritumu veids', value: WASTE_LABEL[order.wasteCategory] ?? order.wasteCategory },
    {
      label: 'Nomas periods',
      value: order.hireDays ? `${order.hireDays} dienas` : null,
    },
    {
      label: 'Maksājuma veids',
      value:
        order.paymentMethod === 'INVOICE'
          ? 'Rēķins'
          : order.paymentMethod === 'CARD'
            ? 'Karte (Paysera)'
            : null,
    },
    { label: 'Izveidots', value: formatDate(order.createdAt) },
  ].filter((row) => row.value);

  const contactRows = [
    { label: 'Kontaktpersona', value: order.contactName ?? null },
    { label: 'Telefons', value: order.contactPhone ?? null },
    { label: 'E-pasts', value: order.contactEmail ?? null },
  ].filter((row) => row.value);

  return (
    <ScreenContainer bg="#FFFFFF" standalone topInset={0}>
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
              {order.carrier ? order.carrier.name : 'Nav piešķirts pārvadātājs'}
            </Text>
            <Text style={styles.dateText}>
              {formatDate(order.deliveryDate || order.createdAt || '')}
            </Text>
          </View>
          <View style={styles.avatarCircle}>
            {order.carrier ? (
              <Text style={styles.avatarText}>
                {order.carrier.name.substring(0, 2).toUpperCase()}
              </Text>
            ) : (
              <Package size={20} color="#9CA3AF" />
            )}
          </View>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.noMapSpacer} />

        <View style={styles.cardSection}>
          <Text style={styles.sectionHeading}>Piegāde</Text>
          <View style={styles.timeline}>
            <View style={styles.timelineStop}>
              <View style={styles.dotBgBlue}>
                <View style={styles.dotCoreBlue} />
              </View>
              <View style={styles.stopContent}>
                <Text style={styles.stopAddress}>{order.location}</Text>
                <Text style={styles.stopCity}>
                  {SIZE_LABEL[order.skipSize] ?? order.skipSize} ·{' '}
                  {WASTE_LABEL[order.wasteCategory] ?? order.wasteCategory}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.actionRow}>
            {canCallCarrier && (
              <TouchableOpacity style={styles.pillButton} onPress={handleCallCarrier}>
                <Text style={styles.pillText}>Zvanīt pārvadātājam</Text>
              </TouchableOpacity>
            )}
            {canRequestPickup && (
              <TouchableOpacity
                style={styles.pillButton}
                onPress={handleRequestPickup}
                disabled={actionLoading}
              >
                <Text style={styles.pillText}>Pieprasīt savākšanu</Text>
              </TouchableOpacity>
            )}
            {canExtend && (
              <TouchableOpacity
                style={styles.pillButton}
                onPress={handleExtendHire}
                disabled={actionLoading}
              >
                <Text style={styles.pillText}>Pagarināt nomu</Text>
              </TouchableOpacity>
            )}
            {canCancel && (
              <TouchableOpacity
                style={styles.pillButton}
                onPress={handleCancel}
                disabled={cancelling}
              >
                <Text style={styles.pillText}>Atcelt pasūtījumu</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.cardSection}>
          <Text style={styles.sectionHeading}>Maksājums</Text>
          <View style={styles.payRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.payLabel}>Konteinera noma</Text>
              <Text style={styles.paySub}>
                {SIZE_LABEL[order.skipSize] ?? order.skipSize}
                {order.hireDays ? ` · ${order.hireDays} dienas` : ''}
              </Text>
            </View>
            <Text style={styles.payAmount}>€{order.price.toFixed(2)}</Text>
          </View>
          <View style={styles.payHairline} />
          <View style={styles.payRow}>
            <Text style={styles.payTotalLabel}>Kopā</Text>
            <Text style={styles.payTotalAmount}>€{order.price.toFixed(2)}</Text>
          </View>
          <View style={styles.payMethodRow}>
            <CreditCard size={20} color="#6B7280" />
            <Text style={styles.payMethodText}>
              {order.paymentMethod === 'INVOICE'
                ? 'Pārskaitījums (Rēķins)'
                : order.paymentMethod === 'CARD'
                  ? 'Karte (Paysera)'
                  : order.paymentMethod}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.cardSection}>
          <Text style={styles.sectionHeading}>Detaļas</Text>
          {orderRows.map((row, index) => (
            <DetailRow
              key={row.label}
              label={row.label}
              value={row.value}
              last={index === orderRows.length - 1}
            />
          ))}
        </View>

        {isTerminal && (
          <View style={[styles.cardSection, { paddingTop: 8 }]}>
            <TouchableOpacity
              style={styles.pillButton}
              onPress={() => {
                haptics.light();
                router.push('/(shared)/support-chat');
              }}
            >
              <Text style={styles.pillText}>Saņemt čeku</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {canRate && (
        <RatingModal
          visible={showRating}
          onClose={() => setShowRating(false)}
          onSuccess={() => {
            setShowRating(false);
            setAlreadyRated(true);
          }}
          token={token!}
          skipOrderId={order.id}
        />
      )}
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
  scrollContent: {
    paddingBottom: 40,
  },
  noMapSpacer: {
    height: 16,
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
  timeline: {
    position: 'relative',
    marginLeft: 8,
    marginBottom: 24,
  },
  timelineStop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  dotBgBlue: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  dotCoreBlue: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  stopContent: {
    marginLeft: 16,
    width: '100%',
  },
  stopAddress: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    color: '#111827',
    marginBottom: 2,
  },
  stopCity: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: '#6B7280',
  },
  actionRow: {
    flexDirection: 'column',
    gap: 12,
  },
  pillButton: {
    width: '100%',
    height: 52,
    backgroundColor: '#F3F4F6',
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: '#111827',
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
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    color: '#111827',
  },
  paySub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
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
});

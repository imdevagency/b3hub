import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Alert, Linking, Image, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MapPin, Phone, Package, Trash2, Star, Truck, Clock3 } from 'lucide-react-native';

import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonDetail } from '@/components/ui/Skeleton';
import { RatingModal } from '@/components/ui/RatingModal';
import { InfoSection } from '@/components/ui/InfoSection';
import { DetailRow } from '@/components/ui/DetailRow';
import { StatusPill } from '@/components/ui/StatusPill';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/Toast';

import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { haptics } from '@/lib/haptics';
import { useSkipOrder } from '@/lib/use-skip-order';
import { SIZE_LABEL } from '@/lib/materials';
import { formatDate } from '@/lib/format';
import { colors } from '@/lib/theme';

const SKIP_STEPS = [
  { key: 'PENDING', label: 'Saņemts' },
  { key: 'CONFIRMED', label: 'Apstiprināts' },
  { key: 'DELIVERED', label: 'Piegādāts' },
  { key: 'COLLECTED', label: 'Savākts' },
] as const;

const STATUS_TO_STEP: Record<string, number> = {
  PENDING: 0,
  CONFIRMED: 1,
  DELIVERED: 2,
  COLLECTED: 3,
  COMPLETED: 3,
};

const STATUS_PILL: Record<string, { label: string; bg: string; color: string }> = {
  PENDING: { label: 'Saņemts', bg: '#EFF6FF', color: '#1D4ED8' },
  CONFIRMED: { label: 'Apstiprināts', bg: '#ECFDF5', color: '#047857' },
  DELIVERED: { label: 'Piegādāts', bg: '#FEF3C7', color: '#B45309' },
  COLLECTED: { label: 'Savākts', bg: '#DCFCE7', color: '#15803D' },
  COMPLETED: { label: 'Pabeigts', bg: '#DCFCE7', color: '#15803D' },
  CANCELLED: { label: 'Atcelts', bg: '#FEF2F2', color: '#DC2626' },
};

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
  const { order, setOrder, loading, error, reload } = useSkipOrder(id);

  const [showRating, setShowRating] = useState(false);
  const [alreadyRated, setAlreadyRated] = useState(false);
  const [cancelling, setCancelling] = useState(false);

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

  const carrier = order.carrier;
  const canCancel = order.status === 'PENDING' || order.status === 'CONFIRMED';
  const canRate = (order.status === 'COLLECTED' || order.status === 'COMPLETED') && !alreadyRated;
  const currentStepIdx = STATUS_TO_STEP[order.status] ?? -1;
  const statusPill = STATUS_PILL[order.status] ?? STATUS_PILL.PENDING;

  const orderRows = [
    { label: 'Pasūtījuma numurs', value: `#${order.orderNumber}` },
    { label: 'Sistēmas ID', value: order.id },
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
    { label: 'Izveidots', value: formatDate(order.createdAt) },
    { label: 'Atjaunināts', value: formatDate(order.updatedAt) },
  ].filter((row) => row.value);

  const contactRows = [
    { label: 'Kontaktpersona', value: order.contactName ?? null },
    { label: 'Telefons', value: order.contactPhone ?? null },
    { label: 'E-pasts', value: order.contactEmail ?? null },
    { label: 'Pārvadātājs', value: carrier?.name ?? null },
    { label: 'Pārvadātāja tālrunis', value: carrier?.phone ?? null },
  ].filter((row) => row.value);

  return (
    <ScreenContainer bg="#F4F5F7" standalone>
      <ScreenHeader title="Detaļas" />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical={false}
      >
        <InfoSection
          icon={<Truck size={16} color={colors.textMuted} />}
          title="Statuss"
          right={
            <StatusPill label={statusPill.label} bg={statusPill.bg} color={statusPill.color} />
          }
        >
          {order.status !== 'CANCELLED' && (
            <View style={styles.stepsRow}>
              {SKIP_STEPS.map((step, index) => {
                const done = index <= currentStepIdx;
                return (
                  <View key={step.key} style={styles.stepItem}>
                    <View style={[styles.stepDot, done && styles.stepDotActive]} />
                    <Text
                      style={[styles.stepLabel, done && styles.stepLabelActive]}
                      numberOfLines={1}
                    >
                      {step.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}

          {carrier ? (
            <View style={styles.carrierCard}>
              <View style={styles.carrierAvatarFallback}>
                <Truck size={20} color="#FFFFFF" />
              </View>
              <View style={styles.carrierMeta}>
                <Text style={styles.carrierName} numberOfLines={1}>
                  {carrier.name}
                </Text>
                {carrier.rating != null && (
                  <View style={styles.ratingPill}>
                    <Star size={12} color="#B45309" fill="#B45309" />
                    <Text style={styles.ratingPillText}>{carrier.rating.toFixed(1)}</Text>
                  </View>
                )}
              </View>
            </View>
          ) : (
            <View style={styles.waitingCard}>
              <Text style={styles.waitingTitle}>Gaida pārvadātāja apstiprinājumu</Text>
              <Text style={styles.waitingText}>
                Kad pārvadātājs apstiprinās pasūtījumu, šeit redzēsiet kontaktinformāciju un statusa
                progresu.
              </Text>
            </View>
          )}
        </InfoSection>

        <View style={styles.actionsBlock}>
          {carrier?.phone && (
            <Button
              size="lg"
              onPress={() => {
                haptics.medium();
                Linking.openURL(`tel:${carrier.phone}`).catch(() => null);
              }}
            >
              Zvanīt pārvadātājam
            </Button>
          )}

          {canRate && (
            <Button
              size="lg"
              onPress={() => {
                haptics.medium();
                setShowRating(true);
              }}
            >
              Novērtēt pakalpojumu
            </Button>
          )}

          {(order.status === 'COLLECTED' ||
            order.status === 'COMPLETED' ||
            order.status === 'CANCELLED') && (
            <Button
              variant="outline"
              size="lg"
              onPress={() => {
                haptics.medium();
                router.push('/skip-hire' as any);
              }}
            >
              Pasūtīt vēlreiz
            </Button>
          )}

          {canCancel && (
            <Button variant="destructive" size="lg" onPress={handleCancel} isLoading={cancelling}>
              Atcelt pasūtījumu
            </Button>
          )}
        </View>

        <InfoSection icon={<Package size={16} color={colors.textMuted} />} title="Pasūtījums">
          {orderRows.map((row, index) => (
            <DetailRow
              key={row.label}
              label={row.label}
              value={row.value}
              last={index === orderRows.length - 1}
            />
          ))}
        </InfoSection>

        <InfoSection
          icon={<Clock3 size={16} color={colors.textMuted} />}
          title="Cena"
          right={<Text style={styles.priceText}>€{order.price.toFixed(2)}</Text>}
        >
          <Text style={styles.priceNote}>Galīgā cena par konteineru piegādi un izvešanu.</Text>
        </InfoSection>

        <InfoSection icon={<Phone size={16} color={colors.textMuted} />} title="Kontakti">
          {contactRows.length > 0 ? (
            contactRows.map((row, index) => (
              <DetailRow
                key={row.label}
                label={row.label}
                value={row.value}
                last={index === contactRows.length - 1}
              />
            ))
          ) : (
            <Text style={styles.emptySectionText}>Kontaktu informācija vēl nav pievienota.</Text>
          )}
        </InfoSection>

        {order.notes && (
          <InfoSection icon={<Package size={16} color={colors.textMuted} />} title="Piezīmes">
            <Text style={styles.notesText}>{order.notes}</Text>
          </InfoSection>
        )}

        {order.unloadingPointPhotoUrl && (
          <InfoSection
            icon={<Trash2 size={16} color={colors.textMuted} />}
            title="Izkraušanas vietas foto"
          >
            <Image
              source={{ uri: order.unloadingPointPhotoUrl }}
              style={styles.photoThumb}
              resizeMode="cover"
            />
          </InfoSection>
        )}
      </ScrollView>

      {showRating && token && (
        <RatingModal
          visible={showRating}
          onClose={() => setShowRating(false)}
          onSuccess={() => {
            setShowRating(false);
            setAlreadyRated(true);
            if (id) {
              api.skipHire
                .getById(id, token)
                .then(setOrder)
                .catch(() => null);
            }
          }}
          token={token}
          skipOrderId={order.id}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  stepsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 16,
  },
  stepItem: {
    flex: 1,
  },
  stepDot: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    marginBottom: 8,
  },
  stepDotActive: {
    backgroundColor: colors.primary,
  },
  stepLabel: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
    color: '#9CA3AF',
  },
  stepLabelActive: {
    color: '#111827',
  },
  carrierCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 18,
    padding: 14,
  },
  carrierAvatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  carrierMeta: {
    flex: 1,
    marginLeft: 12,
  },
  carrierName: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
    color: '#111827',
  },
  ratingPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 8,
  },
  ratingPillText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    color: '#B45309',
  },
  waitingCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 18,
    padding: 14,
  },
  waitingTitle: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
    color: '#111827',
  },
  waitingText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
    color: '#6B7280',
    marginTop: 6,
  },
  actionsBlock: {
    gap: 10,
    marginBottom: 12,
  },
  priceText: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
    color: '#111827',
  },
  priceNote: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
    color: '#6B7280',
  },
  emptySectionText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
    color: '#6B7280',
  },
  notesText: {
    fontSize: 14,
    lineHeight: 21,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
    color: '#374151',
  },
  photoThumb: {
    width: '100%',
    height: 220,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
  },
});

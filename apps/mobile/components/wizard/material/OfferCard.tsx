import React from 'react';
import { TouchableOpacity, View, ActivityIndicator, StyleSheet } from 'react-native';
import { Text } from '@/components/ui/text';
import { Star, Zap, CheckCircle, Recycle } from 'lucide-react-native';
import { colors } from '@/lib/theme';
import { UNIT_SHORT } from '@/lib/materials';
import type { MaterialUnit } from '@/lib/materials';
import type { SupplierOffer } from '@/lib/api';

export interface OfferCardProps {
  offer: SupplierOffer;
  unit: MaterialUnit;
  isCheapest: boolean;
  isSelected?: boolean;
  submitting: boolean;
  onSelect: () => void;
}

export function OfferCard({
  offer,
  unit,
  isCheapest,
  isSelected,
  submitting,
  onSelect,
}: OfferCardProps) {
  const hasPerfStats =
    (offer.onTimePct != null && offer.onTimePct >= 70) ||
    (offer.fulfillmentPct != null && offer.fulfillmentPct >= 70);

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onSelect}
      disabled={submitting}
      style={[
        s.card,
        isCheapest && !isSelected && s.cardBest,
        isCheapest && !isSelected && s.cardShadow,
        offer.featured && !isCheapest && !isSelected && s.cardFeatured,
        isSelected && s.cardSelected,
      ]}
    >
      {/* Best Deal absolute badge */}
      {isCheapest && (
        <View style={s.bestBadge}>
          <Text style={s.bestBadgeText}>Labākā cena</Text>
        </View>
      )}

      {/* Featured badge (only when not already showing "best price") */}
      {offer.featured && !isCheapest && (
        <View style={s.featuredBadge}>
          <Zap size={9} color="#7c3aed" fill="#7c3aed" />
          <Text style={s.featuredBadgeText}>Ieteikts</Text>
        </View>
      )}

      {/* Recycled material badge */}
      {offer.isRecycled && (
        <View style={s.recycledBadge}>
          <Recycle size={9} color="#15803d" />
          <Text style={s.recycledBadgeText}>
            Pārstrādāts{offer.recoveryRate != null ? ` · ${offer.recoveryRate.toFixed(0)}%` : ''}
          </Text>
        </View>
      )}

      {/* Left Column: Supplier, Location, Details */}
      <View style={s.leftCol}>
        <View style={s.supplierRow}>
          <Text style={s.supplierName} numberOfLines={1}>
            {offer.supplier?.name}
          </Text>
          {offer.supplier?.rating && (
            <View style={s.ratingBadge}>
              <Star size={10} color="#111827" fill="#111827" />
              <Text style={s.ratingText}>{offer.supplier.rating.toFixed(1)}</Text>
            </View>
          )}
        </View>
        <Text style={s.locationText}>
          {offer.supplier?.city ?? offer.etaLabel ?? 'Zināms reģions'} ·{' '}
          {offer.distanceKm?.toFixed(1) ?? '— '} km
        </Text>

        {/* Performance stats row */}
        {hasPerfStats && (
          <View style={s.perfRow}>
            {offer.onTimePct != null && offer.onTimePct >= 70 && (
              <View style={s.perfChip}>
                <CheckCircle size={10} color="#15803d" strokeWidth={2.5} />
                <Text style={s.perfChipText}>{Math.round(offer.onTimePct)}% laikā</Text>
              </View>
            )}
            {offer.fulfillmentPct != null && offer.fulfillmentPct >= 70 && (
              <View style={s.perfChip}>
                <CheckCircle size={10} color="#15803d" strokeWidth={2.5} />
                <Text style={s.perfChipText}>{Math.round(offer.fulfillmentPct)}% izpilde</Text>
              </View>
            )}
          </View>
        )}

        <Text style={s.pricePerUnit}>
          {offer.effectiveUnitPrice?.toFixed(2) ?? '—'} €/{UNIT_SHORT[unit]}
          {offer.deliveryFee != null ? ` + ${offer.deliveryFee?.toFixed(2)} € piegāde` : ''}
        </Text>
        {offer.isRecycled && offer.provenanceFacility && (
          <View style={s.provenanceRow}>
            <Recycle size={11} color="#15803d" />
            <Text style={s.provenanceText} numberOfLines={1}>
              {offer.provenanceFacility}
            </Text>
          </View>
        )}
      </View>

      {/* Right Column: Price */}
      <View style={s.rightCol}>
        {submitting && isSelected ? (
          <ActivityIndicator color="#111827" size="small" />
        ) : (
          <View style={{ alignItems: 'flex-end', gap: 6 }}>
            <Text style={s.totalPrice}>€{offer.totalPrice?.toFixed(2) ?? '—'}</Text>
            {isSelected && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <CheckCircle size={14} color="#166534" strokeWidth={2.5} />
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#166534' }}>Izvēlēts</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: {
    paddingHorizontal: 16,
    paddingVertical: 18,
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#f0f0f0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
    overflow: 'visible',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  cardSelected: {
    borderColor: '#166534',
    borderWidth: 2,
    backgroundColor: '#f0fdf4',
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 4,
  },
  cardBest: {
    borderColor: '#111827',
    borderWidth: 2,
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 4,
  },
  cardFeatured: { borderColor: '#7c3aed', borderWidth: 1.5 },
  cardShadow: {},
  bestBadge: {
    position: 'absolute',
    top: -11,
    left: 16,
    backgroundColor: '#111827',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  bestBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    textTransform: 'uppercase',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.8,
  },
  featuredBadge: {
    position: 'absolute',
    top: -11,
    left: 16,
    backgroundColor: '#ede9fe',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  featuredBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#7c3aed',
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.3,
  },
  recycledBadge: {
    position: 'absolute',
    top: -11,
    right: 16,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  recycledBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#15803d',
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.3,
  },
  leftCol: { flex: 1, paddingRight: 16 },
  supplierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  supplierName: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: 'Inter_700Bold',
    marginRight: 8,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.bgMuted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  ratingText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textPrimary,
    fontFamily: 'Inter_600SemiBold',
  },
  locationText: {
    fontSize: 13,
    color: colors.textMuted,
    fontFamily: 'Inter_500Medium',
    marginBottom: 2,
  },
  provenanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  provenanceText: {
    fontSize: 12,
    color: '#15803d',
    fontFamily: 'Inter_400Regular',
  },
  perfRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  perfChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  perfChipText: {
    fontSize: 11,
    color: '#15803d',
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
  },
  pricePerUnit: { fontSize: 13, color: colors.textMuted, fontFamily: 'Inter_500Medium' },
  rightCol: { alignItems: 'flex-end', justifyContent: 'center' },
  totalPrice: {
    fontSize: 26,
    lineHeight: 32,
    includeFontPadding: false,
    fontWeight: '800',
    color: colors.textPrimary,
    fontFamily: 'Inter_800ExtraBold',
    letterSpacing: -0.5,
  },
});

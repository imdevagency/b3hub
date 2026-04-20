import React from 'react';
import { TouchableOpacity, View, ActivityIndicator, StyleSheet } from 'react-native';
import { Text } from '@/components/ui/text';
import { Star, Zap, CheckCircle } from 'lucide-react-native';
import { colors } from '@/lib/theme';
import { UNIT_SHORT } from '@/lib/materials';
import type { MaterialUnit } from '@/lib/materials';
import type { SupplierOffer } from '@/lib/api';

export interface OfferCardProps {
  offer: SupplierOffer;
  unit: MaterialUnit;
  isCheapest: boolean;
  submitting: boolean;
  onSelect: () => void;
}

export function OfferCard({ offer, unit, isCheapest, submitting, onSelect }: OfferCardProps) {
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
        isCheapest && s.cardBest,
        isCheapest && s.cardShadow,
        offer.featured && !isCheapest && s.cardFeatured,
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
      </View>

      {/* Right Column: Price */}
      <View style={s.rightCol}>
        {submitting ? (
          <ActivityIndicator color="#111827" size="small" />
        ) : (
          <Text style={s.totalPrice}>€{offer.totalPrice?.toFixed(2) ?? '—'}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardBest: { borderColor: '#111827' },
  cardFeatured: { borderColor: '#7c3aed', borderWidth: 1.5 },
  cardShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  bestBadge: {
    position: 'absolute',
    top: -10,
    right: 16,
    backgroundColor: '#e11d48',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    zIndex: 10,
    shadowColor: '#e11d48',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  bestBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fff',
    textTransform: 'uppercase',
    fontFamily: 'Inter_800ExtraBold',
    letterSpacing: 0.5,
  },
  featuredBadge: {
    position: 'absolute',
    top: -10,
    right: 16,
    backgroundColor: '#ede9fe',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  featuredBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#7c3aed',
    fontFamily: 'Inter_700Bold',
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
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
    fontFamily: 'Inter_800ExtraBold',
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
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: 'Inter_700Bold',
  },
  locationText: {
    fontSize: 13,
    color: colors.textMuted,
    fontFamily: 'Inter_500Medium',
    marginBottom: 2,
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
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
    fontFamily: 'Inter_800ExtraBold',
  },
});

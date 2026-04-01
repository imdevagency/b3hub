/**
 * SavedAddressPicker
 *
 * Shows a "Saved addresses" chip/button. When tapped, opens a bottom sheet
 * list of the user's saved addresses. Selecting one calls onPick() so it
 * pre-fills the InlineAddressStep map below.
 *
 * Usage:
 *   <SavedAddressPicker onPick={(addr) => handlePickConfirm(addr)} />
 *   <InlineAddressStep picked={picked} onPick={handlePickConfirm} />
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  SafeAreaView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Bookmark, MapPin, Star, X } from 'lucide-react-native';
import { colors as c, spacing, radius, fontSizes } from '@/lib/theme';
import { savedAddressesApi, SavedAddress } from '@/lib/api/saved-addresses';
import type { PickedAddress } from './InlineAddressStep';

// ── Helpers ───────────────────────────────────────────────────────────────────
// c is already imported as `colors` alias above

// ── Types ─────────────────────────────────────────────────────────────────────

type Props = {
  /** Called when user selects a saved address. */
  onPick: (p: PickedAddress) => void;
  /** Optional: current picked address so we can highlight the matching item. */
  currentAddress?: PickedAddress | null;
};

// ── Component ─────────────────────────────────────────────────────────────────

export function SavedAddressPicker({ onPick, currentAddress }: Props) {
  const [open, setOpen] = useState(false);
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await savedAddressesApi.list();
      setAddresses(data);
    } catch {
      // Silent fail — button just shows empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const handleSelect = (saved: SavedAddress) => {
    if (!saved.lat || !saved.lng) return; // Can't pre-fill without coords
    onPick({
      address: saved.address,
      city: saved.city,
      lat: saved.lat,
      lng: saved.lng,
    });
    setOpen(false);
  };

  return (
    <>
      {/* ── Chip button ───────────────────────────────────────────────── */}
      <TouchableOpacity
        style={styles.chip}
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
      >
        <Bookmark
          size={14}
          color={c.primary}
          style={{ marginRight: 6 }}
        />
        <Text style={styles.chipText}>Saglabātās adreses</Text>
      </TouchableOpacity>

      {/* ── Bottom sheet modal ────────────────────────────────────────── */}
      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(false)}
      >
        <SafeAreaView style={styles.sheet}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Saglabātās adreses</Text>
            <TouchableOpacity onPress={() => setOpen(false)} hitSlop={8}>
              <X size={20} color={c.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={c.primary} />
            </View>
          ) : addresses.length === 0 ? (
            <View style={styles.center}>
              <MapPin size={36} color={c.border} />
              <Text style={styles.emptyTitle}>Nav saglabātu adrešu</Text>
              <Text style={styles.emptyBody}>
                Pēc pirmā pasūtījuma varat saglabāt adresi, lai nākamreiz to izmantotu ātrāk.
              </Text>
            </View>
          ) : (
            <FlatList
              data={addresses}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: spacing.base }}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
              renderItem={({ item }) => {
                const isActive =
                  currentAddress?.address === item.address &&
                  currentAddress?.city === item.city;
                return (
                  <TouchableOpacity
                    style={[styles.row, isActive && styles.rowActive]}
                    onPress={() => handleSelect(item)}
                    activeOpacity={0.75}
                    disabled={!item.lat || !item.lng}
                  >
                    <View style={styles.rowIcon}>
                      <MapPin
                        size={18}
                        color={isActive ? c.primary : c.textMuted}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[styles.rowLabel, isActive && styles.rowLabelActive]}>
                          {item.label}
                        </Text>
                        {item.isDefault && (
                          <Star size={12} color={c.primary} fill={c.primary} />
                        )}
                      </View>
                      <Text style={styles.rowAddr} numberOfLines={1}>
                        {item.address}, {item.city}
                      </Text>
                      {!item.lat && (
                        <Text style={styles.rowNoCoords}>
                          Nav koordinātu — nevar priekšaizpildīt karti
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </SafeAreaView>
      </Modal>
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: c.bgMuted,
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 10,
    marginTop: 4,
  },
  chipText: {
    fontSize: fontSizes.xs,
    color: c.primary,
    fontWeight: '500',
  },
  sheet: {
    flex: 1,
    backgroundColor: c.bgScreen,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  sheetTitle: {
    fontSize: fontSizes.lg,
    fontWeight: '600',
    color: c.textPrimary,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: 12,
  },
  emptyTitle: {
    fontSize: fontSizes.base,
    fontWeight: '600',
    color: c.textMuted,
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: fontSizes.sm,
    color: c.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.bgCard,
    borderRadius: radius.md,
    padding: spacing.base,
    borderWidth: 1,
    borderColor: c.border,
    gap: 12,
  },
  rowActive: {
    borderColor: c.primary,
    backgroundColor: c.bgMuted,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: c.bgScreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
    color: c.textPrimary,
  },
  rowLabelActive: {
    color: c.primary,
  },
  rowAddr: {
    fontSize: fontSizes.xs,
    color: c.textMuted,
    marginTop: 2,
  },
  rowNoCoords: {
    fontSize: fontSizes.xs,
    color: c.warning,
    marginTop: 2,
  },
});

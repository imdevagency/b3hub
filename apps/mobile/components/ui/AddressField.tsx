import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MapPin, ChevronRight } from 'lucide-react-native';
import { colors } from '@/lib/theme';
import { AddressPicker, PickedLocation } from './AddressPicker';
import type { PickedAddress } from '@/components/wizard/InlineAddressStep';

export function AddressField({
  label,
  value,
  onPick,
  placeholder = 'Select address...',
  pinColor = '#1f8f53', // B3Hub green by default
}: {
  label?: string;
  value: PickedAddress | null;
  onPick: (loc: PickedAddress) => void;
  placeholder?: string;
  pinColor?: string;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <View>
      {label && <Text style={styles.label}>{label}</Text>}
      <TouchableOpacity
        style={[styles.field, value ? styles.fieldFilled : styles.fieldEmpty]}
        onPress={() => setPickerOpen(true)}
      >
        <View style={styles.iconWrap}>
          <MapPin size={20} color={value ? pinColor : '#9ca3af'} />
        </View>
        <View style={styles.textWrap}>
          {value ? (
            <Text style={styles.valueText} numberOfLines={2}>
              {value.address}
            </Text>
          ) : (
            <Text style={styles.placeholderText}>{placeholder}</Text>
          )}
        </View>
        <ChevronRight size={20} color="#9ca3af" />
      </TouchableOpacity>

      {pickerOpen && (
        <AddressPicker
          visible={pickerOpen}
          initialAddress={value?.address}
          initialLat={value?.lat}
          initialLng={value?.lng}
          pinColor={pinColor}
          onConfirm={(loc) => {
            onPick({
              address: loc.address,
              lat: loc.lat,
              lng: loc.lng,
              city: loc.city || '',
            });
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  fieldFilled: {
    backgroundColor: '#fff',
    borderColor: '#e5e7eb',
  },
  fieldEmpty: {
    backgroundColor: '#f9fafb',
  },
  iconWrap: {
    marginRight: 12,
  },
  textWrap: {
    flex: 1,
  },
  valueText: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
  },
  placeholderText: {
    fontSize: 16,
    color: '#9ca3af',
  },
});

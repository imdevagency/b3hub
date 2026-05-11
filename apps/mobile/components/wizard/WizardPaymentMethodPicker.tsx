/**
 * WizardPaymentMethodPicker
 *
 * Consistent CARD / INVOICE radio-button rows used across all wizards.
 * Pass `isLoggedIn` to show/hide the INVOICE option (B2B only).
 *
 * Usage:
 *   <WizardPaymentMethodPicker
 *     value={paymentMethod}
 *     onChange={setPaymentMethod}
 *     isLoggedIn={!!user}
 *   />
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { haptics } from '@/lib/haptics';

type PaymentMethod = 'CARD' | 'INVOICE';

interface Props {
  value: PaymentMethod;
  onChange: (val: PaymentMethod) => void;
  /** Show the invoice option only for logged-in users */
  isLoggedIn?: boolean;
}

const OPTIONS: Array<[PaymentMethod, string, string]> = [
  ['CARD', '💳 Ar karti (Paysera)', 'Tūlītējs maksājums ar debetkarti vai kredītkarti'],
  ['INVOICE', '🧾 Priekšapmaksas rēķins', 'Rēķins tiks nosūtīts uz e-pastu'],
];

export function WizardPaymentMethodPicker({ value, onChange, isLoggedIn = false }: Props) {
  const visible = OPTIONS.filter(([val]) => val === 'CARD' || isLoggedIn);

  return (
    <View style={s.container}>
      {visible.map(([val, label, sub]) => (
        <TouchableOpacity
          key={val}
          style={[s.row, value === val && s.rowActive]}
          onPress={() => {
            haptics.light();
            onChange(val);
          }}
          activeOpacity={0.75}
        >
          <View style={[s.radio, value === val && s.radioActive]}>
            {value === val && <View style={s.radioDot} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.label, value === val && s.labelActive]}>{label}</Text>
            <Text style={s.sub}>{sub}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#fff',
  },
  rowActive: { borderColor: '#111827', backgroundColor: '#f9fafb' },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { borderColor: '#111827' },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#111827',
  },
  label: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#111827',
  },
  labelActive: { color: '#111827' },
  sub: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
    fontFamily: 'Inter_400Regular',
  },
});

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { useToast } from '@/components/ui/Toast';
import { haptics } from '@/lib/haptics';
import { api } from '@/lib/api';
import type { ApiOrder } from '@/lib/api/orders';

interface Props {
  visible: boolean;
  onClose: () => void;
  order: ApiOrder;
  token: string;
  /** Called after successful save — use to trigger a screen reload. */
  onSuccess: () => void;
}

export function AmendSheet({ visible, onClose, order, token, onSuccess }: Props) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [deliveryWindow, setDeliveryWindow] = useState<'AM' | 'PM' | 'ANY'>('ANY');
  const [notes, setNotes] = useState('');
  const [contact, setContact] = useState('');
  const [phone, setPhone] = useState('');

  // Pre-fill from order every time the sheet opens
  useEffect(() => {
    if (visible) {
      setDeliveryDate(order.deliveryDate ? order.deliveryDate.split('T')[0] : '');
      setDeliveryWindow((order.deliveryWindow as 'AM' | 'PM' | 'ANY') ?? 'ANY');
      setNotes(order.notes ?? '');
      setContact(order.siteContactName ?? '');
      setPhone(order.siteContactPhone ?? '');
    }
  }, [visible]);

  const handleSubmit = async () => {
    setLoading(true);
    haptics.light();
    try {
      const body: Record<string, string> = {};
      if (deliveryDate) body.deliveryDate = deliveryDate;
      if (deliveryWindow) body.deliveryWindow = deliveryWindow;
      if (notes !== (order.notes ?? '')) body.notes = notes;
      if (contact !== (order.siteContactName ?? '')) body.siteContactName = contact;
      if (phone !== (order.siteContactPhone ?? '')) body.siteContactPhone = phone;
      await api.orders.update(order.id, body, token);
      haptics.success();
      onClose();
      onSuccess();
    } catch (err: unknown) {
      haptics.error();
      toast.error(err instanceof Error ? err.message : 'Neizdevās saglabāt izmaiņas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Labot pasūtījumu"
      subtitle="Izmaiņas iespējamas, kamēr pasūtījums nav apstiprināts"
      scrollable
    >
      <View style={{ gap: 14, paddingBottom: 8 }}>
        {/* Delivery date */}
        <View style={styles.amendField}>
          <Text style={styles.amendLabel}>Piegādes datums (GGGG-MM-DD)</Text>
          <TextInput
            style={styles.amendInput}
            placeholder="2025-06-15"
            placeholderTextColor="#9ca3af"
            value={deliveryDate}
            onChangeText={setDeliveryDate}
            keyboardType="numbers-and-punctuation"
            autoCorrect={false}
          />
        </View>

        {/* Delivery window */}
        <View style={styles.amendField}>
          <Text style={styles.amendLabel}>Piegādes laiks</Text>
          <View style={styles.amendWindowRow}>
            {(['AM', 'PM', 'ANY'] as const).map((w) => (
              <TouchableOpacity
                key={w}
                style={[styles.amendWindowBtn, deliveryWindow === w && styles.amendWindowBtnActive]}
                onPress={() => {
                  haptics.light();
                  setDeliveryWindow(w);
                }}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.amendWindowBtnText,
                    deliveryWindow === w && styles.amendWindowBtnTextActive,
                  ]}
                >
                  {w === 'AM' ? 'Rīts (8–12)' : w === 'PM' ? 'Diena (12–17)' : 'Jebkurā laikā'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Site contact */}
        <View style={styles.amendField}>
          <Text style={styles.amendLabel}>Kontaktpersona</Text>
          <TextInput
            style={styles.amendInput}
            placeholder="Vārds Uzvārds"
            placeholderTextColor="#9ca3af"
            value={contact}
            onChangeText={setContact}
          />
        </View>
        <View style={styles.amendField}>
          <Text style={styles.amendLabel}>Kontaktpersonas tālrunis</Text>
          <TextInput
            style={styles.amendInput}
            placeholder="+371 XXXXXXXX"
            placeholderTextColor="#9ca3af"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
        </View>

        {/* Notes */}
        <View style={styles.amendField}>
          <Text style={styles.amendLabel}>Piezīmes šoferim</Text>
          <TextInput
            style={[styles.amendInput, { minHeight: 80, textAlignVertical: 'top' }]}
            placeholder="Piegādes instrukcijas, ieeja objektā..."
            placeholderTextColor="#9ca3af"
            multiline
            value={notes}
            onChangeText={setNotes}
          />
        </View>

        <TouchableOpacity
          style={[styles.amendSubmitBtn, loading && { opacity: 0.5 }]}
          onPress={handleSubmit}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.amendSubmitBtnText}>Saglabāt izmaiņas</Text>
          )}
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  amendField: { gap: 8 },
  amendLabel: { fontSize: 13, fontWeight: '700', color: '#374151' },
  amendInput: {
    backgroundColor: '#f3f4f6',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: '#111827',
  },
  amendWindowRow: { flexDirection: 'row', gap: 10 },
  amendWindowBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  amendWindowBtnActive: { backgroundColor: '#111827' },
  amendWindowBtnText: { fontSize: 15, fontWeight: '700', color: '#4b5563' },
  amendWindowBtnTextActive: { color: '#fff' },
  amendSubmitBtn: {
    backgroundColor: '#111827',
    borderRadius: 999,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 12,
  },
  amendSubmitBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});

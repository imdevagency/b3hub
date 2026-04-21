import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { useToast } from '@/components/ui/Toast';
import { haptics } from '@/lib/haptics';
import { api } from '@/lib/api';
import type { ApiOrder } from '@/lib/api/orders';
import { s } from './order-detail-styles';

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
        <View style={s.amendField}>
          <Text style={s.amendLabel}>Piegādes datums (GGGG-MM-DD)</Text>
          <TextInput
            style={s.amendInput}
            placeholder="2025-06-15"
            placeholderTextColor="#9ca3af"
            value={deliveryDate}
            onChangeText={setDeliveryDate}
            keyboardType="numbers-and-punctuation"
            autoCorrect={false}
          />
        </View>

        {/* Delivery window */}
        <View style={s.amendField}>
          <Text style={s.amendLabel}>Piegādes laiks</Text>
          <View style={s.amendWindowRow}>
            {(['AM', 'PM', 'ANY'] as const).map((w) => (
              <TouchableOpacity
                key={w}
                style={[s.amendWindowBtn, deliveryWindow === w && s.amendWindowBtnActive]}
                onPress={() => {
                  haptics.light();
                  setDeliveryWindow(w);
                }}
                activeOpacity={0.8}
              >
                <Text
                  style={[s.amendWindowBtnText, deliveryWindow === w && s.amendWindowBtnTextActive]}
                >
                  {w === 'AM' ? 'Rīts (8–12)' : w === 'PM' ? 'Diena (12–17)' : 'Jebkurā laikā'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Site contact */}
        <View style={s.amendField}>
          <Text style={s.amendLabel}>Kontaktpersona</Text>
          <TextInput
            style={s.amendInput}
            placeholder="Vārds Uzvārds"
            placeholderTextColor="#9ca3af"
            value={contact}
            onChangeText={setContact}
          />
        </View>
        <View style={s.amendField}>
          <Text style={s.amendLabel}>Kontaktpersonas tālrunis</Text>
          <TextInput
            style={s.amendInput}
            placeholder="+371 XXXXXXXX"
            placeholderTextColor="#9ca3af"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
        </View>

        {/* Notes */}
        <View style={s.amendField}>
          <Text style={s.amendLabel}>Piezīmes šoferim</Text>
          <TextInput
            style={[s.amendInput, { minHeight: 80, textAlignVertical: 'top' }]}
            placeholder="Piegādes instrukcijas, ieeja objektā..."
            placeholderTextColor="#9ca3af"
            multiline
            value={notes}
            onChangeText={setNotes}
          />
        </View>

        <TouchableOpacity
          style={[s.amendSubmitBtn, loading && { opacity: 0.5 }]}
          onPress={handleSubmit}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={s.amendSubmitBtnText}>Saglabāt izmaiņas</Text>
          )}
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );
}

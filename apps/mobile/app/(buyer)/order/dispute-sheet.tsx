import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { useToast } from '@/components/ui/Toast';
import { haptics } from '@/lib/haptics';
import { api } from '@/lib/api';
import type { ApiOrder } from '@/lib/api/orders';
import { s } from './order-detail-styles';

const DISPUTE_REASONS = [
  { key: 'SHORT_DELIVERY', label: 'Nepietiekams daudzums' },
  { key: 'WRONG_MATERIAL', label: 'Nepareizs materiāls' },
  { key: 'DAMAGE', label: 'Bojājumi piegādes laikā' },
  { key: 'QUALITY_ISSUE', label: 'Kvālitātes problēma' },
  { key: 'NO_DELIVERY', label: 'Nav saņemta piegāde' },
  { key: 'LATE_DELIVERY', label: 'Piegāde ievērojami kavējas' },
  { key: 'OTHER', label: 'Cits jautājums' },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  order: ApiOrder;
  token: string;
  /** Called after dispute is submitted successfully. */
  onFiled: () => void;
}

export function DisputeSheet({ visible, onClose, order, token, onFiled }: Props) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!reason) {
      haptics.warning();
      Alert.alert('Izvēlieties iemeslu', 'Lūdzu izvēlieties problēmas iemeslu.');
      return;
    }
    setLoading(true);
    haptics.light();
    try {
      const selectedReason = DISPUTE_REASONS.find((r) => r.key === reason);
      await api.reportDispute(order.id, reason, details || selectedReason?.label, token);
      haptics.success();
      setReason('');
      setDetails('');
      onFiled();
      onClose();
    } catch (err: unknown) {
      haptics.error();
      toast.error(err instanceof Error ? err.message : 'Neizdevās nosūtīt sūdzību');
    } finally {
      setLoading(false);
    }
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Ziņot par problēmu"
      subtitle="Aprakstiet problēmu ar pasūtījumu"
      scrollable
    >
      <View style={{ gap: 12, paddingBottom: 8 }}>
        {DISPUTE_REASONS.map((r) => (
          <TouchableOpacity
            key={r.key}
            style={[s.disputeReasonRow, reason === r.key && s.disputeReasonRowActive]}
            onPress={() => {
              haptics.light();
              setReason(r.key);
            }}
            activeOpacity={0.8}
          >
            <View style={[s.disputeRadio, reason === r.key && s.disputeRadioActive]}>
              {reason === r.key && <View style={s.disputeRadioDot} />}
            </View>
            <Text style={[s.disputeReasonText, reason === r.key && s.disputeReasonTextActive]}>
              {r.label}
            </Text>
          </TouchableOpacity>
        ))}

        <TextInput
          style={s.disputeDetailsInput}
          placeholder="Papildu informācija (neobligāts)..."
          placeholderTextColor="#9ca3af"
          multiline
          numberOfLines={3}
          value={details}
          onChangeText={setDetails}
        />

        <TouchableOpacity
          style={[s.disputeSubmitBtn, (!reason || loading) && { opacity: 0.5 }]}
          onPress={handleSubmit}
          disabled={!reason || loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={s.disputeSubmitBtnText}>Nosūtīt sūdzību</Text>
          )}
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );
}

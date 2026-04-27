import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { useToast } from '@/components/ui/Toast';
import { haptics } from '@/lib/haptics';
import { api } from '@/lib/api';
import type { ApiOrder } from '@/lib/api/orders';

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
            style={[styles.disputeReasonRow, reason === r.key && styles.disputeReasonRowActive]}
            onPress={() => {
              haptics.light();
              setReason(r.key);
            }}
            activeOpacity={0.8}
          >
            <View style={[styles.disputeRadio, reason === r.key && styles.disputeRadioActive]}>
              {reason === r.key && <View style={styles.disputeRadioDot} />}
            </View>
            <Text
              style={[styles.disputeReasonText, reason === r.key && styles.disputeReasonTextActive]}
            >
              {r.label}
            </Text>
          </TouchableOpacity>
        ))}

        <TextInput
          style={styles.disputeDetailsInput}
          placeholder="Papildu informācija (neobligāts)..."
          placeholderTextColor="#9ca3af"
          multiline
          numberOfLines={3}
          value={details}
          onChangeText={setDetails}
        />

        <TouchableOpacity
          style={[styles.disputeSubmitBtn, (!reason || loading) && { opacity: 0.5 }]}
          onPress={handleSubmit}
          disabled={!reason || loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.disputeSubmitBtnText}>Nosūtīt sūdzību</Text>
          )}
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  disputeReasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  disputeReasonRowActive: { borderColor: '#F9423A', backgroundColor: '#f3f4f6' },
  disputeRadio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disputeRadioActive: { borderColor: '#F9423A' },
  disputeRadioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#F9423A' },
  disputeReasonText: { flex: 1, fontSize: 15, color: '#4b5563' },
  disputeReasonTextActive: { color: '#111827', fontWeight: '600' },
  disputeDetailsInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#f9fafb',
    height: 100,
    textAlignVertical: 'top',
  },
  disputeSubmitBtn: {
    backgroundColor: '#F9423A',
    borderRadius: 999,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  disputeSubmitBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});

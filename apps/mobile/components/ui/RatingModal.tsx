import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Star, CheckCircle, X } from 'lucide-react-native';
import { api } from '@/lib/api';
import { t } from '@/lib/translations';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  token: string;
  /** Pass exactly ONE of these: */
  orderId?: string;
  skipOrderId?: string;
}

export function RatingModal({ visible, onClose, onSuccess, token, orderId, skipOrderId }: Props) {
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // Reset state whenever the modal opens for a new order
  useEffect(() => {
    if (visible) {
      setStars(0);
      setComment('');
      setLoading(false);
      setDone(false);
    }
  }, [visible, orderId, skipOrderId]);

  const handleSubmit = async () => {
    if (stars === 0) {
      Alert.alert(t.rating.errorTitle, 'Lūdzu, izvēlieties vismaz 1 zvaigzni.');
      return;
    }
    setLoading(true);
    try {
      await api.reviews.create(
        {
          rating: stars,
          comment: comment.trim() || undefined,
          orderId,
          skipOrderId,
        },
        token,
      );
      setDone(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1800);
    } catch (err: unknown) {
      Alert.alert(t.rating.errorTitle, err instanceof Error ? err.message : t.rating.errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={s.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={s.sheet}>
          {/* Handle */}
          <View style={s.handle} />

          {/* Close button */}
          <TouchableOpacity style={s.closeBtn} onPress={onClose} hitSlop={12}>
            <X size={20} color="#9ca3af" />
          </TouchableOpacity>

          {done ? (
            /* ── Success state ── */
            <View style={s.successWrap}>
              <CheckCircle size={52} color="#16a34a" />
              <Text style={s.successTitle}>{t.rating.successTitle}</Text>
              <Text style={s.successSub}>{t.rating.successMessage}</Text>
            </View>
          ) : (
            /* ── Input state ── */
            <>
              <Text style={s.title}>{t.rating.title}</Text>
              <Text style={s.subtitle}>{t.rating.subtitle}</Text>

              {/* Star row */}
              <View style={s.starsRow}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <TouchableOpacity key={n} onPress={() => setStars(n)} activeOpacity={0.7}>
                    <Star
                      size={38}
                      color={n <= stars ? '#f59e0b' : '#d1d5db'}
                      fill={n <= stars ? '#f59e0b' : 'none'}
                    />
                  </TouchableOpacity>
                ))}
              </View>

              {stars > 0 && <Text style={s.starLabel}>{t.rating.stars[stars - 1]}</Text>}

              {/* Comment */}
              <TextInput
                style={s.input}
                placeholder={t.rating.commentPlaceholder}
                placeholderTextColor="#9ca3af"
                value={comment}
                onChangeText={setComment}
                multiline
                numberOfLines={3}
                maxLength={500}
                textAlignVertical="top"
              />

              {/* Submit */}
              <TouchableOpacity
                style={[s.submitBtn, (loading || stars === 0) && { opacity: 0.5 }]}
                onPress={handleSubmit}
                disabled={loading || stars === 0}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={s.submitBtnText}>{t.rating.submit}</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 40,
    minHeight: 360,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e5e7eb',
    alignSelf: 'center',
    marginBottom: 16,
  },
  closeBtn: {
    position: 'absolute',
    top: 18,
    right: 20,
    zIndex: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 24,
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 12,
  },
  starLabel: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: '#f59e0b',
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: '#111827',
    height: 90,
    marginBottom: 20,
  },
  submitBtn: {
    backgroundColor: '#dc2626',
    borderRadius: 14,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  // Success
  successWrap: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  successSub: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
});

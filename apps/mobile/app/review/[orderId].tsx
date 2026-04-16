/**
 * Standalone review screen — /review/[orderId]
 * Buyer submits a star rating + comment for a completed order.
 * Accessible via deep link from push notifications.
 *
 * Query params:
 *   - orderId     : for regular material delivery orders
 *   - skipOrderId : for skip-hire orders (pass via useLocalSearchParams as param)
 *   - type        : 'order' | 'skip' (used to determine which id to send)
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { haptics } from '@/lib/haptics';
import { colors, spacing, radius, shadows, fontSizes } from '@/lib/theme';
import { Star, CheckCircle } from 'lucide-react-native';
import { SkeletonDetail } from '@/components/ui/Skeleton';

// ─── Star row ─────────────────────────────────────────────────────────────

function StarRow({ rating, onChange }: { rating: number; onChange: (n: number) => void }) {
  return (
    <View style={s.starRow}>
      {[1, 2, 3, 4, 5].map((n) => (
        <TouchableOpacity
          key={n}
          onPress={() => {
            haptics.light();
            onChange(n);
          }}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
        >
          <Star
            size={42}
            color={n <= rating ? '#F59E0B' : '#E5E7EB'}
            fill={n <= rating ? '#F59E0B' : 'transparent'}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const RATING_LABELS: Record<number, string> = {
  1: 'Ļoti slikts',
  2: 'Slikts',
  3: 'Apmierinošs',
  4: 'Labs',
  5: 'Lieliski',
};

// ─── Screen ───────────────────────────────────────────────────────────────

export default function ReviewScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{
    orderId?: string;
    skipOrderId?: string;
  }>();

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);
  const [checking, setChecking] = useState(true);

  const orderId = params.orderId;
  const skipOrderId = params.skipOrderId;

  // Check if already reviewed
  useEffect(() => {
    if (!token || (!orderId && !skipOrderId)) {
      setChecking(false);
      return;
    }
    api.reviews
      .status({ orderId, skipOrderId }, token)
      .then(({ reviewed }) => setAlreadyReviewed(reviewed))
      .catch(() => {})
      .finally(() => setChecking(false));
  }, [token, orderId, skipOrderId]);

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert('Vērtējums nepieciešams', 'Lūdzu, izvēlieties vismaz 1 zvaigzni.');
      return;
    }
    if (!token) return;
    setLoading(true);
    try {
      await api.reviews.create(
        {
          rating,
          comment: comment.trim() || undefined,
          orderId,
          skipOrderId,
        },
        token,
      );
      haptics.success();
      setDone(true);
      setTimeout(() => {
        router.canGoBack() ? router.back() : router.replace('/(buyer)/orders' as any);
      }, 2000);
    } catch (err: unknown) {
      Alert.alert(
        'Kļūda',
        err instanceof Error ? err.message : 'Neizdevās nosūtīt vērtējumu. Mēģiniet vēlreiz.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer standalone >
      <ScreenHeader title="Novērtējums" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {checking ? (
            <SkeletonDetail />
          ) : done ? (
            /* ── Success state ──────────────────────────────────── */
            <View style={s.successWrap}>
              <CheckCircle size={64} color={colors.primary} />
              <Text style={s.successTitle}>Paldies!</Text>
              <Text style={s.successSub}>Jūsu vērtējums veiksmīgi nosūtīts.</Text>
            </View>
          ) : alreadyReviewed ? (
            /* ── Already reviewed ───────────────────────────────── */
            <View style={s.successWrap}>
              <CheckCircle size={64} color={colors.primary} />
              <Text style={s.successTitle}>Jau novērtēts</Text>
              <Text style={s.successSub}>Šis pasūtījums ir jau novērtēts. Paldies!</Text>
            </View>
          ) : (
            /* ── Rating form ─────────────────────────────────────── */
            <View style={s.formCard}>
              <Text style={s.cardTitle}>Kā novērtējat pakalpojumu?</Text>
              <Text style={s.cardSubtitle}>
                Jūsu atsauksme palīdz uzlabot pakalpojumu kvalitāti
              </Text>

              <StarRow rating={rating} onChange={setRating} />

              {rating > 0 && <Text style={s.ratingLabel}>{RATING_LABELS[rating]}</Text>}

              <View style={s.inputWrap}>
                <TextInput
                  style={s.input}
                  placeholder="Komentārs (neobligāts)..."
                  placeholderTextColor={colors.textDisabled}
                  multiline
                  numberOfLines={4}
                  value={comment}
                  onChangeText={setComment}
                  maxLength={500}
                  textAlignVertical="top"
                />
                <Text style={s.charCount}>{comment.length}/500</Text>
              </View>

              <TouchableOpacity
                style={[s.submitBtn, (loading || rating === 0) && s.submitBtnDisabled]}
                onPress={handleSubmit}
                disabled={loading || rating === 0}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={s.submitBtnText}>Nosūtīt vērtējumu</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={s.skipBtn}
                onPress={() =>
                  router.canGoBack() ? router.back() : router.replace('/(buyer)/orders' as any)
                }
                activeOpacity={0.7}
              >
                <Text style={s.skipBtnText}>Vēlāk</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  scroll: { flex: 1 },
  content: {
    padding: spacing.base,
    flexGrow: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },

  successWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.base,
    paddingTop: 60,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  successSub: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },

  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.xl,
    padding: spacing.xl,
    ...shadows.card,
    gap: spacing.base,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  cardSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },

  starRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  ratingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F59E0B',
    textAlign: 'center',
  },

  inputWrap: {
    position: 'relative',
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: spacing.md,
    fontSize: 14,
    color: colors.textPrimary,
    minHeight: 100,
  },
  charCount: {
    position: 'absolute',
    bottom: spacing.xs,
    right: spacing.sm,
    fontSize: 11,
    color: colors.textDisabled,
  },

  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  submitBtnDisabled: {
    opacity: 0.45,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  skipBtn: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  skipBtnText: {
    fontSize: 14,
    color: colors.textMuted,
  },
});

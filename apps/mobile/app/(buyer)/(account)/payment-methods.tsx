/**
 * payment-methods.tsx — Buyer: manage saved payment methods
 *
 * Cards are saved automatically when a buyer completes a Paysera checkout
 * and consents to recurring use. This screen lists and manages those tokens.
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
} from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import type { SavedPaymentMethod } from '@/lib/api';
import { useFocusEffect } from 'expo-router';
import { CreditCard, Star, Trash2, Info } from 'lucide-react-native';
import { haptics } from '@/lib/haptics';
import { colors } from '@/lib/theme';

const CARD_TYPE_LABELS: Record<string, string> = {
  VISA: 'Visa',
  MASTERCARD: 'Mastercard',
  MAESTRO: 'Maestro',
  OTHER: 'Karte',
};

function CardRow({
  item,
  onDelete,
  onSetDefault,
  loading,
}: {
  item: SavedPaymentMethod;
  onDelete: (item: SavedPaymentMethod) => void;
  onSetDefault: (item: SavedPaymentMethod) => void;
  loading: boolean;
}) {
  const expiry = `${String(item.expiryMonth).padStart(2, '0')}/${String(item.expiryYear).slice(-2)}`;
  const typeLabel = CARD_TYPE_LABELS[item.cardType] ?? item.cardType;

  return (
    <View style={s.row}>
      <View style={[s.rowIcon, item.isDefault && s.rowIconDefault]}>
        <CreditCard size={20} color={item.isDefault ? '#1f8f53' : '#6b7280'} />
      </View>

      <View style={s.rowBody}>
        <View style={s.rowTitleRow}>
          <Text style={s.rowLabel} numberOfLines={1}>
            {typeLabel} •••• {item.last4}
          </Text>
          {item.isDefault && (
            <View style={s.defaultBadge}>
              <Star size={10} color="#fff" fill="#fff" />
              <Text style={s.defaultBadgeText}>NOKLUSĒJUMS</Text>
            </View>
          )}
        </View>
        <Text style={s.rowSub}>
          Derīga līdz {expiry}
        </Text>
      </View>

      <View style={s.rowActions}>
        {!item.isDefault && (
          <TouchableOpacity
            style={s.actionBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            disabled={loading}
            onPress={() => {
              haptics.light();
              onSetDefault(item);
            }}
          >
            <Star size={18} color="#9ca3af" strokeWidth={1.8} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={s.actionBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          disabled={loading}
          onPress={() => {
            haptics.light();
            onDelete(item);
          }}
        >
          <Trash2 size={18} color="#ef4444" strokeWidth={1.8} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function PaymentMethodsScreen() {
  const { token } = useAuth();
  const toast = useToast();
  const [methods, setMethods] = useState<SavedPaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const loadMethods = useCallback(
    (isRefresh = false) => {
      if (!token) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      api.paymentMethods
        .list(token)
        .then(setMethods)
        .catch(() => toast.error('Nevarēja ielādēt maksājumu metodes'))
        .finally(() => {
          setLoading(false);
          setRefreshing(false);
        });
    },
    [token],
  );

  useFocusEffect(useCallback(() => { loadMethods(); }, [loadMethods]));

  const handleSetDefault = (item: SavedPaymentMethod) => {
    if (!token) return;
    setActionLoading(true);
    api.paymentMethods
      .setDefault(item.id, token)
      .then(() => {
        setMethods((prev) =>
          prev.map((m) => ({ ...m, isDefault: m.id === item.id })),
        );
        haptics.success();
      })
      .catch(() => toast.error('Neizdevās iestatīt noklusēto karti'))
      .finally(() => setActionLoading(false));
  };

  const handleDelete = (item: SavedPaymentMethod) => {
    Alert.alert(
      'Noņemt karti',
      `Vai tiešām vēlaties noņemt ${item.label}?`,
      [
        { text: 'Atcelt', style: 'cancel' },
        {
          text: 'Noņemt',
          style: 'destructive',
          onPress: () => {
            if (!token) return;
            setActionLoading(true);
            api.paymentMethods
              .remove(item.id, token)
              .then(() => {
                setMethods((prev) => prev.filter((m) => m.id !== item.id));
                haptics.success();
                toast.success('Karte noņemta');
              })
              .catch(() => toast.error('Neizdevās noņemt karti'))
              .finally(() => setActionLoading(false));
          },
        },
      ],
    );
  };

  return (
    <ScreenContainer standalone>
      <ScreenHeader title="Maksājumu metodes" />

      {loading ? (
        <SkeletonCard count={2} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40, flexGrow: 1 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadMethods(true)}
              tintColor="#111827"
            />
          }
        >
          {/* Info banner */}
          <View style={s.infoBanner}>
            <Info size={16} color="#2563eb" strokeWidth={1.8} style={{ marginTop: 1 }} />
            <Text style={s.infoText}>
              Kartes tiek saglabātas automātiski pēc maksājuma, ja dodat piekrišanu atkārtotai
              izmantošanai Paysera norēķinu lapā.
            </Text>
          </View>

          {methods.length === 0 ? (
            <EmptyState
              icon={<CreditCard size={32} color="#9ca3af" />}
              title="Nav saglabātu karšu"
              subtitle="Veiciet maksājumu un atzīmējiet 'Saglabāt karti' Paysera lapā."
            />
          ) : (
            <View style={s.list}>
              {methods.map((m, i) => (
                <CardRow
                  key={m.id}
                  item={m}
                  onDelete={handleDelete}
                  onSetDefault={handleSetDefault}
                  loading={actionLoading}
                />
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#eff6ff',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#1e40af',
    lineHeight: 18,
  },
  list: {
    marginHorizontal: 16,
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconDefault: {
    backgroundColor: '#dcfce7',
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowLabel: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
    color: colors.textPrimary,
  },
  rowSub: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: colors.textMuted,
  },
  defaultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#166534',
    borderRadius: 100,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  defaultBadgeText: {
    fontSize: 9,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    color: '#fff',
    letterSpacing: 0.5,
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionBtn: {
    padding: 6,
  },
});

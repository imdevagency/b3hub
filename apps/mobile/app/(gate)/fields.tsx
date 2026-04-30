/**
 * fields.tsx — Gate operator field picker
 *
 * Route: /(gate)/fields
 *
 * Lists all active B3 Field locations. Tapping a field navigates to the
 * gate-scan screen with the selected fieldId. Only shown in APP_VARIANT=gate.
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { useAuth } from '@/lib/auth-context';
import { b3Fields, type ApiMobileB3Field } from '@/lib/api/b3-fields';
import { MapPin, ChevronRight, LogOut, RefreshCw } from 'lucide-react-native';
import { colors, spacing, radius, fontSizes } from '@/lib/theme';

export default function GateFieldsScreen() {
  const router = useRouter();
  const { logout, user } = useAuth();
  const [fields, setFields] = useState<ApiMobileB3Field[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await b3Fields.list();
      setFields(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Neizdevās ielādēt laukus');
    } finally {
      setLoading(false);
    }
  }, []);

  // Reload list every time this screen comes into focus (e.g. after returning from scan)
  useFocusEffect(
    React.useCallback(() => {
      load();
    }, [load]),
  );

  const handleLogout = () => {
    logout();
    router.replace('/(auth)/login');
  };

  return (
    <ScreenContainer standalone bg={colors.bgScreen}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.title}>B3 APP Gate</Text>
          {user?.email ? <Text style={s.subtitle}>{user.email}</Text> : null}
        </View>
        <TouchableOpacity style={s.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
          <LogOut size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      <Text style={s.sectionLabel}>Izvēlieties lauku</Text>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={s.center}>
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={load} activeOpacity={0.8}>
            <RefreshCw size={16} color={colors.white} />
            <Text style={s.retryText}>Mēģināt vēlreiz</Text>
          </TouchableOpacity>
        </View>
      ) : fields.length === 0 ? (
        <View style={s.center}>
          <Text style={s.emptyText}>Nav aktīvu lauku</Text>
        </View>
      ) : (
        <FlatList
          data={fields}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.list}
          ItemSeparatorComponent={() => <View style={s.separator} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={s.card}
              activeOpacity={0.75}
              onPress={() => router.push(`/(shared)/gate-scan?fieldId=${item.id}`)}
            >
              <View style={s.cardIcon}>
                <MapPin size={20} color={colors.primary} />
              </View>
              <View style={s.cardBody}>
                <Text style={s.cardName}>{item.name}</Text>
                <Text style={s.cardAddress} numberOfLines={1}>
                  {item.address}, {item.city}
                </Text>
              </View>
              <ChevronRight size={18} color={colors.textDisabled} />
            </TouchableOpacity>
          )}
        />
      )}
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.lg,
    paddingBottom: spacing.base,
  },
  title: {
    fontSize: fontSizes.xl,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: fontSizes.sm,
    fontFamily: 'Inter_400Regular',
    color: colors.textMuted,
    marginTop: 2,
  },
  logoutBtn: {
    padding: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.bgMuted,
  },
  sectionLabel: {
    fontSize: fontSizes.xs,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    color: colors.textDisabled,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginHorizontal: spacing.base,
    marginBottom: spacing.sm,
  },
  list: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.xl,
  },
  separator: {
    height: 8,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.base,
    gap: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.bgSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
    gap: 2,
  },
  cardName: {
    fontSize: fontSizes.base,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    color: colors.textPrimary,
  },
  cardAddress: {
    fontSize: fontSizes.sm,
    fontFamily: 'Inter_400Regular',
    color: colors.textMuted,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.base,
    paddingHorizontal: spacing.xl,
  },
  errorText: {
    fontSize: fontSizes.base,
    fontFamily: 'Inter_400Regular',
    color: colors.danger,
    textAlign: 'center',
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
  },
  retryText: {
    fontSize: fontSizes.sm,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    color: colors.white,
  },
  emptyText: {
    fontSize: fontSizes.base,
    fontFamily: 'Inter_400Regular',
    color: colors.textMuted,
    textAlign: 'center',
  },
});

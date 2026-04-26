/**
 * GuestWall — drop-in component for screens that require authentication.
 *
 * Shows a centred sign-in prompt when the user is not logged in.
 * Use as an early return inside any screen that needs auth:
 *
 *   const { user, isLoading } = useAuth();
 *   if (!isLoading && !user) return <GuestWall />;
 *
 * Props:
 *   icon     — Lucide icon element (defaults to lock icon)
 *   title    — headline text
 *   subtitle — optional description
 */

import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Lock } from 'lucide-react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/text';
import { colors, spacing, radius } from '@/lib/theme';

interface GuestWallProps {
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  /** ScreenHeader title — defaults to 'Pieteikšanās' */
  headerTitle?: string;
}

export function GuestWall({
  title = 'Pierakstieties, lai turpinātu',
  subtitle = 'Šis sadaļa ir pieejama tikai reģistrētiem lietotājiem.',
  icon,
  headerTitle = 'Pieteikšanās',
}: GuestWallProps) {
  const router = useRouter();

  return (
    <ScreenContainer noAnimation>
      <ScreenHeader title={headerTitle} />
      <View style={s.body}>
        <View style={s.iconWrap}>{icon ?? <Lock size={40} color={colors.textMuted} />}</View>
        <Text style={s.title}>{title}</Text>
        <Text style={s.subtitle}>{subtitle}</Text>
        <TouchableOpacity
          style={s.primaryBtn}
          onPress={() => router.push('/(auth)/login')}
          activeOpacity={0.85}
        >
          <Text style={s.primaryBtnText}>Ieiet kontā</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/(auth)/register')} activeOpacity={0.7}>
          <Text style={s.registerLink}>Nav konta? Reģistrēties</Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: spacing.xl,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    width: '100%',
    alignItems: 'center',
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  registerLink: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
});

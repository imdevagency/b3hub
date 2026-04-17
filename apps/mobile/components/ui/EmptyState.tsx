/**
 * EmptyState — Reusable centered empty-list / zero-data placeholder.
 *
 * Usage:
 *   <EmptyState
 *     icon={<FileText size={32} color="#9ca3af" />}
 *     title="Nav rēķinu"
 *     subtitle="Rēķini parādīsies, kad pasūtījumi tiks apstiprināti."
 *     action={<TouchableOpacity ...><Text>Pievienot</Text></TouchableOpacity>}
 *   />
 *
 * Designed to be used:
 *  - As a full-screen replacement (full flex:1 parent)
 *  - As ListEmptyComponent in FlatList (parent needs contentContainerStyle={{ flexGrow: 1 }})
 *  - Inside a ScrollView as the only child when empty
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/lib/theme';

interface EmptyStateProps {
  /** Icon element — e.g. <FileText size={32} color="#9ca3af" /> */
  icon?: React.ReactNode;
  /** Short headline — e.g. "Nav rēķinu" */
  title: string;
  /** Optional description below the title */
  subtitle?: string;
  /** Optional action button / link rendered below the subtitle */
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, subtitle, action }: EmptyStateProps) {
  return (
    <View style={styles.wrap}>
      {icon && <View style={styles.iconWrap}>{icon}</View>}
      <Text style={styles.title} numberOfLines={3}>
        {title}
      </Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {action ?? null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingVertical: 24,
    gap: 8,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.bgMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: colors.textDisabled,
    textAlign: 'center',
    lineHeight: 21,
  },
});

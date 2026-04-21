/**
 * InfoSection — White card with an icon + title header bar and a children slot.
 *
 * Replaces the repeated section / sectionHeader / sectionTitle + children pattern
 * that appears in every detail screen (order, active job, incoming orders, etc.).
 *
 * Usage:
 *   <InfoSection icon={<MapPin size={14} color="#6b7280" />} title="Piegādes dati">
 *     <DetailRow label="Adrese" value="Brīvības iela 1" />
 *     <DetailRow label="Pilsēta" value="Rīga" last />
 *   </InfoSection>
 *
 *   // With an optional right element in the header:
 *   <InfoSection
 *     icon={<Camera size={14} color="#6b7280" />}
 *     title="Svēršanas biļete"
 *     right={<Text style={{ fontSize: 12, color: colors.textSecondary }}>⚖️ 12 000 kg</Text>}
 *   >
 *     <Image ... />
 *   </InfoSection>
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/lib/theme';

interface InfoSectionProps {
  /** Icon element — e.g. <MapPin size={14} color="#6b7280" /> */
  icon?: React.ReactNode;
  /** Section title — displayed uppercase next to the icon. */
  title: string;
  /** Optional element aligned to the right edge of the header. */
  right?: React.ReactNode;
  children?: React.ReactNode;
}

export function InfoSection({ icon, title, right, children }: InfoSectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        {icon ? <View>{icon}</View> : null}
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 12,
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    fontFamily: 'Inter_800ExtraBold',
    color: '#111827',
  },
  right: { marginLeft: 'auto' as any },
});

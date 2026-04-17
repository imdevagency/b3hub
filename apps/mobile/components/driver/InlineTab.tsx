import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { colors } from '@/lib/theme';

export interface InlineTabProps {
  label: string;
  active: boolean;
  onPress: () => void;
  badge?: number;
}

export function InlineTab({ label, active, onPress, badge }: InlineTabProps) {
  return (
    <TouchableOpacity onPress={onPress} style={[s.btn, active && s.btnActive]} activeOpacity={0.75}>
      <Text style={[s.text, active && s.textActive]}>{label}</Text>
      {!!badge && (
        <View style={s.badge}>
          <Text style={s.badgeText}>{badge}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  btn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: colors.bgMuted,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  btnActive: { backgroundColor: '#1d4ed8' },
  text: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  textActive: { color: '#fff' },
  badge: {
    backgroundColor: colors.danger,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
});

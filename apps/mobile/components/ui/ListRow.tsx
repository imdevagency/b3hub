import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { haptics } from '@/lib/haptics';
import { colors } from '@/lib/theme';
import type { TileItem } from './TileGrid';

export function ListRow({
  icon: Icon,
  label,
  onPress,
  isDestructive = false,
  last = false,
}: {
  icon: TileItem['icon'];
  label: string;
  onPress: () => void;
  isDestructive?: boolean;
  last?: boolean;
}) {
  return (
    <>
      <TouchableOpacity
        style={s.listRow}
        activeOpacity={0.7}
        onPress={() => {
          haptics.light();
          onPress();
        }}
      >
        <Icon size={20} color={isDestructive ? '#dc2626' : colors.textMuted} strokeWidth={1.8} />
        <Text style={[s.listLabel, isDestructive && s.listLabelDestructive]}>{label}</Text>
        <ChevronRight size={16} color={colors.border} />
      </TouchableOpacity>
      {!last && <View style={s.listDivider} />}
    </>
  );
}

const s = StyleSheet.create({
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  listLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: colors.textPrimary,
  },
  listLabelDestructive: {
    color: '#dc2626',
  },
  listDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: 48,
  },
});

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { haptics } from '@/lib/haptics';
import { colors } from '@/lib/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const COLS = 3;
export const H_PAD = 16;
export const GAP = 10;
export const TILE_W = (SCREEN_WIDTH - H_PAD * 2 - GAP * (COLS - 1)) / COLS;

export type TileItem = {
  icon: React.ComponentType<{ size: number; color: string; strokeWidth: number }>;
  label: string;
  badge?: number;
  onPress: () => void;
};

export function TileGrid({ tiles }: { tiles: TileItem[] }) {
  return (
    <View style={s.grid}>
      {tiles.map((tile, i) => (
        <TouchableOpacity
          key={i}
          style={s.tile}
          activeOpacity={0.72}
          onPress={() => {
            haptics.light();
            tile.onPress();
          }}
        >
          {tile.badge != null && tile.badge > 0 && (
            <View style={s.tileBadge}>
              <Text style={s.tileBadgeText}>{tile.badge > 99 ? '99+' : tile.badge}</Text>
            </View>
          )}
          <tile.icon size={26} color={colors.textSecondary} strokeWidth={1.6} />
          <Text style={s.tileLabel} numberOfLines={2}>
            {tile.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: H_PAD,
    gap: GAP,
    marginBottom: 8,
  },
  tile: {
    width: TILE_W,
    minHeight: 90,
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 6,
    gap: 8,
  },
  tileLabel: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
  },
  tileBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tileBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
  },
});

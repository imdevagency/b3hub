import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import {
  Layers,
  Leaf,
  Mountain,
  Recycle,
  Waves,
  Zap,
  MoreHorizontal,
  Box,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { haptics } from '@/lib/haptics';
import type { MaterialCategory } from '@/lib/api';
import { CATEGORY_LABELS, MATERIAL_CATEGORIES } from '@/lib/materials';

// ── Category metadata ──────────────────────────────────────────────────────

type CatMeta = { bg: string; accent: string; icon: React.ElementType };

const CATEGORY_META: Record<MaterialCategory, CatMeta> = {
  SAND: { bg: '#fef3c7', accent: '#d97706', icon: Waves },
  GRAVEL: { bg: '#e2e8f0', accent: '#475569', icon: Mountain },
  STONE: { bg: '#dde1e8', accent: '#334155', icon: Mountain },
  CONCRETE: { bg: '#f0f0f0', accent: '#6b7280', icon: Box },
  SOIL: { bg: '#fefce8', accent: '#92400e', icon: Layers },
  RECYCLED_CONCRETE: { bg: '#dcfce7', accent: '#16a34a', icon: Recycle },
  RECYCLED_SOIL: { bg: '#d1fae5', accent: '#059669', icon: Recycle },
  ASPHALT: { bg: '#e5e5e5', accent: '#44403c', icon: Zap },
  CLAY: { bg: '#ffedd5', accent: '#c2410c', icon: Layers },
  OTHER: { bg: '#f3f4f6', accent: '#6b7280', icon: MoreHorizontal },
};

const { width } = Dimensions.get('window');
// Screen width minus padding (16*2=32) minus gap (16) divided by 2 items per row
const cardWidth = (width - 48) / 2;

// ── Category Card ──────────────────────────────────────────────────────────

function CategoryCard({ category, onPress }: { category: MaterialCategory; onPress: () => void }) {
  const meta = CATEGORY_META[category];
  const Icon = meta.icon;
  const isRecycled = category.startsWith('RECYCLED');

  return (
    <TouchableOpacity
      style={s.card}
      onPress={() => {
        haptics.light();
        onPress();
      }}
      activeOpacity={0.7}
    >
      {/* Icon square */}
      <View style={[s.iconWrap, { backgroundColor: meta.bg }]}>
        <Icon size={24} color={meta.accent} strokeWidth={1.8} />
      </View>

      {/* Recycled indicator - Green leaf top right */}
      {isRecycled && (
        <View style={s.recycleBadge}>
          <Leaf size={14} color="#16a34a" fill="#16a34a" />
        </View>
      )}

      {/* Text */}
      <View style={s.cardText}>
        <Text style={s.cardName} numberOfLines={2}>
          {CATEGORY_LABELS[category]}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────

export default function CatalogScreen() {
  const router = useRouter();

  const handleCategory = (category: MaterialCategory) => {
    router.push({
      pathname: '/order-request-new',
      params: { initialCategory: category },
    });
  };

  return (
    <ScreenContainer standalone bg="#ffffff">
      {/* Header */}
      <ScreenHeader title="Materiāli" style={{ backgroundColor: '#ffffff' }} />

      {/* Category grid */}
      <ScrollView contentContainerStyle={s.grid} showsVerticalScrollIndicator={false}>
        {MATERIAL_CATEGORIES.map((cat) => (
          <CategoryCard key={cat} category={cat} onPress={() => handleCategory(cat)} />
        ))}
      </ScrollView>
    </ScreenContainer>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  grid: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },

  card: {
    width: cardWidth,
    aspectRatio: 1, // Make them perfect squares
    backgroundColor: '#ffffff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F9FAFB',
    padding: 16,
    position: 'relative',
    justifyContent: 'space-between',
  },

  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },

  recycleBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },

  cardText: {
    marginTop: 8,
  },
  cardName: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: '#111827',
    letterSpacing: -0.3,
  },
});

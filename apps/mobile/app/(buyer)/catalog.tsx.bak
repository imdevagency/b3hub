import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
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
import type { MaterialCategory } from '@/lib/api';
import { CATEGORY_LABELS, CATEGORY_DESCRIPTIONS, MATERIAL_CATEGORIES } from '@/lib/materials';

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

// ── Category Card ──────────────────────────────────────────────────────────

function CategoryCard({ category, onPress }: { category: MaterialCategory; onPress: () => void }) {
  const meta = CATEGORY_META[category];
  const Icon = meta.icon;
  const isRecycled = category.startsWith('RECYCLED');

  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.82}>
      {/* Icon square */}
      <View style={[s.iconWrap, { backgroundColor: meta.bg }]}>
        <Icon size={28} color={meta.accent} strokeWidth={1.5} />
      </View>

      {/* Recycled badge */}
      {isRecycled && (
        <View style={s.recycleBadge}>
          <Leaf size={10} color="#16a34a" strokeWidth={2.5} />
          <Text style={s.recycleBadgeText}>{'RECIKL.'}</Text>
        </View>
      )}

      {/* Text */}
      <View style={s.cardText}>
        <Text style={s.cardName}>{CATEGORY_LABELS[category]}</Text>
        <Text style={s.cardDesc} numberOfLines={2}>
          {CATEGORY_DESCRIPTIONS[category]}
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
    <ScreenContainer bg="#f9fafb">
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerEyebrow}>{'Materiālu katalogs'}</Text>
        <Text style={s.headerTitle}>{'Izvēlieties kategoriju'}</Text>
        <Text style={s.headerSub}>{'Atlasiet materiālu veidu, lai saņemtu cenas'}</Text>
      </View>

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
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  headerEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9ca3af',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  headerSub: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '400',
    lineHeight: 20,
  },

  grid: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },

  card: {
    width: '47.5%',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 18,
    position: 'relative',
    minHeight: 160,
  },

  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },

  recycleBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(22,163,74,0.1)',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 20,
  },
  recycleBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#15803d',
    letterSpacing: 0.4,
  },

  cardText: {
    marginTop: 'auto',
    gap: 4,
  },
  cardName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.2,
  },
  cardDesc: {
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 17,
    fontWeight: '400',
  },
});

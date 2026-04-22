/**
 * (buyer)/projects.tsx
 *
 * Buyer: list of construction projects.
 * Each project aggregates multiple orders and tracks P&L vs. contract value.
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Text as RNText,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { useScreenLoad } from '@/lib/use-screen-load';
import { api, type ApiProject, type ProjectStatus } from '@/lib/api';
import { Building2, Plus } from 'lucide-react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { StatusPill } from '@/components/ui/StatusPill';
import { colors } from '@/lib/tokens';
import { haptics } from '@/lib/haptics';

// ─── Status config ────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ProjectStatus, { label: string; bg: string; color: string }> = {
  PLANNING: { label: 'Plānošana', bg: '#f3f4f6', color: colors.textMuted },
  ACTIVE: { label: 'Aktīvs', bg: '#dcfce7', color: colors.successText },
  COMPLETED: { label: 'Pabeigts', bg: '#f0f9ff', color: '#0369a1' },
  ON_HOLD: { label: 'Apturēts', bg: '#fef2f2', color: colors.dangerText },
};

// ─── Components ───────────────────────────────────────────────────────────

function ProjectCard({ project, onPress }: { project: ApiProject; onPress: () => void }) {
  const formatEur = (v: number) =>
    new Intl.NumberFormat('lv-LV', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(v);

  const statusConf = STATUS_CONFIG[project.status] || {
    label: project.status,
    bg: '#F3F4F6',
    color: '#6B7280',
  };

  return (
    <TouchableOpacity
      className="bg-card mx-4 mb-4 p-5 rounded-2xl"
      style={styles.cardShadow}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View className="flex-row justify-between items-start mb-5">
        <View className="flex-1 pr-4">
          <RNText style={styles.cardTitle} numberOfLines={1}>
            {project.name}
          </RNText>
          {(project.clientName || project.siteAddress) && (
            <RNText style={styles.cardSubtitle} numberOfLines={1}>
              {[project.clientName, project.siteAddress].filter(Boolean).join(' • ')}
            </RNText>
          )}
        </View>
        <StatusPill
          label={statusConf.label}
          bg={statusConf.bg}
          color={statusConf.color}
          size="sm"
        />
      </View>

      <View className="flex-row items-center justify-between">
        <View>
          <RNText style={styles.statLabel}>Līgums</RNText>
          <RNText style={styles.statValue}>{formatEur(project.contractValue)}</RNText>
        </View>
        <View>
          <RNText style={styles.statLabel}>Izmaksas</RNText>
          <RNText style={styles.statValue}>{formatEur(project.materialCosts)}</RNText>
        </View>
        <View className="items-end">
          <RNText style={styles.statLabel}>Peļņa</RNText>
          <RNText style={project.grossMargin >= 0 ? styles.statValueProfit : styles.statValueLoss}>
            {project.marginPct !== null ? `${Math.round(project.marginPct)}%` : '—'}
          </RNText>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────

export default function ProjectsScreen() {
  const { token } = useAuth();
  const router = useRouter();

  const [projects, setProjects] = useState<ApiProject[]>([]);

  const fetcher = useCallback(async () => {
    if (!token) return;
    const data = await api.projects.getAll(token);
    setProjects(data);
  }, [token]);

  const { loading, refreshing, onRefresh } = useScreenLoad(fetcher);

  if (loading) {
    return (
      <ScreenContainer bg="#F4F5F7">
        <ScreenHeader title="Projekti" />
        <SkeletonCard count={4} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer bg="#F4F5F7">
      <ScreenHeader
        title="Projekti"
        rightAction={
          <TouchableOpacity
            onPress={() => {
              haptics.light();
              router.push('/(buyer)/project/new');
            }}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            activeOpacity={0.7}
          >
            <Plus size={22} color="#ffffff" />
          </TouchableOpacity>
        }
      />

      <FlatList
        data={projects}
        keyExtractor={(p) => p.id}
        removeClippedSubviews={true}
        initialNumToRender={10}
        renderItem={({ item }) => (
          <ProjectCard
            project={item}
            onPress={() => {
              haptics.light();
              router.push(`/(buyer)/project/${item.id}`);
            }}
          />
        )}
        contentContainerStyle={projects.length === 0 ? styles.emptyContainer : styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#111827" />
        }
        ListEmptyComponent={
          <EmptyState
            icon={<Building2 size={40} color={colors.textMuted} />}
            title="Nav projektu"
            subtitle="Jūsu projekti parādīsies šeit"
            action={
              <TouchableOpacity
                onPress={() => router.push('/(buyer)/project/new')}
                activeOpacity={0.8}
              >
                <RNText style={styles.emptyActionText}>Jauns projekts</RNText>
              </TouchableOpacity>
            }
          />
        }
      />
    </ScreenContainer>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  emptyContainer: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  list: { paddingBottom: 100, paddingTop: 16 },
  emptyActionText: {
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
    fontSize: 15,
    backgroundColor: '#111827',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
    textAlign: 'center',
    marginTop: 24,
    overflow: 'hidden',
  },
  cardShadow: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  cardSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
    color: '#6B7280',
  },
  statLabel: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.3,
  },
  statValueProfit: {
    fontSize: 16,
    fontFamily: 'Inter_800ExtraBold',
    fontWeight: '800',
    color: '#059669',
    letterSpacing: -0.3,
  },
  statValueLoss: {
    fontSize: 16,
    fontFamily: 'Inter_800ExtraBold',
    fontWeight: '800',
    color: '#EF4444',
    letterSpacing: -0.3,
  },
});

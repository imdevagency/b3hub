/**
 * (buyer)/projects.tsx
 *
 * Buyer: list of construction projects.
 * Each project aggregates multiple orders and tracks P&L vs. contract value.
 */

import React, { useCallback, useState } from 'react';
import { View, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { api, type ApiProject, type ProjectStatus } from '@/lib/api';
import { formatDateShort } from '@/lib/format';
import { Building2, Package, MapPin, Calendar, Plus } from 'lucide-react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { StatusPill } from '@/components/ui/StatusPill';
import { Text } from '@/components/ui/text';
import { colors, spacing, radius, fontSizes } from '@/lib/tokens';
import { haptics } from '@/lib/haptics';

// ─── Status config ────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ProjectStatus, { label: string; bg: string; color: string }> = {
  PLANNING: { label: 'Plānošana', bg: '#f3f4f6', color: '#6b7280' },
  ACTIVE: { label: 'Aktīvs', bg: '#dcfce7', color: '#15803d' },
  COMPLETED: { label: 'Pabeigts', bg: '#f0f9ff', color: '#0369a1' },
  ON_HOLD: { label: 'Apturēts', bg: '#fef2f2', color: '#b91c1c' },
};

// ─── Components ───────────────────────────────────────────────────────────

function ProjectCard({ project, onPress }: { project: ApiProject; onPress: () => void }) {
  const formatEur = (v: number) =>
    new Intl.NumberFormat('lv-LV', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(v);

  return (
    <TouchableOpacity
      className="bg-white px-5 py-6 border-b border-gray-100"
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View className="flex-row justify-between items-start mb-1">
        <View className="flex-1 pr-4">
          <Text
            className="text-[22px] font-extrabold tracking-tight text-gray-900 mb-1"
            numberOfLines={1}
          >
            {project.name}
          </Text>
          {(project.clientName || project.siteAddress) && (
            <Text className="text-[15px] font-medium text-gray-500 mb-6" numberOfLines={1}>
              {[project.clientName, project.siteAddress].filter(Boolean).join(' • ')}
            </Text>
          )}
        </View>
        <View className="bg-gray-50 px-2.5 py-1.5 rounded-lg border border-gray-100 mt-1">
          <Text className="text-[11px] font-bold text-gray-600 uppercase tracking-widest">
            {STATUS_CONFIG[project.status]?.label ?? project.status}
          </Text>
        </View>
      </View>

      <View className="flex-row items-center justify-between">
        <View>
          <Text className="text-[12px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
            Līgums
          </Text>
          <Text className="text-[18px] font-bold text-gray-900 tracking-tight">
            {formatEur(project.contractValue)}
          </Text>
        </View>
        <View>
          <Text className="text-[12px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
            Izmaksas
          </Text>
          <Text className="text-[18px] font-bold text-gray-900 tracking-tight">
            {formatEur(project.materialCosts)}
          </Text>
        </View>
        <View className="items-end">
          <Text className="text-[12px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
            Peļņa
          </Text>
          <Text
            className={`text-[18px] font-black tracking-tight ${project.grossMargin >= 0 ? 'text-green-600' : 'text-red-500'}`}
          >
            {project.marginPct !== null ? `${Math.round(project.marginPct)}%` : '—'}
          </Text>
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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (silent = false) => {
      if (!token) return;
      if (!silent) setLoading(true);
      try {
        const data = await api.projects.getAll(token);
        setProjects(data);
      } catch {
        // silently ignore — list stays empty
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token],
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleRefresh = () => {
    setRefreshing(true);
    load(true);
  };

  if (loading) {
    return (
      <ScreenContainer bg="#ffffff">
        <ScreenHeader title="Projekti" />
        <SkeletonCard count={4} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer bg="#ffffff">
      <ScreenHeader
        title="Projekti"
        rightAction={
          <TouchableOpacity
            onPress={() => {
              haptics.light();
              router.push('/(buyer)/project/new' as any);
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
        renderItem={({ item }) => (
          <ProjectCard
            project={item}
            onPress={() => {
              haptics.light();
              router.push(`/(buyer)/project/${item.id}` as any);
            }}
          />
        )}
        contentContainerStyle={projects.length === 0 ? styles.emptyContainer : styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#111827" />
        }
        ListEmptyComponent={
          <EmptyState
            icon={<Building2 size={40} color={colors.textMuted} />}
            title="Nav projektu"
            subtitle="Jūsu projekti parādīsies šeit"
            action={
              <TouchableOpacity
                onPress={() => router.push('/(buyer)/project/new' as any)}
                activeOpacity={0.8}
              >
                <Text className="text-white font-bold text-base bg-gray-900 px-6 py-3 rounded-full overflow-hidden text-center mt-6">
                  Jauns projekts
                </Text>
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
  list: { paddingBottom: 100 },
});

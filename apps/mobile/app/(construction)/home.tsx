import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { getConstructionProjects, getConstructionDailyReports } from '@/lib/api';
import type { ConstructionProject, DailyReport } from '@/lib/api';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useHeaderConfig } from '@/lib/header-context';
import { haptics } from '@/lib/haptics';
import { colors } from '@/lib/theme';
import {
  FolderKanban,
  FileText,
  Plus,
  ChevronRight,
  ExternalLink,
  HardHat,
  TrendingUp,
} from 'lucide-react-native';

const PROJECT_STATUS_LABEL: Record<string, string> = {
  PLANNING: 'Plānošana',
  ACTIVE: 'Aktīvs',
  ON_HOLD: 'Pauze',
  COMPLETED: 'Pabeigts',
  CANCELLED: 'Atcelts',
};

const PROJECT_STATUS_COLOR: Record<string, string> = {
  PLANNING: '#6366f1',
  ACTIVE: '#16a34a',
  ON_HOLD: '#d97706',
  COMPLETED: '#64748b',
  CANCELLED: '#ef4444',
};

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <View style={ls.statCard}>
      <View style={ls.statIcon}>{icon}</View>
      <Text style={ls.statValue}>{value}</Text>
      <Text style={ls.statLabel}>{label}</Text>
    </View>
  );
}

export default function ConstructionHomeScreen() {
  const { token, user } = useAuth();
  const router = useRouter();
  const { setConfig } = useHeaderConfig();
  const [projects, setProjects] = useState<ConstructionProject[]>([]);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [p, r] = await Promise.all([
        getConstructionProjects(token, { status: 'ACTIVE', limit: 5 }),
        getConstructionDailyReports(token, { limit: 5 }),
      ]);
      setProjects(p.data);
      setReports(r.data);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      setConfig({ title: 'Celtniecība' });
      load();
      return () => setConfig(null);
    }, [load, setConfig]),
  );

  const activeProjects = projects.filter((p) => p.status === 'ACTIVE').length;
  const todayReports = reports.filter((r) => {
    const d = new Date(r.reportDate);
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  }).length;

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={ls.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Greeting */}
        <View style={ls.header}>
          <View style={ls.headerIcon}>
            <HardHat size={24} color="#fff" strokeWidth={2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={ls.greeting}>Sveiki, {user?.firstName}!</Text>
            <Text style={ls.subGreeting}>{user?.company?.name ?? 'Celtniecības portāls'}</Text>
          </View>
        </View>

        {/* Stats */}
        {loading ? (
          <SkeletonCard style={{ height: 80, marginBottom: 16 }} />
        ) : (
          <View style={ls.statsRow}>
            <StatCard
              label="Aktīvie projekti"
              value={activeProjects}
              icon={<FolderKanban size={18} color={colors.primary} strokeWidth={2} />}
            />
            <StatCard
              label="Atskaites šodien"
              value={todayReports}
              icon={<FileText size={18} color={colors.primary} strokeWidth={2} />}
            />
          </View>
        )}

        {/* Quick actions */}
        <View style={ls.section}>
          <Text style={ls.sectionTitle}>Ātrās darbības</Text>
          <View style={ls.actionsRow}>
            <TouchableOpacity
              style={ls.actionBtn}
              activeOpacity={0.8}
              onPress={() => {
                haptics.light();
                router.push('/(construction)/daily-report-new');
              }}
            >
              <View style={[ls.actionIcon, { backgroundColor: '#eff6ff' }]}>
                <Plus size={20} color="#2563eb" strokeWidth={2.5} />
              </View>
              <Text style={ls.actionLabel}>Jauna atskaite</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={ls.actionBtn}
              activeOpacity={0.8}
              onPress={() => {
                haptics.light();
                router.push('/(construction)/projects');
              }}
            >
              <View style={[ls.actionIcon, { backgroundColor: '#f0fdf4' }]}>
                <FolderKanban size={20} color="#16a34a" strokeWidth={2} />
              </View>
              <Text style={ls.actionLabel}>Projekti</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={ls.actionBtn}
              activeOpacity={0.8}
              onPress={() => {
                haptics.light();
                Linking.openURL('https://b3hub.lv/dashboard/construction').catch(() => null);
              }}
            >
              <View style={[ls.actionIcon, { backgroundColor: '#faf5ff' }]}>
                <TrendingUp size={20} color="#7c3aed" strokeWidth={2} />
              </View>
              <Text style={ls.actionLabel}>Rentabilitāte</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Active projects */}
        <View style={ls.section}>
          <View style={ls.sectionHeader}>
            <Text style={ls.sectionTitle}>Aktīvie projekti</Text>
            <TouchableOpacity onPress={() => router.push('/(construction)/projects')}>
              <Text style={ls.seeAll}>Visi</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            [1, 2].map((k) => <SkeletonCard key={k} style={{ height: 64, marginBottom: 8 }} />)
          ) : projects.length === 0 ? (
            <View style={ls.emptyBox}>
              <Text style={ls.emptyText}>Nav aktīvu projektu</Text>
            </View>
          ) : (
            projects.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={ls.projectRow}
                activeOpacity={0.8}
                onPress={() => {
                  haptics.light();
                  Linking.openURL(`https://b3hub.lv/dashboard/construction/projects/${p.id}`).catch(
                    () => null,
                  );
                }}
              >
                <View style={ls.projectInfo}>
                  <Text style={ls.projectName} numberOfLines={1}>
                    {p.name}
                  </Text>
                  {p.clientName ? (
                    <Text style={ls.projectClient} numberOfLines={1}>
                      {p.clientName}
                    </Text>
                  ) : null}
                </View>
                <View style={ls.projectRight}>
                  <View
                    style={[
                      ls.statusDot,
                      { backgroundColor: PROJECT_STATUS_COLOR[p.status] ?? '#64748b' },
                    ]}
                  />
                  <Text
                    style={[ls.statusLabel, { color: PROJECT_STATUS_COLOR[p.status] ?? '#64748b' }]}
                  >
                    {PROJECT_STATUS_LABEL[p.status] ?? p.status}
                  </Text>
                  <ChevronRight size={14} color="#9ca3af" strokeWidth={2} />
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Recent daily reports */}
        <View style={ls.section}>
          <View style={ls.sectionHeader}>
            <Text style={ls.sectionTitle}>Pēdējās atskaites</Text>
            <TouchableOpacity onPress={() => router.push('/(construction)/daily-reports')}>
              <Text style={ls.seeAll}>Visas</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            [1, 2].map((k) => <SkeletonCard key={k} style={{ height: 56, marginBottom: 8 }} />)
          ) : reports.length === 0 ? (
            <View style={ls.emptyBox}>
              <Text style={ls.emptyText}>Nav atskaišu</Text>
            </View>
          ) : (
            reports.map((r) => (
              <View key={r.id} style={ls.reportRow}>
                <View style={ls.reportInfo}>
                  <Text style={ls.reportDate}>
                    {new Date(r.reportDate).toLocaleDateString('lv-LV', {
                      day: '2-digit',
                      month: 'short',
                    })}
                  </Text>
                  <Text style={ls.reportProject} numberOfLines={1}>
                    {r.project?.name ?? '—'}
                  </Text>
                </View>
                <View style={ls.reportRight}>
                  <Text style={ls.reportCost}>€{r.totalCost.toFixed(2)}</Text>
                  <Text style={[ls.reportStatus, r.status === 'APPROVED' && ls.statusApproved]}>
                    {r.status === 'DRAFT'
                      ? 'Melnraksts'
                      : r.status === 'SUBMITTED'
                        ? 'Iesniegts'
                        : r.status === 'APPROVED'
                          ? 'Apstiprināts'
                          : 'Noraidīts'}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Web portal link */}
        <TouchableOpacity
          style={ls.webLink}
          activeOpacity={0.8}
          onPress={() => {
            haptics.light();
            Linking.openURL('https://b3hub.lv/dashboard/construction').catch(() => null);
          }}
        >
          <ExternalLink size={16} color="#2563eb" strokeWidth={2} />
          <Text style={ls.webLinkText}>Atvērt pilno ERP portālu</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}

const ls = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 32 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1e40af',
    alignItems: 'center',
    justifyContent: 'center',
  },
  greeting: { fontSize: 18, fontWeight: '700', color: '#111827' },
  subGreeting: { fontSize: 13, color: '#6b7280', marginTop: 1 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  statCard: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statIcon: {},
  statValue: { fontSize: 22, fontWeight: '700', color: '#111827' },
  statLabel: { fontSize: 11, color: '#6b7280', textAlign: 'center' },
  section: { marginBottom: 20 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: '#111827' },
  seeAll: { fontSize: 13, color: '#2563eb', fontWeight: '500' },
  actionsRow: { flexDirection: 'row', gap: 10 },
  actionBtn: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: { fontSize: 11, fontWeight: '600', color: '#374151', textAlign: 'center' },
  projectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  projectInfo: { flex: 1 },
  projectName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  projectClient: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  projectRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusLabel: { fontSize: 11, fontWeight: '600' },
  reportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  reportInfo: { flex: 1 },
  reportDate: { fontSize: 13, fontWeight: '700', color: '#111827' },
  reportProject: { fontSize: 12, color: '#6b7280', marginTop: 1 },
  reportRight: { alignItems: 'flex-end', gap: 3 },
  reportCost: { fontSize: 14, fontWeight: '700', color: '#111827' },
  reportStatus: { fontSize: 11, color: '#6b7280', fontWeight: '500' },
  statusApproved: { color: '#16a34a' },
  emptyBox: {
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
  },
  emptyText: { fontSize: 13, color: '#9ca3af' },
  webLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    marginTop: 4,
  },
  webLinkText: { fontSize: 14, color: '#2563eb', fontWeight: '600' },
});

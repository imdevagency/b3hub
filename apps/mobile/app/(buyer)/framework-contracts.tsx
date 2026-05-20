/**
 * (buyer)/framework-contracts.tsx  →  Projects list
 *
 * Shows the buyer's construction-site projects.
 * Each project can contain multiple framework contracts.
 * Users with permCreateContracts (or OWNER/MANAGER) can create new projects.
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { useScreenLoad } from '@/lib/use-screen-load';
import { api, type ApiProject } from '@/lib/api';
import { haptics } from '@/lib/haptics';
import { FolderOpen, Plus, MapPin } from 'lucide-react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Text } from '@/components/ui/text';
import { useToast } from '@/components/ui/Toast';
import { colors } from '@/lib/theme';

function getProgressColor(pct: number) {
  if (pct >= 90) return '#ef4444';
  if (pct >= 60) return '#f59e0b';
  return '#10b981';
}

export default function BuyerProjectsScreen() {
  const { token, user } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', address: '', notes: '' });

  const canCreate =
    user?.companyRole === 'OWNER' ||
    user?.companyRole === 'MANAGER' ||
    user?.permCreateContracts === true;

  const fetcher = useCallback(async () => {
    if (!token) return;
    const data = await api.projects.list(token);
    setProjects(data);
  }, [token]);

  const { loading, refreshing, onRefresh } = useScreenLoad(fetcher);

  const openCreate = () => {
    haptics.light();
    setForm({ title: '', address: '', notes: '' });
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    if (!token) return;
    if (!form.title.trim()) {
      Alert.alert('Kļūda', 'Ievadiet projekta nosaukumu');
      return;
    }
    setSaving(true);
    try {
      const created = await api.projects.create(
        {
          title: form.title.trim(),
          address: form.address.trim() || undefined,
          notes: form.notes.trim() || undefined,
        },
        token,
      );
      haptics.success();
      setCreateOpen(false);
      setProjects((prev) => [created, ...prev]);
      router.push({
        pathname: '/(buyer)/project/[id]',
        params: { id: created.id },
      } as any);
    } catch (e) {
      haptics.error();
      toast.error(e instanceof Error ? e.message : 'Neizdevās izveidot projektu');
    } finally {
      setSaving(false);
    }
  };

  const renderItem = ({ item: project }: { item: ApiProject }) => {
    const pct = Math.min(100, project.totalProgressPct);
    const progColor = getProgressColor(pct);

    return (
      <TouchableOpacity
        style={s.card}
        onPress={() => {
          haptics.light();
          router.push({
            pathname: '/(buyer)/project/[id]',
            params: { id: project.id },
          } as any);
        }}
        activeOpacity={0.7}
      >
        <View style={s.cardTopRow}>
          <Text style={s.cardTitle} numberOfLines={1}>
            {project.title}
          </Text>
          <View style={s.contractCountBadge}>
            <Text style={s.contractCountText}>{project.contractCount} līg.</Text>
          </View>
        </View>

        {project.address ? (
          <View style={s.addressRow}>
            <MapPin size={12} color={colors.textMuted} />
            <Text style={s.cardMeta} numberOfLines={1}>
              {project.address}
            </Text>
          </View>
        ) : null}

        {project.contractCount > 0 ? (
          <>
            <View style={s.progressRow}>
              <View style={s.progressTrack}>
                <View
                  style={[s.progressFill, { width: `${pct}%` as any, backgroundColor: progColor }]}
                />
              </View>
              <Text style={[s.progressLabel, { color: progColor }]}>{Math.round(pct)}%</Text>
            </View>
            <Text style={s.qtyRow}>
              {project.totalConsumedQty.toLocaleString('lv')} /{' '}
              {project.totalAgreedQty.toLocaleString('lv')} t
            </Text>
          </>
        ) : (
          <Text style={s.cardMeta}>Nav pievienotu rāmjlīgumu</Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <ScreenContainer bg="white">
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader
        title="Projekti"
        rightAction={
          canCreate ? (
            <TouchableOpacity onPress={openCreate} hitSlop={12} activeOpacity={0.7}>
              <Plus size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          ) : undefined
        }
      />

      {loading ? (
        <View style={{ padding: 20 }}>
          <SkeletonCard count={4} />
        </View>
      ) : (
        <FlatList
          data={projects}
          keyExtractor={(item) => item.id}
          removeClippedSubviews={true}
          initialNumToRender={10}
          renderItem={renderItem}
          contentContainerStyle={projects.length === 0 ? s.emptyScroll : s.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#000" />
          }
          ListEmptyComponent={
            <EmptyState
              icon={<FolderOpen size={42} color="#9ca3af" />}
              title="Nav projektu"
              subtitle="Projekti palīdz organizēt rāmjlīgumus pa būvlaukumiem."
            />
          }
        />
      )}

      {/* Create project sheet */}
      <BottomSheet
        visible={createOpen}
        onClose={() => !saving && setCreateOpen(false)}
        title="Jauns projekts"
        scrollable
        maxHeightPct={0.85}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 12, gap: 20 }}>
            <View style={s.fieldGroup}>
              <Text style={s.fieldLabel}>NOSAUKUMS *</Text>
              <TextInput
                style={s.input}
                value={form.title}
                onChangeText={(v) => setForm((f) => ({ ...f, title: v }))}
                placeholder="Piem. Biroju ēka — Andrejsala"
                placeholderTextColor="#9ca3af"
                maxLength={120}
              />
            </View>
            <View style={s.fieldGroup}>
              <Text style={s.fieldLabel}>BŪVLAUKUMA ADRESE</Text>
              <TextInput
                style={s.input}
                value={form.address}
                onChangeText={(v) => setForm((f) => ({ ...f, address: v }))}
                placeholder="Piem. Andrejostas iela 1, Rīga"
                placeholderTextColor="#9ca3af"
                maxLength={200}
              />
            </View>
            <View style={s.fieldGroup}>
              <Text style={s.fieldLabel}>PIEZĪMES</Text>
              <TextInput
                style={[s.input, { minHeight: 80, paddingTop: 14 }]}
                value={form.notes}
                onChangeText={(v) => setForm((f) => ({ ...f, notes: v }))}
                placeholder="Papildu informācija..."
                placeholderTextColor="#9ca3af"
                multiline
                maxLength={500}
              />
            </View>
          </View>
          <View style={s.sheetFooter}>
            <TouchableOpacity
              style={[s.submitBtn, saving && { opacity: 0.6 }]}
              onPress={handleCreate}
              disabled={saving}
              activeOpacity={0.85}
            >
              <Text style={s.submitBtnText}>{saving ? 'Saglabā...' : 'Izveidot'}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </BottomSheet>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 8,
  },
  emptyScroll: {
    flexGrow: 1,
    paddingBottom: 40,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 2,
    gap: 6,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
    letterSpacing: -0.3,
  },
  contractCountBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
  },
  contractCountText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardMeta: {
    fontSize: 13,
    color: colors.textMuted,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: colors.bgMuted,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '600',
    minWidth: 36,
    textAlign: 'right',
  },
  qtyRow: {
    fontSize: 12,
    color: colors.textDisabled,
  },
  // Create form
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#f3f4f6',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.textPrimary,
    fontFamily: 'Inter_400Regular',
  },
  sheetFooter: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  submitBtn: {
    backgroundColor: '#166534',
    borderRadius: 100,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

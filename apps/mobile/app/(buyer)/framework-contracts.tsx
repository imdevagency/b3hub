/**
 * (buyer)/framework-contracts.tsx
 *
 * Buyer: list of framework contracts (rāmjlīgumi).
 * A framework contract is a long-running agreement with agreed quantities and
 * unit prices that the buyer releases as individual call-off transport jobs.
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
  FlatList,
} from 'react-native';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { api, type ApiFrameworkContract, type FrameworkContractStatus } from '@/lib/api';
import { formatDateShort } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { Package, Plus, X } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/text';
import { colors } from '@/lib/theme';

const STATUS: Record<FrameworkContractStatus, { label: string; bg: string; color: string }> = {
  // ... existing status map code ...
  DRAFT: { label: 'Melnraksts', bg: '#f3f4f6', color: '#6b7280' },
  ACTIVE: { label: 'Aktīvs', bg: '#ecfdf5', color: '#10b981' },
  COMPLETED: { label: 'Pabeigts', bg: '#f8fafc', color: '#64748b' },
  EXPIRED: { label: 'Beidzies', bg: '#f3f4f6', color: '#9ca3af' },
  CANCELLED: { label: 'Atcelts', bg: '#fef2f2', color: '#ef4444' },
};

function getProgressColor(pct: number) {
  if (pct >= 90) return '#ef4444';
  if (pct >= 60) return '#f59e0b';
  return '#10b981';
}

export default function FrameworkContractsScreen() {
  const { token } = useAuth();
  const router = useRouter();

  const [contracts, setContracts] = useState<ApiFrameworkContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [createVisible, setCreateVisible] = useState(false);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');

  const load = useCallback(
    async (skeleton = true) => {
      if (!token) return;
      if (skeleton) setLoading(true);
      try {
        const data = await api.frameworkContracts.list(token);
        setContracts(data);
      } catch (e) {
        Alert.alert('Kļūda', e instanceof Error ? e.message : 'Neizdevās ielādēt līgumus');
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

  const resetForm = () => {
    setTitle('');
    setStartDate(new Date().toISOString().split('T')[0]);
    setEndDate('');
    setNotes('');
  };

  const closeCreate = () => {
    setCreateVisible(false);
    resetForm();
  };

  const handleCreate = async () => {
    if (!token) return;
    if (!title.trim()) {
      Alert.alert('Aizpildiet nosaukumu');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      Alert.alert('Datuma formāts: GGGG-MM-DD');
      return;
    }

    setCreating(true);
    try {
      await api.frameworkContracts.create(
        {
          title: title.trim(),
          startDate,
          endDate: endDate.trim() || undefined,
          notes: notes.trim() || undefined,
        },
        token,
      );
      haptics.success();
      closeCreate();
      load(false);
    } catch (e) {
      Alert.alert('Kļūda', e instanceof Error ? e.message : 'Neizdevās izveidot līgumu');
    } finally {
      setCreating(false);
    }
  };

  const renderItem = ({ item: contract }: { item: ApiFrameworkContract }) => {
    const status = STATUS[contract.status] ?? STATUS.ACTIVE;
    const pct = Math.min(100, contract.totalProgressPct);
    const progColor = getProgressColor(pct);

    return (
      <TouchableOpacity
        style={s.itemContainer}
        onPress={() => {
          haptics.light();
          router.push({
            pathname: '/(buyer)/framework-contract/[id]',
            params: { id: contract.id },
          } as any);
        }}
        activeOpacity={0.7}
      >
        <View style={s.itemContent}>
          <View style={s.itemTopRow}>
            <Text style={s.itemTitle} numberOfLines={1}>
              {contract.title}
            </Text>
            {/* Status Dot */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={[s.statusDot, { backgroundColor: status.color }]} />
            </View>
          </View>

          <View style={s.itemMetaRow}>
            <Text style={s.itemSubtitle} numberOfLines={1}>
              {contract.contractNumber} • {formatDateShort(contract.startDate)}
            </Text>
            <Text style={s.itemProgress}>{pct}% izpilde</Text>
          </View>

          {/* Minimal Progress Line */}
          <View style={s.miniProgressTrack}>
            <View style={[s.miniProgressFill, { width: `${pct}%`, backgroundColor: progColor }]} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ScreenContainer bg="#F9FAFB" standalone>
      <Stack.Screen options={{ headerShown: false }} />
      {/* Minimal Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Projekti</Text>
        <TouchableOpacity
          style={s.headerBtn}
          onPress={() => {
            haptics.light();
            setCreateVisible(true);
          }}
          activeOpacity={0.6}
        >
          <Plus size={24} color="#000" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ padding: 20 }}>
          <SkeletonCard count={4} />
        </View>
      ) : (
        <FlatList
          data={contracts}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={contracts.length === 0 ? s.emptyScroll : s.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load(false);
              }}
              tintColor="#000"
            />
          }
          ListEmptyComponent={
            <View style={s.emptyContainer}>
              <Text style={s.emptyTitle}>Nav aktīvu projektu</Text>
              <Text style={s.emptySubtitle}>Sāciet jaunu projektu, lai veiktu pasūtījumus.</Text>
              <TouchableOpacity
                onPress={() => {
                  haptics.light();
                  setCreateVisible(true);
                }}
                activeOpacity={0.7}
                style={s.emptyAction}
              >
                <Text style={s.emptyActionText}>Izveidot projektu</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* Creation Modal */}
      <Modal
        visible={createVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeCreate}
      >
        <ScreenContainer standalone bg="#fff">
          <View style={s.modalHeader}>
            <Text size="xl" style={s.modalTitle}>
              Jauns projekts
            </Text>
            <TouchableOpacity onPress={closeCreate} style={s.modalCloseBtn}>
              <X size={24} color="#000" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={s.modalContent} keyboardShouldPersistTaps="handled">
            <View style={s.formGroup}>
              <Text style={s.label}>Nosaukums</Text>
              <TextInput
                style={s.modernInput}
                value={title}
                onChangeText={setTitle}
                placeholder="Piem. Grantsšķembas Ceļš A2"
                placeholderTextColor="#9ca3af"
                autoFocus
              />
            </View>

            <View style={s.row}>
              <View style={[s.formGroup, { flex: 1 }]}>
                <Text style={s.label}>Sākums</Text>
                <TextInput
                  style={s.modernInput}
                  value={startDate}
                  onChangeText={setStartDate}
                  placeholder="GGGG-MM-DD"
                  keyboardType="numbers-and-punctuation"
                />
              </View>
              <View style={{ width: 12 }} />
              <View style={[s.formGroup, { flex: 1 }]}>
                <Text style={s.label}>Beigas (izvēles)</Text>
                <TextInput
                  style={s.modernInput}
                  value={endDate}
                  onChangeText={setEndDate}
                  placeholder="GGGG-MM-DD"
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            </View>

            <View style={s.formGroup}>
              <Text style={s.label}>Piezīmes</Text>
              <TextInput
                style={[s.modernInput, s.textArea]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Papildinformācija..."
                multiline
                numberOfLines={3}
              />
            </View>

            <Button onPress={handleCreate} isLoading={creating} style={s.fabButton}>
              <Text style={s.fabText}>Izveidot</Text>
            </Button>
          </ScrollView>
        </ScreenContainer>
      </Modal>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 24,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#000',
    letterSpacing: -0.8,
  },
  headerBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    // Minimal shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  emptyScroll: {
    flexGrow: 1,
    paddingBottom: 40,
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  emptyAction: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    // No background, just text link style or minimal outline
  },
  emptyActionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    textDecorationLine: 'underline',
  },

  // Item Styles - Uber-like Minimal
  itemContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 12,
    padding: 20,
    // Very subtle elevation
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 2,
  },
  itemContent: {
    gap: 8,
  },
  itemTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemTitle: {
    fontSize: 18, // Bigger
    fontWeight: '700',
    color: '#111827',
    flex: 1,
    marginRight: 12,
    letterSpacing: -0.3,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  itemMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  itemProgress: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  miniProgressTrack: {
    height: 3,
    backgroundColor: '#f3f4f6',
    borderRadius: 2,
    marginTop: 8,
    width: '100%',
    overflow: 'hidden',
  },
  miniProgressFill: {
    height: '100%',
    borderRadius: 2,
  },

  // Modal / Form Styles
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    padding: 24,
  },
  formGroup: {
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    marginLeft: 4,
  },
  modernInput: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  fabButton: {
    backgroundColor: '#000',
    borderRadius: 16,
    height: 56,
    marginTop: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  fabText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});

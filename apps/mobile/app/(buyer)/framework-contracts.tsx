/**
 * (buyer)/framework-contracts.tsx
 *
 * Buyer: list of framework contracts (rāmjlīgumi).
 * A framework contract is a long-running agreement with agreed quantities and
 * unit prices that the buyer releases as individual call-off transport jobs.
 */

import React, { useCallback, useState, useMemo } from 'react';
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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { api, type ApiFrameworkContract, type FrameworkContractStatus } from '@/lib/api';
import { formatDateShort } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { Package, Plus, X, Calendar as CalendarIcon, FileText } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/text';
import { Calendar, LocaleConfig, DateData } from 'react-native-calendars';

// Setup Latvian Locale
LocaleConfig.locales['lv'] = {
  monthNames: [
    'Janvāris',
    'Februāris',
    'Marts',
    'Aprīlis',
    'Maijs',
    'Jūnijs',
    'Jūlijs',
    'Augusts',
    'Septembris',
    'Oktobris',
    'Novembris',
    'Decembris',
  ],
  monthNamesShort: [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'Mai',
    'Jūn',
    'Jūl',
    'Aug',
    'Sep',
    'Okt',
    'Nov',
    'Dec',
  ],
  dayNames: [
    'Svētdiena',
    'Pirmdiena',
    'Otrdiena',
    'Trešdiena',
    'Ceturtdiena',
    'Piektdiena',
    'Sestdiena',
  ],
  dayNamesShort: ['Sv', 'Pr', 'Ot', 'Tr', 'Ce', 'Pk', 'Se'],
  today: 'Šodien',
};
LocaleConfig.defaultLocale = 'lv';

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

import { ScreenHeader } from '@/components/ui/ScreenHeader';

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

  // Calendar logic
  const handleDayPress = (day: DateData) => {
    haptics.light();

    // Case 1: Start new selection if both set, or if clicking before start
    if ((startDate && endDate) || (startDate && day.dateString < startDate)) {
      setStartDate(day.dateString);
      setEndDate('');
      return;
    }

    // Case 2: Set start if nothing set
    if (!startDate) {
      setStartDate(day.dateString);
      return;
    }

    // Case 3: Set end if start is set and clicking after
    if (startDate && !endDate && day.dateString > startDate) {
      setEndDate(day.dateString);
    }
  };

  const markedDates = useMemo(() => {
    const marks: any = {};

    if (startDate) {
      marks[startDate] = { startingDay: true, color: 'black', textColor: 'white' };
    }

    if (endDate) {
      marks[endDate] = { endingDay: true, color: 'black', textColor: 'white' };

      // Fill in between
      let curr = new Date(startDate);
      const end = new Date(endDate);
      curr.setDate(curr.getDate() + 1);

      while (curr < end) {
        const dateStr = curr.toISOString().split('T')[0];
        marks[dateStr] = { color: '#f3f4f6', textColor: 'black' };
        curr.setDate(curr.getDate() + 1);
      }
    } else if (startDate) {
      marks[startDate] = { selected: true, color: 'black', textColor: 'white' };
    }

    return marks;
  }, [startDate, endDate]);

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
    <ScreenContainer bg="white" standalone>
      <Stack.Screen options={{ headerShown: false }} />
      {/* Detail Screen Header */}
      <ScreenHeader
        title="Projekti"
        rightSlot={
          <TouchableOpacity
            onPress={() => {
              haptics.light();
              setCreateVisible(true);
            }}
            hitSlop={10}
            activeOpacity={0.6}
          >
            <Plus size={24} color="#000" />
          </TouchableOpacity>
        }
      />
      {/**/}

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
            <EmptyState
              icon={<Package size={42} color="#9ca3af" />}
              title="Nav aktīvu projektu"
              subtitle="Sāciet jaunu projektu, lai veiktu pasūtījumus."
              action={
                <TouchableOpacity
                  onPress={() => {
                    haptics.light();
                    setCreateVisible(true);
                  }}
                  activeOpacity={0.8}
                  style={{
                    marginTop: 20,
                    backgroundColor: '#111827',
                    paddingHorizontal: 24,
                    paddingVertical: 14,
                    borderRadius: 12,
                    shadowColor: '#000',
                    shadowOpacity: 0.1,
                    shadowRadius: 4,
                  }}
                >
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>
                    Izveidot projektu
                  </Text>
                </TouchableOpacity>
              }
            />
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
        <ScreenContainer bg="#fff">
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
            <View style={s.modalHeader}>
              <TouchableOpacity onPress={closeCreate} style={s.modalCloseBtn}>
                <X size={24} color="#000" />
              </TouchableOpacity>
              <Text style={s.modalStepText}>Jauns līgums</Text>
              <View style={{ width: 36 }} />
            </View>

            <ScrollView contentContainerStyle={s.modalContent} keyboardShouldPersistTaps="handled">
              {/* 1. Title Section */}
              <View style={s.section}>
                <TextInput
                  style={s.heroInput}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Projekta nosaukums"
                  placeholderTextColor="#9ca3af"
                  autoFocus={false}
                  multiline
                />
              </View>

              {/* 2. Date Section */}
              <View style={s.section}>
                <View style={s.dateRow}>
                  <View style={s.dateBlock}>
                    <Text style={s.dateLabel}>SĀKUMS</Text>
                    <Text style={[s.dateValue, !startDate && s.datePlaceholder]}>
                      {startDate || 'Izvēlies'}
                    </Text>
                  </View>
                  <View style={s.dateDivider} />
                  <View style={s.dateBlock}>
                    <Text style={s.dateLabel}>BEIGAS</Text>
                    <Text style={[s.dateValue, !endDate && s.datePlaceholder]}>
                      {endDate || 'Neierobežots'}
                    </Text>
                  </View>
                </View>

                <View style={s.calendarWrapper}>
                  <Calendar
                    current={startDate}
                    onDayPress={handleDayPress}
                    markingType={'period'}
                    markedDates={markedDates}
                    theme={{
                      backgroundColor: '#ffffff',
                      calendarBackground: '#ffffff',
                      textSectionTitleColor: '#b6c1cd',
                      selectedDayBackgroundColor: '#000000',
                      selectedDayTextColor: '#ffffff',
                      todayTextColor: '#000000',
                      dayTextColor: '#2d4150',
                      textDisabledColor: '#d9e1e8',
                      dotColor: '#00adf5',
                      selectedDotColor: '#ffffff',
                      arrowColor: '#000000',
                      monthTextColor: '#000000',
                      textDayFontWeight: '600',
                      textMonthFontWeight: 'bold',
                      textDayHeaderFontWeight: '600',
                      textDayFontSize: 14,
                      textMonthFontSize: 16,
                      textDayHeaderFontSize: 13,
                    }}
                  />
                </View>
              </View>

              {/* 3. Notes Section */}
              <View style={s.section}>
                <View style={s.inputRow}>
                  <FileText size={18} color="#9ca3af" style={{ marginRight: 10, marginTop: 12 }} />
                  <TextInput
                    style={[s.modernInput, s.textArea]}
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Piezīmes (izvēles)..."
                    placeholderTextColor="#9ca3af"
                    multiline
                  />
                </View>
              </View>

              <View style={{ height: 100 }} />
            </ScrollView>

            <View style={s.footer}>
              <Button onPress={handleCreate} isLoading={creating} style={s.fabButton}>
                <Text style={s.fabText}>Izveidot projektu</Text>
              </Button>
            </View>
          </KeyboardAvoidingView>
        </ScreenContainer>
      </Modal>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  // ... existing styles ...
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
  },
  emptyActionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    textDecorationLine: 'underline',
  },
  itemContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 2,
  },
  itemContent: { gap: 8 },
  itemTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
    marginRight: 12,
    letterSpacing: -0.3,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  itemMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemSubtitle: { fontSize: 14, fontWeight: '500', color: '#6b7280' },
  itemProgress: { fontSize: 13, fontWeight: '600', color: '#374151' },
  miniProgressTrack: {
    height: 3,
    backgroundColor: '#f3f4f6',
    borderRadius: 2,
    marginTop: 8,
    width: '100%',
    overflow: 'hidden',
  },
  miniProgressFill: { height: '100%', borderRadius: 2 },

  // New Modal Styles
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalStepText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalContent: {
    paddingHorizontal: 24,
    paddingTop: 10,
  },
  section: {
    marginBottom: 24,
  },
  heroInput: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    padding: 4,
    marginBottom: 16,
  },
  dateBlock: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  dateLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9ca3af',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  dateValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  datePlaceholder: {
    color: '#9ca3af',
  },
  dateDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#e5e7eb',
  },
  calendarWrapper: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    overflow: 'hidden',
    padding: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  modernInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    paddingVertical: 14,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  footer: {
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    backgroundColor: '#fff',
  },
  fabButton: {
    backgroundColor: '#000',
    borderRadius: 16,
    height: 56,
    width: '100%',
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

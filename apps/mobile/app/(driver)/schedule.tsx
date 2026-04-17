import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Switch,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useToast } from '@/components/ui/Toast';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { TopBar } from '@/components/ui/TopBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { api, type DriverAvailability, type DriverWeeklySlot } from '@/lib/api';
import { CalendarDays, Wifi, WifiOff, X } from 'lucide-react-native';
import { haptics } from '@/lib/haptics';
import { colors } from '@/lib/theme';

const DAY_FULL = [
  'Svētdiena',
  'Pirmdiena',
  'Otrdiena',
  'Trešdiena',
  'Ceturtdiena',
  'Piektdiena',
  'Sestdiena',
];

function fmtTime(t: string): string {
  return t.substring(0, 5);
}

function fmtBlockDate(iso: string): string {
  return new Date(iso).toLocaleDateString('lv-LV', {
    weekday: 'short',
    day: '2-digit',
    month: 'long',
  });
}

function DayRow({
  slot,
  onToggle,
  onEditTime,
  disabled,
  isLast,
}: {
  slot: DriverWeeklySlot;
  onToggle: () => void;
  onEditTime: () => void;
  disabled?: boolean;
  isLast?: boolean;
}) {
  return (
    <View
      className={`flex-row items-center justify-between py-4 px-5 bg-white border-gray-100 ${!isLast ? 'border-b' : ''}`}
      style={disabled ? { opacity: 0.6 } : undefined}
    >
      <View className="flex-1 pr-4">
        <Text
          style={{
            fontSize: 17,
            fontWeight: '700',
            color: slot.isActive ? '#111827' : '#9ca3af',
            letterSpacing: -0.3,
          }}
        >
          {DAY_FULL[slot.dayOfWeek]}
        </Text>
        <View className="mt-1.5 flex-row items-center">
          {slot.isActive ? (
            <TouchableOpacity
              disabled={disabled}
              onPress={onEditTime}
              activeOpacity={0.7}
              hitSlop={8}
            >
              <View className="bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200">
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
                  {fmtTime(slot.startTime)} – {fmtTime(slot.endTime)}
                </Text>
              </View>
            </TouchableOpacity>
          ) : (
            <Text style={{ fontSize: 14, color: colors.textDisabled, fontWeight: '600' }}>Brīvdiena</Text>
          )}
        </View>
      </View>
      <Switch
        value={slot.isActive}
        onValueChange={onToggle}
        disabled={disabled}
        trackColor={{ false: '#e5e7eb', true: '#111827' }}
        thumbColor="#ffffff"
        ios_backgroundColor="#e5e7eb"
      />
    </View>
  );
}

export default function ScheduleScreen() {
  const { token } = useAuth();
  const toast = useToast();
  const [profile, setProfile] = useState<DriverAvailability | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [updatingDays, setUpdatingDays] = useState<Set<number>>(new Set());
  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');

  const load = useCallback(
    async (isRefresh = false) => {
      if (!token) return;
      if (!isRefresh) setLoading(true);
      else setRefreshing(true);
      try {
        const data = await api.driverSchedule.getStatus(token);
        setProfile(data);
      } catch {
        toast.error('Neizdevās ielādēt grafiku.');
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

  const handleToggleOnline = async (value: boolean) => {
    if (!token || toggling) return;
    haptics.light();
    setToggling(true);
    setProfile((prev) => (prev ? { ...prev, isOnline: value, effectiveOnline: value } : prev));
    try {
      const res = await api.driverSchedule.toggleOnline(value, token);
      setProfile((prev) =>
        prev ? { ...prev, isOnline: res.isOnline, effectiveOnline: res.isOnline } : prev,
      );
      haptics.success();
    } catch {
      haptics.error();
      setProfile((prev) => (prev ? { ...prev, isOnline: !value, effectiveOnline: !value } : prev));
      toast.error('Neizdevās mainīt statusu.');
    } finally {
      setToggling(false);
    }
  };

  const openTimeEditor = (dayOfWeek: number) => {
    const slot = gridSlots.find((s) => s.dayOfWeek === dayOfWeek);
    if (!slot) return;
    haptics.light();
    setEditStart(fmtTime(slot.startTime));
    setEditEnd(fmtTime(slot.endTime));
    setEditingDay(dayOfWeek);
  };

  const handleSaveTime = async () => {
    if (editingDay === null || !token || !profile) return;
    const timeRe = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRe.test(editStart) || !timeRe.test(editEnd)) {
      toast.error('Lūdzu ievadiet laiku HH:MM formātā.');
      return;
    }
    if (editStart >= editEnd) {
      toast.error('Sākuma laikam jābūt pirms beigu laika.');
      return;
    }
    haptics.light();
    const updatedSlots = gridSlots.map((s) =>
      s.dayOfWeek === editingDay
        ? { ...s, startTime: editStart + ':00', endTime: editEnd + ':00' }
        : s,
    );
    setProfile({ ...profile, weeklySchedule: updatedSlots });
    const savedDay = editingDay;
    setEditingDay(null);
    setUpdatingDays((prev) => new Set(prev).add(savedDay));
    try {
      await api.driverSchedule.updateSchedule(
        {
          days: updatedSlots.map((s) => ({
            dayOfWeek: s.dayOfWeek,
            enabled: s.isActive,
            startTime: s.startTime,
            endTime: s.endTime,
          })),
          autoSchedule: profile.autoSchedule,
          maxJobsPerDay: profile.maxJobsPerDay,
        },
        token,
      );
      haptics.success();
    } catch {
      haptics.error();
      toast.error('Neizdevās saglabāt laiku.');
      load();
    } finally {
      setUpdatingDays((prev) => {
        const n = new Set(prev);
        n.delete(savedDay);
        return n;
      });
    }
  };

  const sortedSlots = (profile?.weeklySchedule ?? []).slice().sort((a, b) => {
    const ord = (d: number) => (d === 0 ? 7 : d);
    return ord(a.dayOfWeek) - ord(b.dayOfWeek);
  });

  const slotMap = new Map(sortedSlots.map((s) => [s.dayOfWeek, s]));
  const allDays = [1, 2, 3, 4, 5, 6, 0];
  const gridSlots: DriverWeeklySlot[] = allDays.map(
    (d) =>
      slotMap.get(d) ?? {
        id: `placeholder-${d}`,
        dayOfWeek: d,
        startTime: '08:00',
        endTime: '17:00',
        isActive: false,
      },
  );

  const handleToggleDay = async (dayOfWeek: number) => {
    if (!token || !profile || updatingDays.has(dayOfWeek)) return;
    const currentSlot = gridSlots.find((s) => s.dayOfWeek === dayOfWeek);
    if (!currentSlot) return;

    haptics.light();
    const newActiveState = !currentSlot.isActive;
    const newWeeklySchedule = gridSlots.map((s) =>
      s.dayOfWeek === dayOfWeek ? { ...s, isActive: newActiveState } : s,
    );

    setProfile({ ...profile, weeklySchedule: newWeeklySchedule });
    setUpdatingDays((prev) => new Set(prev).add(dayOfWeek));

    try {
      const payload = {
        days: newWeeklySchedule.map((s) => ({
          dayOfWeek: s.dayOfWeek,
          enabled: s.isActive,
          startTime: s.startTime,
          endTime: s.endTime,
        })),
        autoSchedule: profile.autoSchedule,
        maxJobsPerDay: profile.maxJobsPerDay,
      };

      await api.driverSchedule.updateSchedule(payload, token);
      haptics.success();
    } catch {
      haptics.error();
      toast.error('Neizdevās atjaunināt grafiku.');
      load();
    } finally {
      setUpdatingDays((prev) => {
        const next = new Set(prev);
        next.delete(dayOfWeek);
        return next;
      });
    }
  };

  const futureBlocks = (profile?.dateBlocks ?? []).filter(
    (b) => new Date(b.blockedDate) >= new Date(new Date().toDateString()),
  );

  return (
    <ScreenContainer bg="#ffffff" topBg="#ffffff">
      <TopBar transparent />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor="#111827"
          />
        }
      >
        {loading ? (
          <View className="px-5">
            <View className="pt-2 pb-6">
              <Text
                style={{ fontSize: 32, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.8 }}
              >
                Grafiks
              </Text>
            </View>
            <SkeletonCard count={3} />
          </View>
        ) : !profile ? (
          <View className="mt-8">
            <EmptyState
              icon={<CalendarDays size={40} color="#d1d5db" />}
              title="Grafiks nav pieejams"
              subtitle="Šofera profils vēl nav izveidots."
            />
          </View>
        ) : (
          <>
            <View className="px-5 pt-1 pb-6">
              <Text
                style={{ fontSize: 32, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.8 }}
              >
                Grafiks
              </Text>
            </View>

            {/* Status Hero */}
            <View className="px-5 mb-8">
              <View
                className={`rounded-3xl p-6 items-center justify-center min-h-[220px] ${profile.isOnline ? 'bg-gray-900' : 'bg-gray-100'}`}
              >
                <View
                  className={`w-16 h-16 rounded-full items-center justify-center mb-4 ${profile.isOnline ? 'bg-white/10' : 'bg-white'}`}
                >
                  {profile.isOnline ? (
                    <Wifi size={32} color="#ffffff" />
                  ) : (
                    <WifiOff size={32} color="#9ca3af" />
                  )}
                </View>
                <Text
                  style={{
                    fontSize: 24,
                    fontWeight: '800',
                    color: profile.isOnline ? '#ffffff' : '#111827',
                    letterSpacing: -0.5,
                    textAlign: 'center',
                  }}
                >
                  {profile.isOnline ? 'Tiešsaistē' : 'Bezsaistē'}
                </Text>
                <Text
                  style={{
                    fontSize: 15,
                    color: profile.isOnline ? '#9ca3af' : '#6b7280',
                    fontWeight: '500',
                    marginTop: 6,
                    textAlign: 'center',
                    lineHeight: 20,
                  }}
                >
                  {profile.isOnline
                    ? 'Jūs saņemsiet jaunus piedāvājumus'
                    : 'Darba piedāvājumi ir apturēti'}
                </Text>

                <TouchableOpacity
                  className={`mt-8 px-8 py-3.5 rounded-full w-full items-center justify-center ${profile.isOnline ? 'bg-white' : 'bg-gray-900'}`}
                  onPress={() => handleToggleOnline(!profile.isOnline)}
                  activeOpacity={0.8}
                >
                  {toggling ? (
                    <ActivityIndicator color={profile.isOnline ? '#111827' : '#ffffff'} />
                  ) : (
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: '700',
                        color: profile.isOnline ? '#111827' : '#ffffff',
                      }}
                    >
                      {profile.isOnline ? 'Apturēt darbu' : 'Sākt darbu'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Schedule */}
            <View>
              <View className="px-5 pb-3">
                <Text
                  style={{ fontSize: 20, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5 }}
                >
                  Nedēļas plāns
                </Text>
                <Text style={{ fontSize: 14, color: colors.textMuted, fontWeight: '500', marginTop: 2 }}>
                  Norādiet darba stundas katrai dienai
                </Text>
              </View>
              <View className="mt-1">
                {gridSlots.map((slot, i) => (
                  <DayRow
                    key={slot.dayOfWeek}
                    slot={slot}
                    onToggle={() => handleToggleDay(slot.dayOfWeek)}
                    onEditTime={() => openTimeEditor(slot.dayOfWeek)}
                    disabled={updatingDays.has(slot.dayOfWeek)}
                    isLast={i === gridSlots.length - 1}
                  />
                ))}
              </View>
            </View>

            {/* Blocked Dates */}
            {futureBlocks.length > 0 && (
              <View className="mt-8">
                <View className="px-5 pb-3">
                  <Text
                    style={{
                      fontSize: 20,
                      fontWeight: '800',
                      color: colors.textPrimary,
                      letterSpacing: -0.5,
                    }}
                  >
                    Brīvdienas
                  </Text>
                </View>
                <View className="mt-1">
                  {futureBlocks.map((block, i) => (
                    <View
                      key={block.id}
                      className={`py-4 px-5 bg-white border-gray-100 ${i !== futureBlocks.length - 1 ? 'border-b' : ''}`}
                    >
                      <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary }}>
                        {fmtBlockDate(block.blockedDate)}
                      </Text>
                      {block.reason ? (
                        <Text style={{ fontSize: 14, color: colors.textMuted, marginTop: 2 }}>
                          {block.reason}
                        </Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Time edit modal */}
      <Modal
        visible={editingDay !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingDay(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
        >
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setEditingDay(null)}
          />
          <View
            style={{
              backgroundColor: colors.bgCard,
              borderTopLeftRadius: 32,
              borderTopRightRadius: 32,
              padding: 24,
              paddingBottom: 48,
            }}
          >
            <View className="flex-row justify-between items-center mb-6">
              <Text
                style={{ fontSize: 22, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5 }}
              >
                {editingDay !== null ? DAY_FULL[editingDay] : ''}
              </Text>
              <TouchableOpacity
                onPress={() => setEditingDay(null)}
                className="w-8 h-8 bg-gray-100 rounded-full items-center justify-center"
              >
                <X size={18} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <View className="flex-row justify-between" style={{ gap: 16 }}>
              <View className="flex-1 bg-gray-100 rounded-2xl p-4 items-center">
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '600',
                    color: colors.textMuted,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    marginBottom: 8,
                  }}
                >
                  Sākums
                </Text>
                <TextInput
                  value={editStart}
                  onChangeText={setEditStart}
                  placeholder="08:00"
                  placeholderTextColor="#9ca3af"
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                  style={{
                    fontSize: 32,
                    fontWeight: '800',
                    color: colors.textPrimary,
                    textAlign: 'center',
                    marginTop: 4,
                  }}
                />
              </View>
              <View className="flex-1 bg-gray-100 rounded-2xl p-4 items-center">
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '600',
                    color: colors.textMuted,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    marginBottom: 8,
                  }}
                >
                  Beigas
                </Text>
                <TextInput
                  value={editEnd}
                  onChangeText={setEditEnd}
                  placeholder="17:00"
                  placeholderTextColor="#9ca3af"
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                  style={{
                    fontSize: 32,
                    fontWeight: '800',
                    color: colors.textPrimary,
                    textAlign: 'center',
                    marginTop: 4,
                  }}
                />
              </View>
            </View>

            <TouchableOpacity
              onPress={handleSaveTime}
              className="mt-6 py-4 rounded-full bg-gray-900 items-center justify-center"
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 17, fontWeight: '700', color: colors.white }}>
                Saglabāt grafiku
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenContainer>
  );
}

/**
 * Driver schedule screen — (driver)/schedule
 * Shows online/offline status toggle + weekly availability schedule.
 */
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
import { Skeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/button';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { Divider } from '@/components/ui/Divider';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { api, type DriverAvailability, type DriverWeeklySlot } from '@/lib/api';
import { colors } from '@/lib/theme';
import { CalendarDays, Wifi, WifiOff } from 'lucide-react-native';
import { haptics } from '@/lib/haptics';

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
}: {
  slot: DriverWeeklySlot;
  onToggle: () => void;
  onEditTime: () => void;
  disabled?: boolean;
}) {
  return (
    <View
      className="flex-row items-center justify-between p-4 bg-white"
      style={disabled ? { opacity: 0.5 } : undefined}
    >
      <View className="gap-1">
        <Text
          className="text-base font-semibold"
          style={{ color: slot.isActive ? colors.textPrimary : colors.textMuted }}
        >
          {DAY_FULL[slot.dayOfWeek]}
        </Text>
        {slot.isActive ? (
          <TouchableOpacity onPress={onEditTime} disabled={disabled} hitSlop={8}>
            <Text
              className="text-sm"
              style={{ color: colors.primary, textDecorationLine: 'underline' }}
            >
              {fmtTime(slot.startTime)} – {fmtTime(slot.endTime)}
            </Text>
          </TouchableOpacity>
        ) : (
          <Text className="text-sm text-text-muted">Brīvdiena</Text>
        )}
      </View>
      <Switch
        value={slot.isActive}
        onValueChange={onToggle}
        disabled={disabled}
        trackColor={{ false: '#E5E7EB', true: colors.primary }}
        thumbColor="#FFFFFF"
        ios_backgroundColor="#E5E7EB"
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
    } catch {
      setProfile((prev) => (prev ? { ...prev, isOnline: !value, effectiveOnline: !value } : prev));
      toast.error('Neizdevās mainīt statusu.');
    } finally {
      setToggling(false);
    }
  };

  const openTimeEditor = (dayOfWeek: number) => {
    const slot = gridSlots.find((s) => s.dayOfWeek === dayOfWeek);
    if (!slot) return;
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
    const updatedSlots = gridSlots.map((s) =>
      s.dayOfWeek === editingDay
        ? { ...s, startTime: editStart + ':00', endTime: editEnd + ':00' }
        : s,
    );
    setProfile({ ...profile, weeklySchedule: updatedSlots });
    setEditingDay(null);
    setUpdatingDays((prev) => new Set(prev).add(editingDay));
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
      toast.success('Laiks saglabāts!');
    } catch {
      toast.error('Neizdevās saglabāt laiku.');
      load();
    } finally {
      setUpdatingDays((prev) => {
        const n = new Set(prev);
        n.delete(editingDay!);
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
      toast.success('Grafiks atjaunināts!');
    } catch {
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
    <ScreenContainer bg="#F4F5F7">
      <TopBar title="Grafiks" />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
      >
        {loading ? (
          <View className="p-4 gap-4">
            <Skeleton height={200} radius={24} />
            <Skeleton height={400} radius={12} />
          </View>
        ) : !profile ? (
          <EmptyState
            icon={<CalendarDays size={40} color={colors.textMuted} />}
            title="Grafiks nav pieejams"
            subtitle="Šofera profils vēl nav izveidots."
          />
        ) : (
          <>
            {/* Status Hero */}
            <View className="bg-white items-center py-8 rounded-b-3xl shadow-sm mb-6">
              <View
                className="w-16 h-16 rounded-full items-center justify-center mb-4"
                style={{ backgroundColor: profile.isOnline ? '#dcfce7' : '#f3f4f6' }}
              >
                {profile.isOnline ? (
                  <Wifi size={32} color="#059669" />
                ) : (
                  <WifiOff size={32} color="#9CA3AF" />
                )}
              </View>
              <Text className="text-xl font-bold text-text-primary mb-1">
                {profile.isOnline ? 'Jūs esat tiešsaistē' : 'Jūs esat bezsaistē'}
              </Text>
              <Text className="text-text-muted text-center px-8 mb-6">
                {profile.isOnline
                  ? 'Jūs saņemsiet jaunus darba piedāvājumus.'
                  : 'Jūs nesaņemat darba piedāvājumus.'}
              </Text>

              <Button
                variant={profile.isOnline ? 'destructive' : 'default'}
                className="w-64 rounded-full"
                onPress={() => handleToggleOnline(!profile.isOnline)}
                isLoading={toggling}
              >
                {profile.isOnline ? 'Beigt darbu' : 'Sākt darbu'}
              </Button>
            </View>

            {/* Schedule */}
            <View className="px-4">
              <SectionLabel label="NEDĒĻAS PLĀNS" />
              <View className="bg-white rounded-xl overflow-hidden shadow-sm">
                {gridSlots.map((slot, i) => (
                  <React.Fragment key={slot.dayOfWeek}>
                    <DayRow
                      slot={slot}
                      onToggle={() => handleToggleDay(slot.dayOfWeek)}
                      onEditTime={() => openTimeEditor(slot.dayOfWeek)}
                      disabled={updatingDays.has(slot.dayOfWeek)}
                    />
                    {i < gridSlots.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </View>
            </View>

            {/* Blocked Dates */}
            {futureBlocks.length > 0 && (
              <View className="px-4 mt-6">
                <SectionLabel label="BRĪVDIENAS" />
                <View className="bg-white rounded-xl overflow-hidden shadow-sm">
                  {futureBlocks.map((block, i) => (
                    <React.Fragment key={block.id}>
                      <View className="p-4 bg-white">
                        <Text className="font-medium text-text-primary">
                          {fmtBlockDate(block.blockedDate)}
                        </Text>
                        {block.reason ? (
                          <Text className="text-sm text-text-muted mt-0.5">{block.reason}</Text>
                        ) : null}
                      </View>
                      {i < futureBlocks.length - 1 && <Divider />}
                    </React.Fragment>
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
          style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }}
        >
          <View
            style={{
              backgroundColor: '#fff',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 24,
              paddingBottom: 36,
            }}
          >
            <Text style={{ fontSize: 17, fontWeight: '700', marginBottom: 20, color: '#111827' }}>
              {editingDay !== null ? DAY_FULL[editingDay] : ''} — darba laiks
            </Text>
            <View style={{ flexDirection: 'row', gap: 16, marginBottom: 24 }}>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '600',
                    color: '#6B7280',
                    marginBottom: 8,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  Sākums
                </Text>
                <TextInput
                  value={editStart}
                  onChangeText={setEditStart}
                  placeholder="08:00"
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                  style={{
                    borderWidth: 1.5,
                    borderColor: '#E5E7EB',
                    borderRadius: 12,
                    padding: 14,
                    fontSize: 20,
                    fontWeight: '600',
                    textAlign: 'center',
                    color: '#111827',
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '600',
                    color: '#6B7280',
                    marginBottom: 8,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  Beigas
                </Text>
                <TextInput
                  value={editEnd}
                  onChangeText={setEditEnd}
                  placeholder="17:00"
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                  style={{
                    borderWidth: 1.5,
                    borderColor: '#E5E7EB',
                    borderRadius: 12,
                    padding: 14,
                    fontSize: 20,
                    fontWeight: '600',
                    textAlign: 'center',
                    color: '#111827',
                  }}
                />
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={() => setEditingDay(null)}
                style={{
                  flex: 1,
                  padding: 16,
                  borderRadius: 16,
                  borderWidth: 1.5,
                  borderColor: '#E5E7EB',
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontWeight: '600', color: '#374151' }}>Atcelt</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveTime}
                style={{
                  flex: 1,
                  padding: 16,
                  borderRadius: 16,
                  backgroundColor: colors.primary,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontWeight: '700', color: '#fff' }}>Saglabāt</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenContainer>
  );
}

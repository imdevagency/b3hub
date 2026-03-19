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
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { api, type DriverAvailability, type DriverWeeklySlot } from '@/lib/api';
import { colors, spacing, radius, shadows } from '@/lib/theme';
import {
  CalendarDays,
  Clock,
  Wifi,
  WifiOff,
  Info,
  ExternalLink,
  CheckCircle2,
  XCircle,
} from 'lucide-react-native';

// ─── Helpers ───────────────────────────────────────────────────────────────

const DAY_LABELS = ['Sv', 'Pr', 'Ot', 'Tr', 'Ce', 'Pk', 'Se'];
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
  return t.substring(0, 5); // 'HH:MM:SS' → 'HH:MM'
}

function fmtBlockDate(iso: string): string {
  return new Date(iso).toLocaleDateString('lv-LV', {
    weekday: 'short',
    day: '2-digit',
    month: 'long',
  });
}

// ─── Status badge ──────────────────────────────────────────────────────────

function StatusBadge({ online }: { online: boolean }) {
  return (
    <View style={[s.badge, online ? s.badgeOnline : s.badgeOffline]}>
      {online ? <Wifi size={13} color="#065F46" /> : <WifiOff size={13} color="#92400E" />}
      <Text style={[s.badgeText, online ? s.badgeTextOnline : s.badgeTextOffline]}>
        {online ? 'Tiešsaistē' : 'Bezsaistē'}
      </Text>
    </View>
  );
}

// ─── Weekly day row ────────────────────────────────────────────────────────

function DayRow({ slot }: { slot: DriverWeeklySlot }) {
  return (
    <View style={[s.dayRow, !slot.isActive && s.dayRowInactive]}>
      <View style={s.dayRowLeft}>
        <View style={[s.dayDot, slot.isActive ? s.dayDotActive : s.dayDotInactive]} />
        <Text style={[s.dayLabel, !slot.isActive && s.dayLabelInactive]}>
          {DAY_FULL[slot.dayOfWeek]}
        </Text>
      </View>
      {slot.isActive ? (
        <View style={s.timeRow}>
          <Clock size={13} color={colors.textMuted} />
          <Text style={s.timeText}>
            {fmtTime(slot.startTime)} – {fmtTime(slot.endTime)}
          </Text>
          <CheckCircle2 size={14} color="#059669" />
        </View>
      ) : (
        <View style={s.timeRow}>
          <XCircle size={14} color={colors.textDisabled} />
          <Text style={s.inactiveLabel}>Brīvdiena</Text>
        </View>
      )}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────

export default function ScheduleScreen() {
  const { token } = useAuth();
  const [profile, setProfile] = useState<DriverAvailability | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await api.driverSchedule.getStatus(token);
      setProfile(data);
    } catch {
      Alert.alert('Kļūda', 'Neizdevās ielādēt grafiku. Mēģiniet vēlreiz.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleToggleOnline = async (value: boolean) => {
    if (!token || toggling) return;
    setToggling(true);
    // Optimistic update
    setProfile((prev) => (prev ? { ...prev, isOnline: value } : prev));
    try {
      const res = await api.driverSchedule.toggleOnline(value, token);
      setProfile((prev) => (prev ? { ...prev, isOnline: res.isOnline } : prev));
    } catch {
      // Revert on error
      setProfile((prev) => (prev ? { ...prev, isOnline: !value } : prev));
      Alert.alert('Kļūda', 'Neizdevās mainīt statusu.');
    } finally {
      setToggling(false);
    }
  };

  // Build a sorted 7-day grid (Mon–Sun order: 1-6 then 0)
  const sortedSlots = (profile?.weeklySchedule ?? []).slice().sort((a, b) => {
    const ord = (d: number) => (d === 0 ? 7 : d);
    return ord(a.dayOfWeek) - ord(b.dayOfWeek);
  });

  // Fill in missing days
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

  const futureBlocks = (profile?.dateBlocks ?? []).filter(
    (b) => new Date(b.blockedDate) >= new Date(new Date().toDateString()),
  );

  return (
    <ScreenContainer standalone>
      <ScreenHeader title="Grafiks" />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={{ gap: spacing.base }}>
            <SkeletonCard />
            <SkeletonCard />
          </View>
        ) : !profile ? (
          <EmptyState
            icon={<CalendarDays size={40} color={colors.textMuted} />}
            title="Grafiks nav pieejams"
            subtitle="Šofera profils vēl nav izveidots."
          />
        ) : (
          <>
            {/* ── Online / offline card ──────────────────────────────── */}
            <View style={s.card}>
              <View style={s.cardRow}>
                <View style={s.cardLeft}>
                  <Text style={s.cardTitle}>Statusas</Text>
                  <StatusBadge online={profile.effectiveOnline} />
                </View>
                <View style={s.switchWrap}>
                  {toggling && (
                    <ActivityIndicator
                      size="small"
                      color={colors.primary}
                      style={s.spinnerInline}
                    />
                  )}
                  <Switch
                    value={profile.isOnline}
                    onValueChange={handleToggleOnline}
                    disabled={toggling}
                    trackColor={{ false: '#E5E7EB', true: `${colors.primary}60` }}
                    thumbColor={profile.isOnline ? colors.primary : '#9CA3AF'}
                    ios_backgroundColor="#E5E7EB"
                  />
                </View>
              </View>

              {profile.autoSchedule && (
                <View style={s.infoRow}>
                  <Info size={13} color={colors.textMuted} />
                  <Text style={s.infoText}>
                    Automātiskais grafiks aktīvs — statuss mainās pēc nedēļas grafika
                  </Text>
                </View>
              )}
              {profile.maxJobsPerDay != null && (
                <View style={s.infoRow}>
                  <Clock size={13} color={colors.textMuted} />
                  <Text style={s.infoText}>Maks. darbi dienā: {profile.maxJobsPerDay}</Text>
                </View>
              )}
            </View>

            {/* ── Weekly schedule ────────────────────────────────────── */}
            <View style={s.sectionHeader}>
              <CalendarDays size={16} color={colors.textSecondary} />
              <Text style={s.sectionTitle}>Nedēļas grafiks</Text>
            </View>

            <View style={s.card}>
              {gridSlots.map((slot, i) => (
                <React.Fragment key={slot.dayOfWeek}>
                  <DayRow slot={slot} />
                  {i < gridSlots.length - 1 && <View style={s.divider} />}
                </React.Fragment>
              ))}
              <View style={s.editHintRow}>
                <ExternalLink size={13} color={colors.textMuted} />
                <Text style={s.editHint}>
                  Rediģēt grafiku var <Text style={s.editHintBold}>B3Hub tīmekļa portālā</Text>
                </Text>
              </View>
            </View>

            {/* ── Blocked dates ──────────────────────────────────────── */}
            <View style={s.sectionHeader}>
              <XCircle size={16} color={colors.textSecondary} />
              <Text style={s.sectionTitle}>Bloķētie datumi</Text>
            </View>

            {futureBlocks.length === 0 ? (
              <View style={s.emptyBlocks}>
                <Text style={s.emptyBlocksText}>Nav bloķētu datumu</Text>
              </View>
            ) : (
              <View style={s.card}>
                {futureBlocks.map((block, i) => (
                  <React.Fragment key={block.id}>
                    <View style={s.blockRow}>
                      <Text style={s.blockDate}>{fmtBlockDate(block.blockedDate)}</Text>
                      {block.reason ? <Text style={s.blockReason}>{block.reason}</Text> : null}
                    </View>
                    {i < futureBlocks.length - 1 && <View style={s.divider} />}
                  </React.Fragment>
                ))}
              </View>
            )}

            <View style={{ height: 32 }} />
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: spacing.base, gap: spacing.sm },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.lg,
    ...shadows.card,
    overflow: 'hidden',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.base,
  },
  cardLeft: { gap: spacing.xs },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  switchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  spinnerInline: { marginRight: 4 },

  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
    alignSelf: 'flex-start',
  },
  badgeOnline: { backgroundColor: '#D1FAE5' },
  badgeOffline: { backgroundColor: '#FEF3C7' },
  badgeText: { fontSize: 12, fontWeight: '600' },
  badgeTextOnline: { color: '#065F46' },
  badgeTextOffline: { color: '#92400E' },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
  },
  infoText: { fontSize: 12, color: colors.textMuted, flex: 1 },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: spacing.sm,
    marginBottom: 4,
    paddingHorizontal: 2,
  },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },

  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: 12,
  },
  dayRowInactive: { opacity: 0.55 },
  dayRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dayDot: { width: 8, height: 8, borderRadius: 4 },
  dayDotActive: { backgroundColor: colors.primary },
  dayDotInactive: { backgroundColor: '#E5E7EB' },
  dayLabel: { fontSize: 14, fontWeight: '500', color: colors.textPrimary },
  dayLabelInactive: { color: colors.textDisabled },

  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  timeText: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  inactiveLabel: { fontSize: 12, color: colors.textDisabled },

  divider: { height: 1, backgroundColor: '#F3F4F6', marginHorizontal: spacing.base },

  editHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: spacing.base,
    backgroundColor: '#F9FAFB',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  editHint: { fontSize: 12, color: colors.textMuted, flex: 1 },
  editHintBold: { fontWeight: '600', color: colors.textSecondary },

  emptyBlocks: {
    backgroundColor: '#F9FAFB',
    borderRadius: radius.md,
    padding: spacing.base,
    alignItems: 'center',
  },
  emptyBlocksText: { fontSize: 13, color: colors.textMuted },

  blockRow: {
    paddingHorizontal: spacing.base,
    paddingVertical: 12,
    gap: 3,
  },
  blockDate: { fontSize: 14, fontWeight: '500', color: colors.textPrimary },
  blockReason: { fontSize: 12, color: colors.textMuted },
});

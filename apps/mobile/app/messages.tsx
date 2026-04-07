/**
 * Messages screen.
 * Conversation list view for the in-app chat on mobile.
 */
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useRouter, useFocusEffect } from 'expo-router';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import type { ApiChatRoom } from '@/lib/api';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { SkeletonJobRow } from '@/components/ui/Skeleton';
import { haptics } from '@/lib/haptics';
import { t } from '@/lib/translations';
import { colors, spacing, radius, shadows } from '@/lib/theme';
import {
  MessageCircle,
  Truck,
  Trash2,
  ChevronRight,
  PackageOpen,
  AlertCircle,
  RefreshCw,
} from 'lucide-react-native';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelative(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'Tikko';
  if (diffMin < 60) return `${diffMin} min.`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} st.`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD} d.`;
}

/** Map job status to a human label + pill colours */
function getStatusStyle(status: string): { label: string; bg: string; color: string } {
  switch (status) {
    case 'PENDING':
      return { label: 'Gaida', bg: colors.warningBg, color: colors.warningText };
    case 'CONFIRMED':
      return { label: 'Apstiprināts', bg: '#dbeafe', color: '#1d4ed8' };
    case 'LOADING':
      return { label: 'Iekraujas', bg: '#ede9fe', color: '#6d28d9' };
    case 'IN_TRANSIT':
      return { label: 'Ceļā', bg: '#dbeafe', color: '#1d4ed8' };
    case 'DELIVERED':
      return { label: 'Piegādāts', bg: colors.successBg, color: colors.successText };
    case 'COMPLETED':
      return { label: 'Pabeigts', bg: colors.successBg, color: colors.successText };
    default:
      return { label: status, bg: colors.badgeNeutralBg, color: colors.badgeNeutralText };
  }
}

// ─── Room card ────────────────────────────────────────────────────────────────

function RoomCard({ item, onPress }: { item: ApiChatRoom; onPress: () => void }) {
  const isDisposal = item.jobType === 'WASTE_COLLECTION';
  const Icon = isDisposal ? Trash2 : Truck;
  const accentColor = isDisposal ? colors.success : '#2563eb';
  const iconBg = isDisposal ? colors.successBg : '#dbeafe';
  const title = item.cargoType ?? (isDisposal ? 'Atkritumu izvešana' : 'Kravas pārvadāšana');
  const route =
    item.pickupCity && item.deliveryCity
      ? `${item.pickupCity} → ${item.deliveryCity}`
      : item.jobNumber;
  const st = getStatusStyle(item.status);

  return (
    <TouchableOpacity style={s.card} activeOpacity={0.82} onPress={onPress}>
      {/* Coloured left accent strip */}
      <View style={[s.accent, { backgroundColor: accentColor }]} />

      <View style={s.cardInner}>
        {/* Icon avatar */}
        <View style={[s.avatar, { backgroundColor: iconBg }]}>
          <Icon size={20} color={accentColor} strokeWidth={1.8} />
        </View>

        {/* Body */}
        <View style={s.body}>
          {/* Row 1: title + timestamp */}
          <View style={s.row}>
            <Text style={s.title} numberOfLines={1}>
              {title}
            </Text>
            {item.lastMessage && (
              <Text style={s.time}>{formatRelative(item.lastMessage.createdAt)}</Text>
            )}
          </View>

          {/* Row 2: route + status pill */}
          <View style={s.row}>
            <Text style={s.route} numberOfLines={1}>
              {route}
            </Text>
            <View style={[s.pill, { backgroundColor: st.bg }]}>
              <Text style={[s.pillText, { color: st.color }]}>{st.label}</Text>
            </View>
          </View>

          {/* Row 3: last message preview */}
          {item.lastMessage ? (
            <Text style={s.preview} numberOfLines={1}>
              <Text style={s.previewName}>{item.lastMessage.senderName}: </Text>
              {item.lastMessage.body}
            </Text>
          ) : (
            <Text style={s.previewEmpty}>Vēl nav ziņojumu</Text>
          )}
        </View>

        <ChevronRight size={15} color={colors.textDisabled} />
      </View>
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MessagesScreen() {
  const { token, user } = useAuth();
  const router = useRouter();
  const homeRoute = user?.canTransport
    ? '/(driver)/home'
    : user?.canSell
      ? '/(seller)/home'
      : '/(buyer)/home';
  const handleBack = () => (router.canGoBack() ? router.back() : router.replace(homeRoute as any));
  const [rooms, setRooms] = useState<ApiChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!token) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const data = await api.chat.myRooms(token);
        setRooms(data);
      } catch {
        setError('Neizdevās ielādēt sarakstes');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token],
  );

  // Auto-refresh every 30 s while screen is focused
  useFocusEffect(
    useCallback(() => {
      load();
      pollRef.current = setInterval(() => load(true), 30_000);
      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
      };
    }, [load]),
  );

  return (
    <ScreenContainer standalone bg={colors.bgCard}>
      <ScreenHeader title={t.nav.messages} onBack={handleBack} />

      {loading ? (
        <View style={s.skeletonWrap}>
          <SkeletonJobRow count={5} />
        </View>
      ) : error ? (
        <View style={s.center}>
          <View style={s.errorIconWrap}>
            <AlertCircle size={28} color={colors.danger} strokeWidth={1.6} />
          </View>
          <Text style={s.errorTitle}>Neizdevās ielādēt</Text>
          <Text style={s.errorSub}>{error}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => load()}>
            <RefreshCw size={14} color={colors.textPrimary} strokeWidth={2} />
            <Text style={s.retryText}>Mēģināt vēlreiz</Text>
          </TouchableOpacity>
        </View>
      ) : rooms.length === 0 ? (
        <View style={s.emptyWrap}>
          {/* Double-ring icon */}
          <View style={s.emptyRing}>
            <View style={s.emptyIconCircle}>
              <MessageCircle size={32} color={colors.primary} strokeWidth={1.5} />
            </View>
          </View>
          <Text style={s.emptyTitle}>Nav aktīvu sarunu</Text>
          <Text style={s.emptySub}>
            Sarakste ar piegādātājiem un šoferiem parādīsies šeit pēc pasūtījuma veikšanas. Velciet
            uz leju, lai atjauninātu.
          </Text>
        </View>
      ) : (
        <FlatList
          data={rooms}
          keyExtractor={(r) => r.jobId}
          renderItem={({ item }) => (
            <RoomCard
              item={item}
              onPress={() => {
                haptics.light();
                router.push({
                  pathname: '/chat/[jobId]',
                  params: {
                    jobId: item.jobId,
                    title:
                      item.cargoType ??
                      (item.jobType === 'WASTE_COLLECTION'
                        ? 'Atkritumu izvešana'
                        : 'Kravas pārvadāšana'),
                  },
                } as any);
              }}
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor={colors.textMuted}
            />
          }
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={s.listHeader}>
              <PackageOpen size={14} color={colors.textMuted} strokeWidth={1.8} />
              <Text style={s.listCount}>{rooms.length} aktīvas sarunas</Text>
            </View>
          }
        />
      )}
    </ScreenContainer>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  skeletonWrap: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },

  // Polished empty state
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: spacing.md,
  },
  emptyRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.bgSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 21,
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: spacing.sm,
  },
  errorIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.dangerBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  errorSub: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
    marginTop: spacing.xs,
  },
  retryText: { color: colors.textPrimary, fontWeight: '600', fontSize: 14 },

  // List
  listContent: {
    paddingHorizontal: spacing.base,
    paddingBottom: 40,
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: spacing.sm,
  },
  listCount: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '500',
  },

  // Card
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    flexDirection: 'row',
    overflow: 'hidden',
    ...shadows.card,
  },
  accent: {
    width: 4,
    alignSelf: 'stretch',
    borderTopLeftRadius: radius.lg,
    borderBottomLeftRadius: radius.lg,
  },
  cardInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  body: { flex: 1, gap: 3 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  title: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  time: {
    fontSize: 11,
    color: colors.textDisabled,
    flexShrink: 0,
  },
  route: {
    flex: 1,
    fontSize: 12,
    color: colors.textMuted,
  },
  pill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 99,
    flexShrink: 0,
  },
  pillText: {
    fontSize: 10,
    fontWeight: '600',
  },
  preview: {
    fontSize: 12,
    color: colors.textDisabled,
    marginTop: 1,
  },
  previewName: {
    fontWeight: '600',
    color: colors.textMuted,
  },
  previewEmpty: {
    fontSize: 12,
    color: colors.textDisabled,
    fontStyle: 'italic',
    marginTop: 1,
  },
});

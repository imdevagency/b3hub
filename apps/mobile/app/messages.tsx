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
  const accentColor = isDisposal ? '#059669' : '#2563eb'; // emerald-600 vs blue-600
  const iconBg = isDisposal ? 'bg-emerald-50' : 'bg-blue-50';
  const title = item.cargoType ?? (isDisposal ? 'Atkritumu izvešana' : 'Kravas pārvadāšana');
  const route =
    item.pickupCity && item.deliveryCity
      ? `${item.pickupCity} → ${item.deliveryCity}`
      : item.jobNumber;
  const st = getStatusStyle(item.status);

  return (
    <TouchableOpacity
      className="flex-row items-center px-5 py-4 bg-white"
      activeOpacity={0.7}
      onPress={onPress}
    >
      <View className={`w-12 h-12 rounded-full items-center justify-center mr-4 ${iconBg}`}>
        <Icon size={22} color={accentColor} strokeWidth={2} />
      </View>

      <View className="flex-1">
        {/* Top row: Title + Time */}
        <View className="flex-row items-center justify-between mb-0.5">
          <Text className="text-base font-bold text-gray-900 flex-1 mr-2" numberOfLines={1}>
            {title}
          </Text>
          {item.lastMessage && (
            <Text className="text-xs font-medium text-gray-400">
              {formatRelative(item.lastMessage.createdAt)}
            </Text>
          )}
        </View>

        {/* Middle row: Route + Status */}
        <View className="flex-row items-center mb-1">
          <Text className="text-sm font-medium text-gray-700" style={{ flexShrink: 1 }} numberOfLines={1}>
            {route}
          </Text>
          <View className="w-1 h-1 rounded-full bg-gray-300 mx-2" />
          <Text className="text-xs font-bold" style={{ color: st.color }}>
            {st.label}
          </Text>
        </View>

        {/* Bottom row: Message Preview */}
        {item.lastMessage ? (
          <Text className="text-sm text-gray-500 leading-5" numberOfLines={1}>
            <Text className="font-semibold text-gray-700">{item.lastMessage.senderName}: </Text>
            {item.lastMessage.body}
          </Text>
        ) : (
          <Text className="text-sm text-gray-400 italic mt-0.5">Vēl nav ziņojumu</Text>
        )}
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
    <ScreenContainer standalone bg="#ffffff" noAnimation>
      <ScreenHeader title={t.nav.messages} onBack={handleBack} />

      {loading ? (
        <View className="px-4 py-4 gap-4 bg-white flex-1">
          <SkeletonJobRow count={5} />
        </View>
      ) : error ? (
        <View className="flex-1 bg-white items-center justify-center px-10 gap-3">
          <View className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-1 border border-red-100">
            <AlertCircle size={28} color="#ef4444" strokeWidth={1.6} />
          </View>
          <Text className="text-base font-bold text-gray-900">Neizdevās ielādēt</Text>
          <Text className="text-sm text-gray-500 text-center">{error}</Text>
          <TouchableOpacity
            className="flex-row items-center gap-2 px-5 py-2.5 rounded-full border border-gray-200 bg-white mt-1 shadow-sm"
            activeOpacity={0.7}
            onPress={() => load()}
          >
            <RefreshCw size={14} color="#111827" strokeWidth={2} />
            <Text className="text-gray-900 font-semibold text-sm">Mēģināt vēlreiz</Text>
          </TouchableOpacity>
        </View>
      ) : rooms.length === 0 ? (
        <View className="flex-1 bg-white items-center justify-center px-10 min-h-[400px]">
          <View className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-4 border border-gray-100">
            <MessageCircle size={28} color="#d1d5db" strokeWidth={1.5} />
          </View>
          <Text className="text-xl font-bold text-gray-900 mb-2 text-center">Nav aktīvu sarunu</Text>
          <Text className="text-base text-gray-500 font-medium text-center">
            Sarakste ar piegādātājiem un šoferiem parādīsies šeit pēc pasūtījuma veikšanas.
          </Text>
        </View>
      ) : (
        <FlatList
          data={rooms}
          className="bg-white flex-1"
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
          ItemSeparatorComponent={() => <View className="h-px bg-gray-50 ml-[84px]" />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor="#111827"
            />
          }
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View className="px-5 pt-5 pb-3">
              <Text className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                {rooms.length} {rooms.length === 1 ? 'Saruna' : 'Sarunas'}
              </Text>
            </View>
          }
        />
      )}
    </ScreenContainer>
  );
}
